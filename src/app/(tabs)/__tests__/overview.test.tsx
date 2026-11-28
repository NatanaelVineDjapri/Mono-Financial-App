import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Dimensions, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { buildFlowRanges } from '@/domain/cashFlowRanges';
import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountsOverview } from '@/domain/balances';
import type { OverviewData } from '@/domain/overview';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import { useGoalProgress, useOverviewData } from '@/features/overview/useOverview';
import { useQuickRecords } from '@/features/overview/useQuickRecords';
import { useNeedsWelcome } from '@/features/welcome/useNeedsWelcome';
import { useRecurringDue } from '@/features/recurring/useRecurringDue';
import { useGreeting } from '@/features/overview/useGreeting';
import { useDisplayName } from '@/features/settings/useDisplayName';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';
import { useLanguage } from '@/i18n/lang';
import { MonoColors } from '@/theme/tokens';
import OverviewScreen from '../index';

jest.mock('@/features/accounts/useAccountsOverview');
jest.mock('@/features/overview/useOverview');
jest.mock('@/features/overview/useQuickRecords');
jest.mock('@/features/welcome/useNeedsWelcome');
jest.mock('@/features/recurring/useRecurringDue');
jest.mock('@/features/budgets/useBudgets');
jest.mock('@/features/transactions/useTransactionsList');
jest.mock('@/features/overview/useGreeting', () => ({ useGreeting: jest.fn(() => 'morning') }));
jest.mock('@/features/settings/useDisplayName', () => ({ ...jest.requireActual('@/features/settings/useDisplayName'), useDisplayName: jest.fn(() => 'Nael') }));
// The screen reads its template list straight from the database; the test has no provider,
// so answer that one query with a template (the card hides itself when there are none).
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(({ queryKey }: { queryKey?: unknown[] } = {}) => ({
    data:
      queryKey?.[0] === 'notifications'
        ? 3 // unread notifications
        : queryKey?.[0] === 'recurring'
        ? [
            {
              id: 1, name: 'Gym membership', amount: 200000, amount_varies: 0,
              account_id: 1, category_id: 1, day_of_month: 28, first_due_on: '2026-10-28',
              end_on: null, remind: 1, archived: 0, created_at: '2026-10-01',
              account_name: 'BCA Tabungan', account_type: 'bank', account_balance: 6842500,
              category_name: 'Health',
            },
          ]
        : undefined,
    isLoading: false,
  })),
}));

// A controllable window width (the Hide button's label depends on it).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions');
const mockWindow = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;
function setWindow(overrides: Partial<ReturnType<typeof useWindowDimensions>> = {}) {
  mockWindow.mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 1, ...overrides });
}

const mockPush = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<OverviewScreen />}</SafeAreaProvider>);
}

// The net worth line is drawn once the plot knows its width.
function layoutNetWorthChart(result: Awaited<ReturnType<typeof renderScreen>>) {
  return fireEvent(result.getByTestId('overview-nw-chart-plot'), 'layout', { nativeEvent: { layout: { width: 320, height: 166 } } });
}

function mockQuery<T>(hook: unknown, data: T | undefined, extra: object = {}) {
  (hook as jest.Mock).mockReturnValue({ data, isLoading: false, ...extra });
}

const ACCOUNTS: AccountsOverview = {
  netWorth: 8880000,
  incomplete: false,
  accountCount: 4,
  groups: [
    { type: 'bank', subtotal: 6842500, accounts: [{ id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, missingRates: 0 }] },
    { type: 'cash', subtotal: 450000, accounts: [{ id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, missingRates: 0 }] },
    { type: 'ewallet', subtotal: 312500, accounts: [{ id: 3, name: 'GoPay', type: 'ewallet', icon: 'gopay', balance: 312500, missingRates: 0 }] },
    { type: 'savings', subtotal: 1275000, accounts: [{ id: 4, name: 'Jago Pocket', type: 'savings', icon: 'jago', balance: 1275000, missingRates: 0 }] },
  ],
};

const FLOW_RANGES = buildFlowRanges({
  today: '2026-10-28',
  startDay: 1,
  period: '2026-10',
  daily: [
    { date: '2026-09-05', income: 7000000, expense: 0 },
    { date: '2026-09-20', income: 0, expense: 3940000 },
    { date: '2026-10-20', income: 0, expense: 1580000 },
    { date: '2026-10-25', income: 7500000, expense: 0 },
    { date: '2026-10-26', income: 0, expense: 2677000 },
  ],
  periods: [
    { period: '2026-09', income: 7000000, expense: 3940000 },
    { period: '2026-10', income: 7500000, expense: 4257000 },
  ],
});

const OVERVIEW: OverviewData = {
  period: '2026-10',
  rangeStart: '2026-10-01',
  rangeEnd: '2026-10-28',
  previousPeriod: '2026-09',
  month: { income: 7500000, expense: 4257000, net: 3243000 },
  previous: { income: 7000000, expense: 3940000, net: 3060000 },
  expenseChangeBp: 805,
  incomeChangeBp: 714,
  expenseRangeChangeBp: 1232,
  incomeRangeChangeBp: 714,
  savingsRateBp: 4324,
  flowRanges: FLOW_RANGES,
  netWorth: 8880000,
  netWorthIncomplete: false,
  netWorthChange: 3243000,
  netWorthChangeBp: 5753,
  netWorthVsDate: '2026-09-30',
  netWorthYtdChange: 4120000,
  netWorthYtdBp: 8661,
  netWorthYtdVsDate: '2025-12-31',
  netWorthHistory: [
    { month: '2026-05', netWorth: 0 },
    { month: '2026-06', netWorth: 400000 },
    { month: '2026-07', netWorth: 1100000 },
    { month: '2026-08', netWorth: 2500000 },
    { month: '2026-09', netWorth: 5637000 },
    { month: '2026-10', netWorth: 8880000 },
  ],
  cashFlow: [
    { period: '2026-05', income: 6800000, expense: 6800000, net: 0 },
    { period: '2026-06', income: 7000000, expense: 6600000, net: 400000 },
    { period: '2026-07', income: 7000000, expense: 6300000, net: 700000 },
    { period: '2026-08', income: 7200000, expense: 5800000, net: 1400000 },
    { period: '2026-09', income: 7000000, expense: 3940000, net: 3060000 },
    { period: '2026-10', income: 7500000, expense: 4257000, net: 3243000 },
  ],
  topCategories: { total: 4257000, categories: [] },
  topShares: [
    { id: 1, label: 'Food & drink', amount: 1425000, sharePermille: 335 },
    { id: 4, label: 'Bills', amount: 1150000, sharePermille: 270 },
    { id: 3, label: 'Shopping', amount: 812000, sharePermille: 191 },
    { id: 2, label: 'Transport', amount: 540000, sharePermille: 127 },
    { id: -1, label: '', amount: 330000, sharePermille: 77 },
  ],
};

const TX_PAGE = {
  pages: [
    {
      rows: [
        { id: 5, kind: 'expense', occurred_on: '2026-10-20', description: 'Coffee & pastry', note: null, amount: 38500, amount_idr: 38500, currency: 'IDR', minor_factor: 100, amount_to: null, to_currency: null, category_id: 1, category_name: 'Food & drink', account_id: 3, account_name: 'GoPay', to_account_id: null, to_account_name: null },
      ],
    },
  ],
};

const BUDGET = {
  month: '2026-10',
  limit: { month: '2026-10', monthly_limit: 5000000, limit_repeat: 1, allocated: 5000000, total_spent: 4257000, remaining: 743000, over_by: 0, used_bp: 8514 },
  categories: [{ budget_id: 1, category_id: 3, category: 'Shopping', icon: null, limit_amount: 700000, spent: 812000, remaining: -112000, over_by: 112000, used_bp: 11600, is_over: 1, repeat: 1 }],
};

const GOALS = [{ id: 1, name: 'Total assets', mode: 'total_assets', account_id: null, target_amount: 30000000, target_date: '2027-06-30', current_amount: 8880000, remaining: 21120000, progress_bp: 2960 }];

const QUICK_RECORDS = [
  {
    source: 'category',
    label: 'Food & drink',
    placeName: null,
    kind: 'expense',
    accountId: 1,
    accountName: 'BCA Tabungan',
    categoryId: 2,
    categoryName: 'Food & drink',
    amount: 18000,
    count: 4,
    lastOn: '2026-10-20',
  },
  {
    source: 'place',
    label: 'Kantor',
    placeName: 'Kantor',
    kind: 'expense',
    accountId: 1,
    accountName: 'BCA Tabungan',
    categoryId: 3,
    categoryName: 'Transport',
    amount: 5000,
    count: 2,
    lastOn: '2026-10-18',
  },
];

const mockNeedsWelcome = useNeedsWelcome as jest.MockedFunction<typeof useNeedsWelcome>;

function mockFilled() {
  mockNeedsWelcome.mockReturnValue(false);
  mockQuery(useAccountsOverview, ACCOUNTS);
  mockQuery(useOverviewData, OVERVIEW);
  mockQuery(useRecurringDue, []);
  mockQuery(useBudgetOverview, BUDGET);
  mockQuery(useGoalProgress, GOALS);
  mockQuery(useQuickRecords, QUICK_RECORDS);
  mockQuery(useTransactionsList, TX_PAGE);
}

describe('Overview', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    setWindow();
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('filled: header, hero, Expenses/Income, carousel, charts and the rest all render', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByLabelText('MONO')).toBeTruthy();
    expect(result.getByRole('button', { name: /Notifi/ })).toBeTruthy();
    expect(result.getByText('Selamat pagi, Nael')).toBeTruthy();
    expect(result.getByTestId('hero-balance').props.children).toBe('Rp8.880.000');
    expect(result.getByText('+Rp3.243.000 (+57,53%)')).toBeTruthy();
    expect(result.getByText('vs 30 Sep 2026')).toBeTruthy();
    // The net cash flow block: October so far, against the same days of September.
    expect(result.getByText('Arus kas bersih · October')).toBeTruthy();
    expect(result.getByTestId('flow-net').props.children).toBe('+Rp3.243.000');
    expect(within(result.getByTestId('overview-income-card')).getByText('Rp7.500.000')).toBeTruthy();
    expect(within(result.getByTestId('overview-expenses-card')).getByText('Rp4.257.000')).toBeTruthy();
    expect(result.getByText('Pemasukan dikurangi pengeluaran. Transfer, saldo awal, dan perubahan kurs tidak dihitung.')).toBeTruthy();
    expect(result.getByTestId('overview-account-1')).toBeTruthy();
    expect(result.getByText('Cash flow')).toBeTruthy();
    expect(result.getByText('Top categories')).toBeTruthy();
    expect(result.getAllByText('33,5%').length).toBeGreaterThan(0); // the ring's centre and its legend
    expect(within(result.getByTestId('overview-top-legend')).getByText('Others')).toBeTruthy(); // the ring folds categories; accounts below are never folded
    expect(result.getByText('Pengeluaran tetap')).toBeTruthy();
    expect(result.getByText('Recent transactions')).toBeTruthy();
    expect(result.getByText('Budget · Oct 2026')).toBeTruthy();
    expect(result.getByText('Shopping is over its limit by Rp112.000')).toBeTruthy();
    expect(result.getByText('Total assets')).toBeTruthy();
    expect(result.getByText('Net worth history')).toBeTruthy();
    expect(result.getByText('Where your money is')).toBeTruthy();
  });

  test('a plus is green: the net worth chip, the cash flow change chip and the net figure stay white, In is gold, Out is grey', async () => {
    mockFilled();
    const result = await renderScreen();
    const style = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    expect(MonoColors.positive).toBe('#4ADE80');
    expect(style(result.getByText('+Rp3.243.000 (+57,53%)')).color).toBe(MonoColors.positive);
    const change = within(result.getByTestId('flow-change')).getByText(/vs September/);
    expect(style(change).color).toBe(MonoColors.positive);
    expect(style(result.getByTestId('flow-net')).color).toBe(MonoColors.text);
    // the tiles' bars: In green, Out gold, each against the larger of the two
    const bar = (id: string) => style(result.getByTestId(`${id}-bar`));
    expect(bar('overview-income-card')).toMatchObject({ backgroundColor: MonoColors.positive, width: '100%' });
    expect(bar('overview-expenses-card')).toMatchObject({ backgroundColor: MonoColors.accent, width: '57%' }); // 4.257.000 of 7.500.000
  });

  test('a falling net worth is red with its minus sign, and so is a cash flow that dropped', async () => {
    mockFilled();
    mockQuery(useOverviewData, {
      ...OVERVIEW,
      netWorthChange: -500000,
      netWorthChangeBp: -533,
      flowRanges: { ...FLOW_RANGES, month: { ...FLOW_RANGES.month, net: -3257000, previousNet: 2000000, netChangeBp: -26285 } },
    });
    const result = await renderScreen();
    const style = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    expect(style(result.getByText('−Rp500.000 (−5,33%)')).color).toBe(MonoColors.negative);
    expect(result.getByTestId('flow-net').props.children).toBe('−Rp3.257.000');
    expect(style(within(result.getByTestId('flow-change')).getByText(/vs September/)).color).toBe(MonoColors.negative);
  });

  test('the Week / Month / Year switch changes the range: label, net figure and tiles', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByText('Arus kas bersih · October')).toBeTruthy();
    await fireEvent.press(result.getByRole('radio', { name: 'Tahun' }));
    expect(result.getByText('Arus kas bersih · 12 bulan')).toBeTruthy();
    await fireEvent.press(result.getByRole('radio', { name: 'Minggu' }));
    expect(result.getByText('Arus kas bersih · 7 hari')).toBeTruthy();
    expect(result.getByTestId('flow-net').props.children).toBe(`+Rp${String(FLOW_RANGES.week.net).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
  });

  test('with nothing earlier to compare with, the block says so instead of showing a made-up change', async () => {
    mockFilled();
    mockQuery(useOverviewData, { ...OVERVIEW, flowRanges: { ...FLOW_RANGES, month: { ...FLOW_RANGES.month, netChangeBp: null } } });
    const result = await renderScreen();
    expect(result.getByTestId('flow-change').props.children).toBe('Belum ada pembanding');
  });

  test('the chart has an accessibility label and no analysis link', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByTestId('flow-chart').props.accessibilityLabel).toContain('+Rp3.243.000');
    expect(result.queryByTestId('overview-analysis-link')).toBeNull();
  });

  test('on the first launch the Overview sends the person to Welcome, once', async () => {
    mockFilled();
    mockNeedsWelcome.mockReturnValue(true);
    const result = await renderScreen();
    expect(result.queryByTestId('overview-scroll')).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith('/welcome');
  });

  test('the bell opens the notifications inbox and says how many are unread', async () => {
    mockFilled();
    const result = await renderScreen();
    const bell = result.getByTestId('overview-bell');
    expect(bell.props.accessibilityLabel).toContain('3');
    await fireEvent.press(bell);
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  test('quick record shows repeated places or categories and opens the form prefilled', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByText('Catat cepat')).toBeTruthy();
    expect(result.getByTestId('quick-record-category-Food & drink')).toBeTruthy();
    await fireEvent.press(result.getByTestId('quick-record-category-Food & drink'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/tx/add',
      params: { type: 'expense', account: '1', category: '2', amount: '18000' },
    });
  });

  test('the hero action buttons and analysis banner navigate correctly', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByTestId('overview-analysis-banner')).toBeTruthy();
    await fireEvent.press(result.getByTestId('overview-analysis-banner'));
    expect(mockPush).toHaveBeenCalledWith('/analysis');

    await fireEvent.press(result.getByTestId('hero-action-record'));
    expect(mockPush).toHaveBeenCalledWith('/tx/add');

    await fireEvent.press(result.getByTestId('hero-action-transfer'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/add', params: { type: 'transfer' } });

    await fireEvent.press(result.getByTestId('hero-action-scan'));
    expect(mockPush).toHaveBeenCalledWith('/tx/scan');
  });

  test('In and Out open the Transactions list for that type', async () => {
    mockFilled();
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('overview-expenses-card'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/transactions');
    await fireEvent.press(result.getByTestId('overview-income-card'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/transactions');
  });

  test('where your money is lists every account on its own row, nothing folded into Others', async () => {
    mockFilled();
    const result = await renderScreen();
    const card = within(result.getByTestId('overview-where-money'));
    for (const name of ['BCA Tabungan', 'Jago Pocket', 'Cash wallet', 'GoPay']) expect(card.getByText(name)).toBeTruthy();
    expect(card.queryByText('Others')).toBeNull();
    expect(card.getByText('77,05%')).toBeTruthy();
    expect(card.getByText('3,52%')).toBeTruthy();
  });

  test('the carousel is a coverflow: the first card in the middle, one dot per account', async () => {
    mockFilled();
    const result = await renderScreen();
    expect(result.getByTestId('overview-account-carousel')).toBeTruthy();
    expect(result.getAllByTestId(/^overview-account-dot-/, { includeHiddenElements: true })).toHaveLength(4);
  });

  test('the carousel follows the persisted Accounts tab order', async () => {
    const ordered = [ACCOUNTS.groups[2].accounts[0], ACCOUNTS.groups[0].accounts[0], ACCOUNTS.groups[3].accounts[0], ACCOUNTS.groups[1].accounts[0]];
    mockQuery(useAccountsOverview, { ...ACCOUNTS, accounts: ordered });
    mockQuery(useOverviewData, OVERVIEW);
    mockQuery(useRecurringDue, []);
    mockQuery(useBudgetOverview, BUDGET);
    mockQuery(useGoalProgress, GOALS);
    mockQuery(useTransactionsList, TX_PAGE);

    const result = await renderScreen();
    // the first account of the saved order is the focused one (a tap opens it), the second is to its right
    await fireEvent.press(result.getByTestId('overview-account-1'));
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(result.getByTestId('overview-account-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: '1' } });
    mockPush.mockClear();
    await fireEvent.press(result.getByTestId('overview-account-3'));
    await fireEvent.press(result.getByTestId('overview-account-3'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: '3' } });
  });

  test('the carousel loops: the last account also sits to the left of the first (and the first right of the last)', async () => {
    mockFilled();
    const result = await renderScreen();
    // Five places around the middle one: two to the left (accounts 3 and 4), the focused first, two to the right.
    for (const id of [1, 2, 3, 4]) expect(result.getByTestId(`overview-account-${id}`, { includeHiddenElements: true })).toBeTruthy();
    expect(result.getAllByTestId(/^overview-account-\d+(-copy--?\d+)?$/, { includeHiddenElements: true })).toHaveLength(5);
  });

  test('tapping the focused card opens it; tapping a neighbour only brings it to the centre', async () => {
    mockFilled();
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('overview-account-2')); // Cash wallet, a neighbour
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(result.getByTestId('overview-account-2')); // now focused
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: '2' } });
  });

  test('both charts have a y axis in Rp million with gridlines, and the net worth chart labels its goal and last point', async () => {
    mockFilled();
    const result = await renderScreen();
    const cash = within(result.getByTestId('overview-cash-flow'));
    for (const tick of ['0', '4', '8']) expect(cash.getByText(tick, { includeHiddenElements: true })).toBeTruthy(); // the axis is decorative: the table has the exact values
    expect(cash.getByText('Last 12 months · axis in Rp million')).toBeTruthy();
    await layoutNetWorthChart(result);
    const worth = within(result.getByTestId('overview-net-worth-history'));
    for (const tick of ['0', '10 jt', '20 jt', '30 jt']) expect(worth.getByText(tick, { includeHiddenElements: true })).toBeTruthy();
    expect(worth.getByText('Goal · Rp30 jt')).toBeTruthy();
    expect(worth.getByText('8,9 jt', { includeHiddenElements: true })).toBeTruthy();
  });

  test('touching the net worth chart reads out that month, masked when amounts are hidden', async () => {
    mockFilled();
    const result = await renderScreen();
    await layoutNetWorthChart(result);
    const touch = () => act(async () => result.getByTestId('overview-nw-chart-plot').props.onResponderGrant({ nativeEvent: { locationX: 9999 } }));
    await touch();
    expect(within(result.getByTestId('overview-nw-chart-tooltip')).getByText('Rp8.880.000')).toBeTruthy();
    await act(async () => useHideAmounts.getState().setHidden(true));
    await touch();
    expect(within(result.getByTestId('overview-nw-chart-tooltip')).queryByText('Rp8.880.000')).toBeNull();
  });

  test('hidden mode masks the axis labels and the chart callouts too', async () => {
    mockFilled();
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await renderScreen();
    await layoutNetWorthChart(result);
    const worth = within(result.getByTestId('overview-net-worth-history'));
    expect(worth.queryByText('30 jt', { includeHiddenElements: true })).toBeNull();
    expect(worth.queryByText('8,9 jt', { includeHiddenElements: true })).toBeNull();
    expect(worth.getByText('Goal · Rp•••')).toBeTruthy();
    expect(within(result.getByTestId('overview-cash-flow')).queryByText('8', { includeHiddenElements: true })).toBeNull();
  });

  test('net worth history switches between 6M, 1Y and All', async () => {
    mockFilled();
    const months = Array.from({ length: 14 }, (_, i) => {
      const y = 2025 + Math.floor((8 + i) / 12);
      const m = ((8 + i) % 12) + 1;
      return { month: `${y}-${String(m).padStart(2, '0')}`, netWorth: (i + 1) * 600000 };
    });
    mockQuery(useOverviewData, { ...OVERVIEW, netWorthHistory: months });
    const result = await renderScreen();
    const label = () => String(result.getByLabelText(/Net worth at each month end/).props.accessibilityLabel);
    const count = () => (label().match(/Rp/g) ?? []).length;

    expect(result.getByTestId('overview-nw-range-1Y').props.accessibilityState).toMatchObject({ selected: true });
    expect(count()).toBe(12);
    await fireEvent.press(result.getByTestId('overview-nw-range-6M'));
    expect(count()).toBe(6);
    expect(result.getByTestId('overview-nw-range-6M').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(result.getByTestId('overview-nw-range-All'));
    expect(count()).toBe(14);
  });

  test('the scroll content clears the floating tab bar (112 plus the bottom inset, 0 here)', async () => {
    mockFilled();
    const result = await renderScreen();
    const style = Object.assign({}, ...[result.getByTestId('overview-scroll').props.contentContainerStyle].flat());
    expect(style.paddingBottom).toBe(112);
  });

  test('the greeting follows the time of day and says the name', async () => {
    mockFilled();
    for (const [kind, text] of [
      ['morning', 'Selamat pagi, Nael'],
      ['afternoon', 'Selamat siang, Nael'],
      ['late_afternoon', 'Selamat sore, Nael'],
      ['evening', 'Selamat malam, Nael'],
    ] as const) {
      (useGreeting as jest.Mock).mockReturnValueOnce(kind);
      const result = await renderScreen();
      expect(result.getByText(text)).toBeTruthy();
    }
  });

  test('after several opens the same day it asks how you are', async () => {
    mockFilled();
    (useGreeting as jest.Mock).mockReturnValueOnce('checkin');
    const result = await renderScreen();
    expect(result.getByText('Apa kabar, Nael?')).toBeTruthy();
    expect(result.queryByText(/Selamat/)).toBeNull();
  });

  test('English reads "Good morning, Nael" and "How are you, Nael?"', async () => {
    mockFilled();
    useLanguage.setState({ language: 'en' });
    const morning = await renderScreen();
    expect(morning.getByText('Good morning, Nael')).toBeTruthy();
    (useGreeting as jest.Mock).mockReturnValueOnce('checkin');
    const checkin = await renderScreen();
    expect(checkin.getByText('How are you, Nael?')).toBeTruthy();
  });

  test('until the greeting is known the line is empty, never drawn twice in two wordings', async () => {
    mockFilled();
    (useGreeting as jest.Mock).mockReturnValueOnce(null);
    const result = await renderScreen();
    expect(result.queryByText(/Selamat|Good|How are you|Apa kabar/)).toBeNull();
  });

  test('the name is the one saved in Settings; the avatar shows its first letter', async () => {
    mockFilled();
    (useDisplayName as jest.Mock).mockReturnValue('Budi');
    const named = await renderScreen();
    expect(named.getByText('Selamat pagi, Budi')).toBeTruthy();
    expect(named.getByTestId('overview-more-avatar')).toHaveTextContent('B');
    (useDisplayName as jest.Mock).mockReturnValue('Nael');
  });

  test('with no saved name the greeting has no name and the avatar shows the app letter', async () => {
    mockFilled();
    (useDisplayName as jest.Mock).mockReturnValue('');
    const unnamed = await renderScreen();
    expect(unnamed.getByTestId('overview-header-name').props.children).toBe('Selamat pagi');
    expect(unnamed.queryByText(/Nael/)).toBeNull();
    expect(unnamed.getByTestId('overview-more-avatar')).toHaveTextContent('M');
    (useDisplayName as jest.Mock).mockReturnValue('Nael');
  });

  test('the avatar opens /more', async () => {
    mockFilled();
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'More' }));
    expect(mockPush).toHaveBeenCalledWith('/more');
  });

  test('hidden mode masks every figure: hero, chip, Expenses/Income, net, legend, charts, table', async () => {
    mockFilled();
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await renderScreen();
    // No real number from the sample survives anywhere on the screen.
    for (const text of ['Rp8.880.000', 'Rp4.257.000', 'Rp7.500.000', '+Rp3.243.000', 'Rp3.243.000', 'Rp6.842.500', '33,5%', '57,53%', '77,05%', '3.243.000']) {
      expect(result.queryAllByText(new RegExp(text.replace(/[.+]/g, '\\$&'))).length).toBe(0);
    }
    expect(result.getByTestId('hero-balance').props.children).toBe('Rp••••••••');
    // The legend still names the categories, but its shares are masked.
    expect(result.getAllByText('••,••%').length).toBeGreaterThan(0);
  });

  test('one artwork sits behind the header and the hero together, clipped, with no fill on the hero', async () => {
    mockFilled();
    const result = await renderScreen();
    const flat = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    const top = result.getByTestId('overview-top');
    expect(flat(top)).toMatchObject({ position: 'relative', overflow: 'hidden' });
    expect(flat(top).backgroundColor).toBeUndefined();
    // The header and the hero are both children of that one container.
    expect(within(top).getByTestId('overview-header')).toBeTruthy();
    expect(within(top).getByTestId('overview-hero')).toBeTruthy();
    expect(flat(result.getByTestId('overview-hero')).backgroundColor).toBeUndefined();

    const image = result.getByTestId('overview-backdrop', { includeHiddenElements: true });
    const style = flat(image);
    // Drawn (no image file): pinned to the top-left, as wide as the container, 400:280 of the screen width.
    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0 });
    expect(style.height).toBeCloseTo((750 * 280) / 400, 5);
    expect(image.props.pointerEvents).toBe('none');
    expect(image.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  test('the Hide amounts button: an eye and its text on the right of the Net worth label, 44 high, full label for screen readers', async () => {
    mockFilled();
    const result = await renderScreen();
    const flat = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    const button = result.getByTestId('overview-hide-toggle');
    expect(flat(button)).toMatchObject({ minHeight: 44, justifyContent: 'flex-end' });
    expect(button.props.accessibilityLabel).toBe('Hide amounts');
    expect(within(button).getByText('Hide amounts')).toBeTruthy();
    expect(within(result.getByTestId('overview-hero')).getByText('Net worth')).toBeTruthy();
    await fireEvent.press(button);
    expect(useHideAmounts.getState().hidden).toBe(true);
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('under 360dp the button reads "Hide" but keeps its full accessibility label', async () => {
    mockFilled();
    setWindow({ width: 340 });
    const result = await renderScreen();
    expect(result.getByText('Hide')).toBeTruthy();
    expect(result.queryByText('Hide amounts')).toBeNull();
    expect(result.getByRole('button', { name: 'Hide amounts' })).toBeTruthy();
  });

  test('empty: header and hero with the artwork behind them and Rp0, the four steps and the privacy note; no charts', async () => {
    mockQuery(useAccountsOverview, { ...ACCOUNTS, accountCount: 0, groups: [], netWorth: 0 });
    mockQuery(useOverviewData, undefined);
    mockQuery(useRecurringDue, []);
    mockQuery(useBudgetOverview, undefined);
    mockQuery(useGoalProgress, []);
    mockQuery(useTransactionsList, undefined);
    const result = await renderScreen();
    expect(result.getByLabelText('MONO')).toBeTruthy();
    expect(result.getByTestId('overview-backdrop', { includeHiddenElements: true })).toBeTruthy();
    expect(result.getByText('Rp0')).toBeTruthy();
    expect(result.getByText('Set up in four steps')).toBeTruthy();
    expect(result.getByText('0 of 4 done')).toBeTruthy();
    expect(result.getByText('Create a backup')).toBeTruthy();
    expect(result.getByText('Private by design. No sign-up, no server, no sync. Records are stored on this phone and work offline.')).toBeTruthy();
    expect(result.queryByText('Cash flow')).toBeNull();
    await fireEvent.press(result.getByRole('button', { name: 'More' }));
    expect(mockPush).toHaveBeenCalledWith('/more');
  });
});
