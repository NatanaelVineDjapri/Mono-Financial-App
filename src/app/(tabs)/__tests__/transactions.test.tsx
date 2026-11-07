import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TransactionsScreen from '../transactions';
import { useHideAmounts } from '@/components/hide-amounts-store';
import type { TransactionsPage, TxListRow } from '@/domain/transactionsList';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';

jest.mock('@/features/transactions/useTransactionsList');

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockUseTransactionsList = useTransactionsList as jest.MockedFunction<typeof useTransactionsList>;

type InfiniteResult = ReturnType<typeof useTransactionsList>;

function mockResult(partial: Partial<InfiniteResult>) {
  mockUseTransactionsList.mockReturnValue(partial as InfiniteResult);
}

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<TransactionsScreen />}</SafeAreaProvider>);
}

function row(overrides: Partial<TxListRow>): TxListRow {
  return {
    id: 1,
    kind: 'expense',
    occurred_on: '2026-10-20',
    description: '',
    note: null,
    amount: 100000,
    amount_idr: 100000,
    currency: 'IDR',
    minor_factor: 100,
    amount_to: null,
    to_currency: null,
    category_id: 3,
    category_name: 'Shopping',
    account_id: 1,
    account_name: 'BCA Tabungan',
    to_account_id: null,
    to_account_name: null,
    ...overrides,
  };
}

const OCT_ROWS: TxListRow[] = [
  row({ id: 11, kind: 'transfer', occurred_on: '2026-10-27', amount: 1000000, amount_idr: 1000000, amount_to: 1000000, to_currency: 'IDR', category_id: null, category_name: null, to_account_id: 2, to_account_name: 'Jago Pocket' }),
  row({ id: 4, kind: 'income', occurred_on: '2026-10-26', amount: 500000, amount_idr: 500000, category_id: 12, category_name: 'Freelance' }),
  row({ id: 3, kind: 'income', occurred_on: '2026-10-25', amount: 7000000, amount_idr: 7000000, category_id: 11, category_name: 'Salary' }),
  row({ id: 5, kind: 'expense', occurred_on: '2026-10-20', amount: 812000, amount_idr: 812000, category_id: 3, category_name: 'Shopping', description: '', note: 'New shoes' }),
  row({ id: 6, kind: 'expense', occurred_on: '2026-10-20', amount: 1150000, amount_idr: 1150000, category_id: 4, category_name: 'Bills' }),
  row({ id: 7, kind: 'expense', occurred_on: '2026-10-20', amount: 540000, amount_idr: 540000, category_id: 2, category_name: 'Transport' }),
  row({ id: 8, kind: 'expense', occurred_on: '2026-10-20', amount: 1425000, amount_idr: 1425000, category_id: 1, category_name: 'Food & drink' }),
  row({ id: 9, kind: 'expense', occurred_on: '2026-10-20', amount: 210000, amount_idr: 210000, category_id: 6, category_name: 'Leisure' }),
  row({ id: 10, kind: 'expense', occurred_on: '2026-10-20', amount: 120000, amount_idr: 120000, category_id: 5, category_name: 'Health' }),
];

const OCT_PAGE: TransactionsPage = {
  period: '2026-10',
  monthLabel: 'October',
  rows: OCT_ROWS,
  daily: [
    { occurred_on: '2026-10-27', income: 0, expense: 0, net: 0 },
    { occurred_on: '2026-10-26', income: 500000, expense: 0, net: 500000 },
    { occurred_on: '2026-10-25', income: 7000000, expense: 0, net: 7000000 },
    { occurred_on: '2026-10-20', income: 0, expense: 4257000, net: -4257000 },
  ],
  summary: { income: 7500000, expense: 4257000, net: 3243000, transfer_count: 1, transfer_total: 1000000 },
  rangeStart: '2026-10-01',
  rangeEnd: '2026-10-28',
  previousPeriod: '2026-09',
  isCurrent: true,
  isEmpty: false,
};

const SEPT_PAGE: TransactionsPage = {
  period: '2026-09',
  monthLabel: 'September',
  rows: [],
  daily: [],
  summary: { income: 0, expense: 3940000, net: -3940000, transfer_count: 0, transfer_total: 0 },
  rangeStart: '2026-09-01',
  rangeEnd: '2026-09-30',
  previousPeriod: '2026-08',
  isCurrent: false,
  isEmpty: true,
};

function baseResult(pages: TransactionsPage[]): Partial<InfiniteResult> {
  return {
    data: { pages, pageParams: pages.map(p => p.period) } as never,
    isLoading: false,
    isError: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

describe('TransactionsScreen', () => {
  beforeEach(() => {
    useHideAmounts.getState().setHidden(false);
    jest.clearAllMocks();
  });

  test('shows the count and range, the summary card and every October row grouped by day', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();

    expect(result.getByText('9 transactions · 1 Oct 2026–28 Oct 2026')).toBeTruthy();
    expect(result.getByText('+Rp7.500.000')).toBeTruthy(); // income
    // −Rp4.257.000 appears twice: the summary card's expense figure, and Oct 20's own
    // day total (every expense that month fell on the same day in this fixture).
    expect(result.getAllByText('−Rp4.257.000')).toHaveLength(2);
    // +Rp3.243.000 appears twice: the summary card's net figure and October's own month
    // header net (both describe the same number, per the design board).
    expect(result.getAllByText('+Rp3.243.000')).toHaveLength(2);
    expect(result.getByText('Not counted: 1 transfer between accounts (Rp1.000.000)')).toBeTruthy();
    expect(result.getByTestId('tx-row-5')).toBeTruthy();
    expect(result.getByTestId('tx-row-11')).toBeTruthy();
  });

  test('a transfer row shows no sign and the transfer kind label', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    const transferRow = result.getByTestId('tx-row-11');
    expect(transferRow.props.accessibilityLabel).toContain('Rp1.000.000');
    expect(transferRow.props.accessibilityLabel).not.toMatch(/[+−]Rp/);
  });

  test('a collapsed older month shows its own expense total and opens on tap', async () => {
    mockResult(baseResult([OCT_PAGE, SEPT_PAGE]));
    const result = await renderScreen();

    expect(result.getByText('Expense Rp3.940.000')).toBeTruthy();
    await fireEvent.press(result.getByTestId('month-2026-09'));
    expect(result.queryByText('Expense Rp3.940.000')).toBeNull();
  });

  test('switching the type chip to Income is passed through to the hook', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));
    expect(mockUseTransactionsList).toHaveBeenLastCalledWith({ type: 'income', search: '' });
  });

  test('typing in search debounces 250ms before reaching the hook', async () => {
    jest.useFakeTimers();
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    await fireEvent.changeText(result.getByTestId('transactions-search'), 'shoes');
    expect(mockUseTransactionsList).not.toHaveBeenLastCalledWith({ type: 'all', search: 'shoes' });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockUseTransactionsList).toHaveBeenLastCalledWith({ type: 'all', search: 'shoes' });
    jest.useRealTimers();
  });

  test('no matches: empty state with a reset button once filtered', async () => {
    mockResult(baseResult([{ ...OCT_PAGE, rows: [], daily: [], isEmpty: true }]));
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));

    expect(result.getByText('No matches')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Reset search' })).toBeTruthy();
  });

  test('hidden mode masks the summary and every row amount', async () => {
    useHideAmounts.getState().setHidden(true);
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    expect(result.queryByText('+Rp7.500.000')).toBeNull();
    expect(result.queryAllByText('Rp••••••••').length).toBeGreaterThan(0);
  });

  test('tapping a row navigates to /tx/[id]', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('tx-row-5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/[id]', params: { id: '5' } });
  });

  test('the FAB opens /ai-chat', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Record via chat' }));
    expect(mockPush).toHaveBeenCalledWith('/ai-chat');
  });

  test('the Filters button opens the stub sheet', async () => {
    mockResult(baseResult([OCT_PAGE]));
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Filters' }));
    expect(result.getByText('Filters are coming soon.')).toBeTruthy();
  });

  describe('Fase 4.3a fixes', () => {
    test('the summary card stacks three rows (label left, nominal right), not three columns', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();

      const incomeRow = result.getByTestId('summary-row-income');
      const expenseRow = result.getByTestId('summary-row-expense');
      const netRow = result.getByTestId('summary-row-net');
      // Each row holds exactly its own label and its own value — a column layout would
      // instead put all three labels in one row and all three values in another.
      expect(within(incomeRow).getByText('Income')).toBeTruthy();
      expect(within(incomeRow).getByText('+Rp7.500.000')).toBeTruthy();
      expect(within(expenseRow).getByText('Expense')).toBeTruthy();
      expect(within(expenseRow).getAllByText('−Rp4.257.000').length).toBeGreaterThan(0);
      expect(within(netRow).getByText('Net')).toBeTruthy();
      expect(within(netRow).getAllByText('+Rp3.243.000').length).toBeGreaterThan(0);
    });

    test('the summary card\'s figures never truncate (no numberOfLines) so they can wrap at a large text scale', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();
      const value = within(result.getByTestId('summary-row-income')).getByText('+Rp7.500.000');
      expect(value.props.numberOfLines).toBeUndefined();
    });

    test('a day with only transfers shows no daily total (not "Rp0")', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();
      expect(result.getByText('Tue, 27 Oct')).toBeTruthy(); // the day header itself still shows
      expect(result.queryByText('Rp0')).toBeNull();
      expect(result.queryByText('+Rp0')).toBeNull();
    });

    test('the list\'s bottom padding clears the FAB, its gap and the tab bar\'s zone', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();
      const list = result.getByTestId('transactions-list');
      const flatStyle = Object.assign({}, ...[list.props.contentContainerStyle].flat());
      expect(flatStyle.paddingBottom).toBe(56 + 16 + 72); // + insets.bottom (0 in this fixture)
    });

    test('a row\'s subtitle has no date (the day header above it already states it)', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();
      expect(result.getByText('Shopping · BCA Tabungan')).toBeTruthy();
      expect(result.queryByText(/Shopping · BCA Tabungan ·/)).toBeNull();
    });

    test('a transfer row\'s subtitle has no date either', async () => {
      mockResult(baseResult([OCT_PAGE]));
      const result = await renderScreen();
      expect(result.getByText('BCA Tabungan → Jago Pocket')).toBeTruthy();
    });
  });
});
