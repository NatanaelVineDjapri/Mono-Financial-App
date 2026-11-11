import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { DeletePreview, TxDetail } from '@/domain/transactionDetail';
import { deleteTransactionWithUndo } from '@/features/transactions/detail/deleteFlow';
import { useDeletePreview, useTransactionDetail } from '@/features/transactions/detail/useTransactionDetail';
import { MonoColors } from '@/theme/tokens';
import TransactionDetailScreen from '../[id]/index';

jest.mock('@/features/transactions/detail/useTransactionDetail');
jest.mock('@/features/transactions/detail/deleteFlow');
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: '5' }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <TransactionDetailScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

const BCA = { id: 1, name: 'BCA Tabungan', type: 'bank' as const, icon: 'bca', currency: 'IDR', minorFactor: 100 };

const EXPENSE: TxDetail = {
  id: 5,
  kind: 'expense',
  description: 'Lunch with team',
  note: 'Makan siang bareng tim, patungan 5 orang',
  source: 'manual',
  occurredOn: '2026-10-28',
  recordedAt: '2026-10-28T12:41:00+07:00',
  amount: 125000,
  currency: 'IDR',
  minorFactor: 100,
  amountTo: null,
  toCurrency: null,
  toMinorFactor: null,
  amountIdr: 125000,
  category: { id: 1, name: 'Food & drink', icon: null },
  account: { ...BCA, balanceAfter: 6717500 },
  toAccount: null,
  rateE4: null,
  budget: { month: '2026-10', categoryName: 'Food & drink', limit: 1800000, spent: 1425000, usedBp: 7917, isOver: false, overBy: 0 },
};

const INCOME: TxDetail = {
  ...EXPENSE,
  id: 6,
  kind: 'income',
  description: 'Salary, October',
  note: null,
  source: 'recurring',
  amount: 7000000,
  amountIdr: 7000000,
  category: { id: 11, name: 'Salary', icon: null },
  budget: null,
};

const TRANSFER: TxDetail = {
  ...EXPENSE,
  id: 7,
  kind: 'transfer',
  description: 'Top up GoPay',
  note: null,
  amount: 250000,
  amountTo: 250000,
  toCurrency: 'IDR',
  toMinorFactor: 100,
  amountIdr: 250000,
  category: null,
  account: { ...BCA, balanceAfter: 6342500 },
  toAccount: { id: 3, name: 'GoPay', type: 'ewallet', icon: 'gopay', currency: 'IDR', minorFactor: 100, balanceAfter: 1775000 },
  budget: null,
};

const VALAS: TxDetail = {
  ...EXPENSE,
  id: 8,
  description: 'Dinner, Singapore',
  note: null,
  amount: 10000,
  currency: 'SGD',
  minorFactor: 100,
  amountIdr: 1250000,
  account: { id: 9, name: 'Valas', type: 'forex', icon: null, currency: 'SGD', minorFactor: 100, balanceAfter: 18000 },
  rateE4: 125000000,
};

const PREVIEW: DeletePreview = { accountAfter: 6842500, toAccountAfter: null, budgetSpentAfter: 1300000 };

function mockDetail(detail: TxDetail | null | undefined, preview: DeletePreview | undefined = PREVIEW, extra: object = {}) {
  (useTransactionDetail as jest.Mock).mockReturnValue({ data: detail, isLoading: false, isError: false, refetch: jest.fn(), ...extra });
  (useDeletePreview as jest.Mock).mockReturnValue({ data: preview });
}

describe('Transaction detail', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('an expense: red amount with a minus, tag, rows, balance after, notes, budget card', async () => {
    mockDetail(EXPENSE);
    const result = await renderScreen();

    expect(result.getByRole('header', { name: 'Transaction' })).toBeTruthy();
    expect(result.getByText('Lunch with team')).toBeTruthy();
    expect(result.getByText('Food & drink · 28 Oct 2026')).toBeTruthy();
    expect(result.getByText('Expense')).toBeTruthy();
    const amount = result.getByTestId('tx-detail-amount');
    expect(amount.props.children).toBe('−Rp125.000');
    expect(flat(amount).color).toBe(MonoColors.negative);
    expect(flat(amount)).toMatchObject({ fontSize: 40, lineHeight: 46, letterSpacing: -0.8 });

    // The category tile: card fill, 1px border, a gold icon (fork and knife for Food & drink).
    expect(flat(result.getByTestId('tx-detail-tile', { includeHiddenElements: true }))).toMatchObject({
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: MonoColors.card,
      borderWidth: 1,
      borderColor: MonoColors.border,
    });

    const rows = within(result.getByTestId('tx-detail-rows'));
    expect(rows.getByText('BCA Tabungan')).toBeTruthy();
    // No bank tile beside the Account row's name.
    expect(result.queryAllByTestId('tx-detail-bank-tile', { includeHiddenElements: true })).toHaveLength(0);
    expect(rows.getByText('Balance after Rp6.717.500')).toBeTruthy();
    expect(rows.getByText('28 Oct 2026 · 12:41')).toBeTruthy();
    expect(rows.getByText('Food & drink')).toBeTruthy();
    expect(rows.getByText('Manual')).toBeTruthy();
    expect(rows.getByText('Makan siang bareng tim, patungan 5 orang')).toBeTruthy();

    const budget = within(result.getByTestId('tx-detail-budget'));
    expect(budget.getByText('Budget · Food & drink')).toBeTruthy();
    expect(budget.getByText('Oct 2026')).toBeTruthy();
    expect(budget.getByText('Rp1.425.000')).toBeTruthy();
    expect(budget.getByText('of Rp1.800.000 · 79,17%')).toBeTruthy();
    expect(budget.getByText('This transaction is part of that total.')).toBeTruthy();
  });

  test('income: the positive token and a plus; "No note" when empty; source from the column; no budget card', async () => {
    mockDetail(INCOME);
    const result = await renderScreen();
    const amount = result.getByTestId('tx-detail-amount');
    expect(amount.props.children).toBe('+Rp7.000.000');
    expect(flat(amount).color).toBe(MonoColors.positive);
    expect(result.getByText('Income')).toBeTruthy();
    const rows = within(result.getByTestId('tx-detail-rows'));
    expect(rows.getByText('No note')).toBeTruthy();
    expect(rows.getByText('Fixed expense')).toBeTruthy();
    expect(result.queryByTestId('tx-detail-budget')).toBeNull();
  });

  test('a transfer: neutral amount without a sign, explainer, From and To with balance after, no category or budget', async () => {
    mockDetail(TRANSFER);
    const result = await renderScreen();
    const amount = result.getByTestId('tx-detail-amount');
    expect(amount.props.children).toBe('Rp250.000');
    expect(flat(amount).color).toBe(MonoColors.text);
    expect(result.getByText('Transfer')).toBeTruthy();
    expect(result.getByText('Moves money between your accounts. It is not income or spending and is not counted in reports or budgets.')).toBeTruthy();

    const card = within(result.getByTestId('tx-detail-transfer'));
    expect(card.getByText('From')).toBeTruthy();
    expect(card.getByText('BCA Tabungan')).toBeTruthy();
    expect(card.getByText('After Rp6.342.500')).toBeTruthy();
    expect(card.getByText('To')).toBeTruthy();
    expect(card.getByText('GoPay')).toBeTruthy();
    expect(card.getByText('After Rp1.775.000')).toBeTruthy();
    const from = card.getByText('−Rp250.000');
    expect(flat(from).color).toBe(MonoColors.negative);
    const to = card.getByText('+Rp250.000');
    expect(flat(to).color).toBe(MonoColors.text); // a transfer is never coloured green

    expect(result.getAllByTestId('tx-detail-bank-tile', { includeHiddenElements: true })).toHaveLength(2); // the From and To rows keep their tiles
    expect(result.queryByText('Category')).toBeNull();
    expect(result.queryByTestId('tx-detail-budget')).toBeNull();
  });

  test('a Valas expense: pocket-currency amount, the rupiah value at the time, rate rows and the fixed-value note', async () => {
    mockDetail(VALAS);
    const result = await renderScreen();
    expect(result.getByTestId('tx-detail-amount').props.children).toBe('−S$100,00');
    expect(result.getByTestId('tx-detail-rupiah-line').props.children).toBe('Rp1.250.000 at the time (S$1 = Rp12.500)');
    const rows = within(result.getByTestId('tx-detail-rows'));
    expect(rows.getByText('Valas')).toBeTruthy();
    expect(rows.getByText('Pocket S$ · after S$180,00')).toBeTruthy();
    expect(rows.getByText('Currency')).toBeTruthy();
    expect(rows.getByText('SGD')).toBeTruthy();
    expect(rows.getByText('Rupiah value')).toBeTruthy();
    expect(rows.getByText('Rp1.250.000')).toBeTruthy();
    expect(rows.getByText('Rate used')).toBeTruthy();
    expect(rows.getByText('S$1 = Rp12.500 · 28 Oct 2026')).toBeTruthy();
    expect(result.getByText('The rupiah value is fixed when you record the transaction, so later rate changes do not rewrite it.')).toBeTruthy();
  });

  test('hidden mode masks every figure: amount, balance after, rupiah line, budget, dialog', async () => {
    mockDetail(VALAS);
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await renderScreen();
    expect(result.getByTestId('tx-detail-amount').props.children).toBe('Rp••••••••');
    expect(result.queryByText(/S\$100/)).toBeNull();
    expect(result.queryByText(/1\.250\.000/)).toBeNull();
    expect(result.getByTestId('tx-detail-rupiah-line').props.children).toBe('Rp•••••••• at the time (S$1 = Rp12.500)');

    await fireEvent.press(result.getByTestId('tx-detail-delete'));
    expect(result.queryByText(/6\.842\.500/)).toBeNull();
    expect(result.queryByText(/1\.300\.000/)).toBeNull();
  });

  test('Edit opens /tx/[id]/edit; the header has no pencil', async () => {
    mockDetail(EXPENSE);
    const result = await renderScreen();
    expect(result.queryByRole('button', { name: 'Edit transaction' })).toBeNull();
    await fireEvent.press(result.getByRole('button', { name: 'Edit' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/[id]/edit', params: { id: '5' } });
  });

  test('the back arrow goes back; touch targets are at least 44', async () => {
    mockDetail(EXPENSE);
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(flat(result.getByTestId('tx-detail-delete')).minHeight).toBeGreaterThanOrEqual(44);
    expect(flat(result.getByTestId('tx-detail-delete')).width).toBe(120);
  });

  test('the bottom bar: Delete is outlined red, Edit is the solid primary button', async () => {
    mockDetail(EXPENSE);
    const result = await renderScreen();
    const del = flat(result.getByTestId('tx-detail-delete'));
    expect(del).toMatchObject({ backgroundColor: '#151516', borderColor: '#272728', borderWidth: 1 });
    expect(flat(result.getByText('Delete')).color).toBe(MonoColors.negative);
    expect(flat(result.getByTestId('tx-detail-edit')).backgroundColor).toBe(MonoColors.text);
  });

  describe('Delete', () => {
    test('opens the dialog naming the record, the balance and the budget after removal; Cancel closes it', async () => {
      mockDetail(EXPENSE);
      const result = await renderScreen();
      expect(result.queryByText('Delete this transaction?')).toBeNull();

      await fireEvent.press(result.getByTestId('tx-detail-delete'));
      const dialog = within(result.getByTestId('tx-delete-dialog'));
      expect(dialog.getByText('Delete this transaction?')).toBeTruthy();
      expect(
        dialog.getByText('“Lunch with team”, −Rp125.000, will be removed. BCA Tabungan goes back to Rp6.842.500 and the Food & drink budget to Rp1.300.000. You can undo this for a few seconds.'),
      ).toBeTruthy();

      await fireEvent.press(dialog.getByRole('button', { name: 'Cancel' }));
      expect(result.queryByText('Delete this transaction?')).toBeNull();
      expect(deleteTransactionWithUndo).not.toHaveBeenCalled();
    });

    test('a transfer names both accounts', async () => {
      mockDetail(TRANSFER, { accountAfter: 6592500, toAccountAfter: 1525000, budgetSpentAfter: null });
      const result = await renderScreen();
      await fireEvent.press(result.getByTestId('tx-detail-delete'));
      expect(
        within(result.getByTestId('tx-delete-dialog')).getByText('“Top up GoPay”, Rp250.000, will be removed. BCA Tabungan goes back to Rp6.592.500 and GoPay to Rp1.525.000. You can undo this for a few seconds.'),
      ).toBeTruthy();
    });

    test('confirming deletes that record and leaves the screen', async () => {
      mockDetail(EXPENSE);
      (deleteTransactionWithUndo as jest.Mock).mockImplementation(async (_db, _qc, _id, onDeleted: () => void) => {
        onDeleted();
        return { ok: true };
      });
      const result = await renderScreen();
      await fireEvent.press(result.getByTestId('tx-detail-delete'));
      await fireEvent.press(within(result.getByTestId('tx-delete-dialog')).getByRole('button', { name: 'Delete' }));
      expect(deleteTransactionWithUndo).toHaveBeenCalledWith(expect.anything(), expect.anything(), 5, expect.any(Function));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    test('a delete that the schema refuses keeps the screen and shows why', async () => {
      mockDetail(INCOME);
      (deleteTransactionWithUndo as jest.Mock).mockResolvedValue({ ok: false, message: 'This would take the account below zero, so it cannot be deleted. The money has already been spent.' });
      const result = await renderScreen();
      await fireEvent.press(result.getByTestId('tx-detail-delete'));
      await fireEvent.press(within(result.getByTestId('tx-delete-dialog')).getByRole('button', { name: 'Delete' }));
      expect(mockBack).not.toHaveBeenCalled();
      expect(result.queryByText('Delete this transaction?')).toBeNull();
    });
  });

  test('a record that no longer exists says so, with a way back', async () => {
    mockDetail(null);
    const result = await renderScreen();
    expect(result.getByText('This transaction no longer exists.')).toBeTruthy();
    expect(result.queryByTestId('tx-detail-delete')).toBeNull();
  });

  test('a load error offers Try again', async () => {
    const refetch = jest.fn();
    mockDetail(undefined, undefined, { isError: true, refetch });
    const result = await renderScreen();
    expect(result.getByText('Could not load this transaction.')).toBeTruthy();
    await fireEvent.press(result.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});
