import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Dimensions, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountsOverview } from '@/domain/balances';
import type { OverviewData } from '@/domain/overview';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import { useGoalProgress, useOverviewData } from '@/features/overview/useOverview';
import { useRecurringDue } from '@/features/recurring/useRecurringDue';
import { useGreeting } from '@/features/overview/useGreeting';
import { useDisplayName } from '@/features/settings/useDisplayName';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';
import { useLanguage } from '@/i18n/lang';
import { MonoColors } from '@/theme/tokens';
import OverviewScreen from '../index';

jest.mock('@/features/accounts/useAccountsOverview');
jest.mock('@/features/overview/useOverview');
jest.mock('@/features/recurring/useRecurringDue');
jest.mock('@/features/budgets/useBudgets');
jest.mock('@/features/transactions/useTransactionsList');
jest.mock('@/features/overview/useGreeting', () => ({ useGreeting: jest.fn(() => 'morning') }));
jest.mock('@/features/settings/useDisplayName', () => ({ ...jest.requireActual('@/features/settings/useDisplayName'), useDisplayName: jest.fn(() => 'Nael') }));

// A controllable window width (the Hide button's label depends on it).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions');
const mockWindow = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;
function setWindow(overrides: Partial<ReturnType<typeof useWindowDimensions>> = {}) {
  mockWindow.mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 1, ...overrides });
}

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<OverviewScreen />}</SafeAreaProvider>);
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

const OVERVIEW: OverviewData = {
  period: '2026-10',
  previousPeriod: '2026-09',
  month: { income: 7500000, expense: 4257000, net: 3243000 },
  previous: { income: 7000000, expense: 3940000, net: 3060000 },
  expenseChangeBp: 805,
  incomeChangeBp: 714,
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

function mockFilled() {
  mockQuery(useAccountsOverview, ACCOUNTS);
  mockQuery(useOverviewData, OVERVIEW);
  mockQuery(useRecurringDue, []);
  mockQuery(useBudgetOverview, BUDGET);
  mockQuery(useGoalProgress, GOALS);
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
    expect(result.getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(result.getByText('Selamat pagi, Nael')).toBeTruthy();
    expect(result.getByTestId('hero-balance').props.children).toBe('Rp8.880.000');
    expect(result.getByText('+Rp3.243.000 (+57,53%)')).toBeTruthy();
    expect(result.getByText('vs 30 Sep 2026')).toBeTruthy();
    // The second line: year to date, vs the end of last year.
    expect(result.getByText('+Rp4.120.000 (+86,61%)')).toBeTruthy();
    expect(result.getByText('YTD · vs 31 Dec 2025')).toBeTruthy();
    expect(within(result.getByTestId('overview-expenses-card')).getByText('Expenses')).toBeTruthy();
    expect(result.getAllByText('Rp4.257.000').length).toBeGreaterThan(0);
    expect(result.getByText('8,05% vs Sep')).toBeTruthy();
    expect(result.getByText('7,14% vs Sep')).toBeTruthy();
    expect(result.getByText('Net cash flow · Oct')).toBeTruthy();
    expect(result.getByText('Consumption only. Transfers between your accounts are excluded.')).toBeTruthy();
    expect(result.getByTestId('overview-account-1')).toBeTruthy();
    expect(result.getByText('Cash flow')).toBeTruthy();
    expect(result.getByText('Top categories')).toBeTruthy();
    expect(result.getAllByText('33,5%').length).toBeGreaterThan(0); // the ring's centre and its legend
    expect(within(result.getByTestId('overview-top-legend')).getByText('Others')).toBeTruthy(); // the ring folds categories; accounts below are never folded
    expect(result.getByText('Fixed expenses')).toBeTruthy();
    expect(result.getByText('Recent transactions')).toBeTruthy();
    expect(result.getByText('Budget · Oct 2026')).toBeTruthy();
    expect(result.getByText('Shopping is over its limit by Rp112.000')).toBeTruthy();
    expect(result.getByText('Total assets')).toBeTruthy();
    expect(result.getByText('Net worth history')).toBeTruthy();
    expect(result.getByText('Where your money is')).toBeTruthy();
  });

  test('positive money is green, never gold: hero chip, Income change and Net cash flow; Expenses stay neutral', async () => {
    mockFilled();
    const result = await renderScreen();
    const style = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    expect(MonoColors.positive).toBe('#4ADE80');
    expect(MonoColors.positive).not.toBe(MonoColors.accent);

    expect(style(result.getByText('+Rp3.243.000 (+57,53%)')).color).toBe(MonoColors.positive);
    expect(style(result.getByText('7,14% vs Sep')).color).toBe(MonoColors.positive);
    expect(style(result.getByText('8,05% vs Sep')).color).toBe(MonoColors.textSecond);
    const net = within(result.getByTestId('overview-net-cash-flow')).getByText('+Rp3.243.000');
    expect(style(net).color).toBe(MonoColors.positive);
  });

  test('the YTD line sits under the month line, in the same green; with no earlier month end it is not drawn', async () => {
    mockFilled();
    const result = await renderScreen();
    const style = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    expect(style(result.getByText('+Rp4.120.000 (+86,61%)')).color).toBe(MonoColors.positive);
    expect(result.getByTestId('hero-change-ytd').props.accessibilityLabel).toBe('Year to date +Rp4.120.000 (+86,61%) vs 31 Dec 2025');

    mockQuery(useOverviewData, { ...OVERVIEW, netWorthYtdChange: null, netWorthYtdBp: null, netWorthYtdVsDate: null });
    const without = await renderScreen();
    expect(without.queryByTestId('hero-change-ytd')).toBeNull();
    expect(without.getByTestId('hero-change')).toBeTruthy(); // the month line is unaffected
  });

  test('a falling net worth turns the hero chip red (with its minus and a down triangle)', async () => {
    mockFilled();
    mockQuery(useOverviewData, { ...OVERVIEW, netWorthChange: -500000, netWorthChangeBp: -533 });
    const result = await renderScreen();
    const text = result.getByText('−Rp500.000 (−5,33%)');
    expect(Object.assign({}, ...[text.props.style].flat(Infinity).filter(Boolean)).color).toBe(MonoColors.negative);
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

  test('the carousel is a coverflow: snaps one card (260) at a time, first card centred, one dot per account', async () => {
    mockFilled();
    const result = await renderScreen();
    const carousel = result.getByTestId('overview-account-carousel');
    expect(carousel.props.snapToInterval).toBe(260);
    expect(carousel.props.decelerationRate).toBe('fast');
    // The first card starts centred: side padding is (window width - 300) / 2.
    const style = Object.assign({}, ...[carousel.props.contentContainerStyle].flat());
    expect(style.paddingHorizontal).toBe((Dimensions.get('window').width - 300) / 2);
    expect(result.getAllByTestId(/^overview-account-dot-/, { includeHiddenElements: true })).toHaveLength(4);
  });

  test('the carousel loops: the last account also sits to the left of the first (and the first right of the last)', async () => {
    mockFilled();
    const result = await renderScreen();
    // 4 accounts give 5 copies of the list. The middle copy is the real one; the copies
    // before and after it supply the left and right neighbours.
    for (const id of [1, 2, 3, 4]) {
      for (const copy of [0, 1, 3, 4]) {
        expect(result.getByTestId(`overview-account-${id}-copy-${copy}`, { includeHiddenElements: true })).toBeTruthy();
      }
      expect(result.getByTestId(`overview-account-${id}`)).toBeTruthy();
    }
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
    expect(cash.getByText('Last 6 months · axis in Rp million')).toBeTruthy();
    const worth = within(result.getByTestId('overview-net-worth-history'));
    for (const tick of ['0', '10', '20', '30']) expect(worth.getByText(tick, { includeHiddenElements: true })).toBeTruthy();
    expect(worth.getByText('Goal · Rp30 jt')).toBeTruthy();
    expect(worth.getByText('8,9 jt')).toBeTruthy();
  });

  test('hidden mode masks the axis labels and the chart callouts too', async () => {
    mockFilled();
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await renderScreen();
    const worth = within(result.getByTestId('overview-net-worth-history'));
    expect(worth.queryByText('30', { includeHiddenElements: true })).toBeNull();
    expect(worth.queryByText('8,9 jt')).toBeNull();
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

  test('with no saved name the owner\'s own name stands in, on the greeting and on the avatar', async () => {
    mockFilled();
    (useDisplayName as jest.Mock).mockReturnValue('');
    const unnamed = await renderScreen();
    expect(unnamed.getByText('Selamat pagi, Nael')).toBeTruthy();
    expect(unnamed.getByTestId('overview-more-avatar')).toHaveTextContent('N');
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
    for (const text of ['Rp8.880.000', 'Rp4.257.000', 'Rp7.500.000', '+Rp3.243.000', 'Rp3.243.000', 'Rp6.842.500', '33,5%', '8,05%', '7,14%', '57,53%', '77,05%', '4.120.000', '86,61%']) {
      expect(result.queryAllByText(new RegExp(text.replace(/[.+]/g, '\\$&'))).length).toBe(0);
    }
    expect(result.getByTestId('hero-balance').props.children).toBe('Rp••••••••');
    expect(result.getAllByText('••,••% vs Sep').length).toBe(2); // Expenses and Income cards
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

  test('the Hide amounts button is plain text: no fill, no border, 13/18, the same grey as NET WORTH, 44 high', async () => {
    mockFilled();
    const result = await renderScreen();
    const flat = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    const style = flat(result.getByTestId('overview-hide-toggle'));
    expect(style).toMatchObject({ minHeight: 44, justifyContent: 'flex-end' });
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
    expect(flat(result.getByText('Hide amounts'))).toMatchObject({ color: '#8A8A8A', fontSize: 13, lineHeight: 18, fontFamily: 'IBMPlexSans_500Medium' });
    expect(flat(within(result.getByTestId('overview-hero')).getByText('Net worth')).color).toBe('#8A8A8A');
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
