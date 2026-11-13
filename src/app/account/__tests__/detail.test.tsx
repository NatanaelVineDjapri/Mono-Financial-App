import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountDetail, ActivityItem } from '@/domain/accountDetail';
import { useAccountActivity, useAccountDetail } from '@/features/accounts/detail/useAccountDetail';
import { useStatsCollapsed } from '@/features/transactions/statsStore';
import { MonoColors } from '@/theme/tokens';
import AccountDetailScreen from '../[id]';

jest.mock('@/features/accounts/detail/useAccountDetail');
// The Valas account has its own screen (tested with src/features/valas); here only that the route hands over.
jest.mock('@/features/valas/ValasDetailScreen', () => ({
  ValasDetailScreen: ({ accountId }: { accountId: number }) => jest.requireActual('react').createElement(jest.requireActual('react-native').Text, null, 'valas-detail-' + accountId),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: '1' }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AccountDetailScreen />
    </SafeAreaProvider>,
  );
}

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

// The board's BCA Tabungan: opening 1.200.000, in 15.000.000, out 9.357.500, now 6.842.500.
const BCA: AccountDetail = {
  id: 1,
  name: 'BCA Tabungan',
  type: 'bank',
  icon: 'bca',
  openingBalance: 1200000,
  openingDate: '2026-01-01',
  balance: 6842500,
  moneyIn: 15000000,
  moneyOut: 9357500,
  recordCount: 9,
  period: '2026-10',
};

const ACTIVITY: ActivityItem[] = [
  { id: 11, date: '2026-10-27', title: 'Top up Jago Pocket', kind: 'transfer_out', delta: -1000000, balanceAfter: 6842500 },
  { id: 4, date: '2026-10-26', title: 'Freelance, logo work', kind: 'income', delta: 500000, balanceAfter: 7842500 },
  { id: 8, date: '2026-10-24', title: 'Headphones, online store', kind: 'expense', delta: -312000, balanceAfter: 342500 },
  { id: 12, date: '2026-10-23', title: '← GoPay', kind: 'transfer_in', delta: 50000, balanceAfter: 654500 },
];

function mockData(detail: AccountDetail | null | undefined, activity: ActivityItem[] | undefined = ACTIVITY, extra: object = {}) {
  (useAccountDetail as jest.Mock).mockReturnValue({ data: detail, isLoading: false, isError: false, refetch: jest.fn(), ...extra });
  (useAccountActivity as jest.Mock).mockReturnValue({ data: activity });
}

describe('Account detail', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('the title, the kind and the current balance', async () => {
    mockData(BCA);
    const result = await renderScreen();
    expect(result.getByRole('header', { name: 'BCA Tabungan' })).toBeTruthy();
    expect(result.getByText('Bank account · current balance')).toBeTruthy();
    expect(result.getByTestId('account-balance').props.children).toBe('Rp6.842.500');
  });

  test('where the balance comes from: opening, money in (green), money out (red), current', async () => {
    mockData(BCA);
    const result = await renderScreen();
    const recon = within(result.getByTestId('account-recon'));
    expect(recon.getByText('Opening balance · 1 Jan 2026')).toBeTruthy();
    expect(within(result.getByTestId('account-recon-opening')).getByText('Rp1.200.000')).toBeTruthy();
    const moneyIn = within(result.getByTestId('account-recon-in')).getByText('+Rp15.000.000');
    expect(flat(moneyIn).color).toBe(MonoColors.positive);
    const moneyOut = within(result.getByTestId('account-recon-out')).getByText('−Rp9.357.500');
    expect(flat(moneyOut).color).toBe(MonoColors.negative);
    expect(within(result.getByTestId('account-recon-current')).getByText('Rp6.842.500')).toBeTruthy();
    expect(result.getByText('Money in and out include transfers to and from your other accounts.')).toBeTruthy();
    // The four numbers add up, as they must (opening + in − out = balance).
    expect(BCA.openingBalance + BCA.moneyIn - BCA.moneyOut).toBe(BCA.balance);
  });

  test('Add and Transfer open the transaction form with this account chosen', async () => {
    mockData(BCA);
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('account-add'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/add', params: { account: '1' } });
    await fireEvent.press(result.getByTestId('account-transfer'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/add', params: { type: 'transfer', account: '1' } });
  });

  test('the pencil opens the account form for this account; back goes back', async () => {
    mockData(BCA);
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Edit account' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/edit', params: { id: '1' } });
    await fireEvent.press(result.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  describe('activity', () => {
    test('the month, newest first, with each row\'s running balance', async () => {
      mockData(BCA);
      const result = await renderScreen();
      expect(result.getByRole('header', { name: 'Activity · October' })).toBeTruthy();
      expect(result.getByText('Newest first')).toBeTruthy();
      expect(result.getByText('27 Oct · Balance Rp6.842.500')).toBeTruthy();
      expect(result.getByText('Top up Jago Pocket')).toBeTruthy();
    });

    test('a transfer is neutral and unsigned and says Transfer out / Transfer in; income +green, expense −red', async () => {
      mockData(BCA);
      const result = await renderScreen();
      const out = within(result.getByTestId('account-activity-11'));
      expect(flat(out.getByText('Rp1.000.000')).color).toBe(MonoColors.text);
      expect(out.getByText('Transfer out')).toBeTruthy();
      const transferIn = within(result.getByTestId('account-activity-12'));
      expect(flat(transferIn.getByText('Rp50.000')).color).toBe(MonoColors.text);
      expect(transferIn.getByText('Transfer in')).toBeTruthy();
      const income = within(result.getByTestId('account-activity-4'));
      expect(flat(income.getByText('+Rp500.000')).color).toBe(MonoColors.positive);
      expect(income.getByText('Income')).toBeTruthy();
      const expense = within(result.getByTestId('account-activity-8'));
      expect(flat(expense.getByText('−Rp312.000')).color).toBe(MonoColors.negative);
      expect(expense.getByText('Expense')).toBeTruthy();
    });

    test('a row is a button that says what it is, and opens the transaction', async () => {
      mockData(BCA);
      const result = await renderScreen();
      const row = result.getByTestId('account-activity-4');
      expect(row.props.accessibilityLabel).toBe('Freelance, logo work, Income, 26 Oct · Balance Rp7.842.500, +Rp500.000');
      await fireEvent.press(row);
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/[id]', params: { id: '4' } });
    });

    test('All / In / Out filter the list (the hook is asked for that filter)', async () => {
      mockData(BCA);
      const result = await renderScreen();
      expect(result.getByTestId('account-filter-all').props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(result.getByTestId('account-filter-in'));
      expect(result.getByTestId('account-filter-in').props.accessibilityState).toMatchObject({ selected: true });
      expect(useAccountActivity).toHaveBeenLastCalledWith(1, '2026-10', 'in');
      await fireEvent.press(result.getByTestId('account-filter-out'));
      expect(useAccountActivity).toHaveBeenLastCalledWith(1, '2026-10', 'out');
    });

    test('nothing this month, and a filter with no match, each say so', async () => {
      mockData(BCA, []);
      const result = await renderScreen();
      expect(result.getByText('Nothing recorded in October yet.')).toBeTruthy();
      await fireEvent.press(result.getByTestId('account-filter-out'));
      expect(result.getByText('No records match this filter.')).toBeTruthy();
    });

    test('"View all transactions" opens the Transactions tab narrowed to this account', async () => {
      mockData(BCA);
      const result = await renderScreen();
      await fireEvent.press(result.getByRole('button', { name: 'View all transactions for this account' }));
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/transactions');
      expect(useStatsCollapsed.getState().filters).toMatchObject({ accountIds: [1], datePreset: 'custom', customStart: '2026-01-01', categoryIds: [], type: 'all' });
    });
  });

  test('hidden-amounts mode masks every figure: balance, reconciliation, activity', async () => {
    mockData(BCA);
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await renderScreen();
    expect(result.getByTestId('account-balance').props.children).toBe('Rp••••••••');
    expect(result.queryByText(/6\.842\.500/)).toBeNull();
    expect(result.queryByText(/15\.000\.000/)).toBeNull();
    expect(result.queryByText(/500\.000/)).toBeNull();
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('a Valas account opens the Valas detail; an unknown one says it is gone; a load error offers Try again', async () => {
    mockData({ ...BCA, type: 'forex' });
    const valas = await renderScreen();
    expect(valas.getByText('valas-detail-1')).toBeTruthy();
    expect(valas.queryByRole('button', { name: 'Edit account' })).toBeNull();

    mockData(null);
    const gone = await renderScreen();
    expect(gone.getByText('This account no longer exists.')).toBeTruthy();

    const refetch = jest.fn();
    mockData(undefined, undefined, { isError: true, refetch });
    const failed = await renderScreen();
    await fireEvent.press(failed.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  test('touch targets are at least 44 (the rows, the view-all link and the buttons)', async () => {
    mockData(BCA);
    const result = await renderScreen();
    expect(flat(result.getByTestId('account-activity-4')).minHeight).toBeGreaterThanOrEqual(44);
    expect(flat(result.getByTestId('account-view-all')).minHeight).toBeGreaterThanOrEqual(44);
  });
});
