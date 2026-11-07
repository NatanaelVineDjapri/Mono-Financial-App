import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { BudgetCategoryRow, BudgetOverview } from '@/domain/budget';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import BudgetsScreen from '../budgets';

jest.mock('@/features/budgets/useBudgets');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockUseBudgetOverview = useBudgetOverview as jest.MockedFunction<typeof useBudgetOverview>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<BudgetsScreen />}</SafeAreaProvider>);
}

function row(categoryId: number, category: string, limit: number, spent: number, usedBp: number): BudgetCategoryRow {
  const remaining = limit - spent;
  return {
    budget_id: categoryId,
    category_id: categoryId,
    category,
    icon: null,
    limit_amount: limit,
    spent,
    remaining,
    over_by: Math.max(-remaining, 0),
    used_bp: usedBp,
    is_over: remaining < 0 ? 1 : 0,
    repeat: 1,
  };
}

// The sample October (CLAUDE.md "Sample data"), as getBudgetOverview returns it.
const OCTOBER: BudgetOverview = {
  month: '2026-10',
  limit: {
    month: '2026-10',
    monthly_limit: 5000000,
    limit_repeat: 1,
    allocated: 5000000,
    total_spent: 4257000,
    remaining: 743000,
    over_by: 0,
    used_bp: 8514,
  },
  totalSpent: 4257000,
  categories: [
    row(3, 'Shopping', 700000, 812000, 11600),
    row(4, 'Bills', 1200000, 1150000, 9583),
    row(2, 'Transport', 600000, 540000, 9000),
    row(1, 'Food & drink', 1800000, 1425000, 7917),
    row(6, 'Leisure', 400000, 210000, 5250),
    row(5, 'Health', 300000, 120000, 4000),
  ],
  currentMonth: '2026-10',
  isCurrent: true,
  previousMonth: '2026-09',
  nextMonth: null,
  months: ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06'],
  daysLeft: 3,
  availablePerDay: 247667,
  isEmpty: false,
  monthCreated: false,
};

const EMPTY_SEPTEMBER: BudgetOverview = {
  ...OCTOBER,
  month: '2026-09',
  limit: null,
  totalSpent: 0,
  categories: [],
  isCurrent: false,
  previousMonth: null,
  nextMonth: '2026-10',
  daysLeft: null,
  availablePerDay: null,
  isEmpty: true,
};

function mockData(data: BudgetOverview) {
  mockUseBudgetOverview.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() } as never);
}

describe('BudgetsScreen', () => {
  beforeEach(async () => {
    await act(() => useHideAmounts.getState().setHidden(false));
    jest.clearAllMocks();
  });

  test('the monthly limit card: spent, limit, share used, remaining, days left and per day', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    const card = within(result.getByTestId('budget-month-card'));

    expect(card.getByText('Rp4.257.000')).toBeTruthy();
    expect(card.getByText('Limit Rp5.000.000')).toBeTruthy();
    expect(card.getByText('85,14% used')).toBeTruthy();
    expect(card.getByText('Rp743.000 remaining')).toBeTruthy();
    expect(card.getByText('Days left in October')).toBeTruthy();
    expect(card.getByText('3')).toBeTruthy();
    expect(card.getByText('Rp247.667')).toBeTruthy();
  });

  test('header: serif title left, month chip and edit button right in the Filters style, 8 apart, padding 16, 16 to the card', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

    const header = result.getByTestId('budgets-header');
    expect(flat(header.props.style)).toMatchObject({ paddingRight: 16, paddingBottom: 16 });
    expect(flat(result.getByText('Budgets').props.style).fontFamily).toBe('Newsreader_400Regular');

    const chip = result.getByTestId('budget-month-chip');
    const edit = result.getByTestId('budget-edit-limit');
    expect(flat(chip.parent!.props.style)).toMatchObject({ flexDirection: 'row', gap: 8 });
    expect(chip.parent).toBe(edit.parent);
    const shared = { borderRadius: 10, borderWidth: 1, borderColor: '#2B2B2B', backgroundColor: '#171717' };
    expect(flat(chip.props.style)).toMatchObject({ ...shared, minHeight: 40, paddingHorizontal: 14, gap: 8 });
    expect(flat(edit.props.style)).toMatchObject({ ...shared, width: 40, height: 40 });

    const chipText = within(chip).getByText('Oct 2026');
    expect(flat(chipText.props.style)).toMatchObject({ fontSize: 14, fontFamily: 'IBMPlexSans_400Regular', color: '#F5F5F5' });
    expect(chipText.props.numberOfLines).toBeUndefined();
    expect(result.getByTestId('budget-month-chip-icon', { includeHiddenElements: true }).props.width).toBe(20);
    expect(result.getByTestId('budget-edit-limit-icon', { includeHiddenElements: true }).props.width).toBe(20);

    expect(chip.props.accessibilityLabel).toBe('Month: October 2026. Change month');
    expect(edit.props.accessibilityLabel).toBe('Edit monthly limit');
    // The old prev/next arrow row is gone; the Total spent card sits right under the header.
    expect(result.queryByTestId('month-previous')).toBeNull();
    expect(result.queryByTestId('month-next')).toBeNull();
    expect(within(result.getByTestId('budgets-scroll')).getByTestId('budget-month-card')).toBeTruthy();
  });

  test('the hero total uses the serif title family (Newsreader), like the screen title', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    const hero = within(result.getByTestId('budget-month-card')).getByText('Rp4.257.000');
    const style = Object.assign({}, ...[hero.props.style].flat(Infinity).filter(Boolean));
    expect(style.fontFamily).toBe('Newsreader_400Regular');
  });

  test('every bar carries the exact figures in its accessibility label', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    expect(within(result.getByTestId('budget-month-bar')).getByRole('progressbar').props.accessibilityLabel).toBe(
      'October 2026 total: Rp4.257.000 spent of Rp5.000.000 limit, 85,14% used, Rp743.000 remaining',
    );
    expect(within(result.getByTestId('budget-category-4-bar')).getByRole('progressbar').props.accessibilityLabel).toBe(
      'Bills: Rp1.150.000 spent of Rp1.200.000 limit, 95,83% used, Rp50.000 left',
    );
    expect(within(result.getByTestId('budget-category-3-bar')).getByRole('progressbar').props.accessibilityLabel).toBe(
      'Shopping: Rp812.000 spent of Rp700.000 limit, 116,00% used, over by Rp112.000',
    );
  });

  test('over limit: "Over by Rp112.000" in red, the share used stays neutral, others show what is left', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    const shopping = within(result.getByTestId('budget-category-3'));

    const over = shopping.getByText('Over by Rp112.000');
    expect(Object.assign({}, ...[over.props.style].flat()).color).toBe('#FF6B6B');
    const used = shopping.getByText('116,00% used');
    expect(Object.assign({}, ...[used.props.style].flat()).color).not.toBe('#FF6B6B');
    expect(shopping.queryByText(/left$/)).toBeNull();

    expect(within(result.getByTestId('budget-category-4')).getByText('Rp50.000 left')).toBeTruthy();
    // Only the amount over is red: no other text on the screen is.
    const redTexts = result
      .queryAllByText(/.+/)
      .filter(node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)).color === '#FF6B6B');
    expect(redTexts.map(node => node.props.children)).toEqual(['Over by Rp112.000']);
  });

  test('over limit keeps the bar full (amber to the limit) with a separate overflow segment', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    const bar = within(result.getByTestId('budget-category-3-bar')).getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 116 });
    // The wavy fill is drawn in amber by Skia, so only its width is a style here.
    const fill = result.getByTestId('budget-category-3-bar-fill');
    const overflow = result.getByTestId('budget-category-3-bar-overflow');
    const fillStyle = Object.assign({}, ...[fill.props.style].flat());
    const overflowStyle = Object.assign({}, ...[overflow.props.style].flat());
    expect(overflowStyle.backgroundColor).toBeUndefined(); // striped, never a flat red fill
    expect(parseFloat(fillStyle.width) + parseFloat(overflowStyle.width)).toBeCloseTo(100);
  });

  test('hidden mode masks every amount, including the over-by text and the bar labels', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    mockData(OCTOBER);
    const result = await renderScreen();
    expect(result.queryByText('Rp4.257.000')).toBeNull();
    expect(result.queryByText('Over by Rp112.000')).toBeNull();
    expect(result.getByText('Over by Rp••••••••')).toBeTruthy();
    expect(within(result.getByTestId('budget-category-3-bar')).getByRole('progressbar').props.accessibilityLabel).not.toMatch(/\d{3}\.\d{3}/);
  });

  test('month chip opens the month list; picking September only asks for that month after Confirm', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    expect(result.queryByTestId('budget-month-sheet')).toBeNull();

    await fireEvent.press(result.getByTestId('budget-month-chip'));
    expect(result.getByText('Choose month')).toBeTruthy();
    expect(result.getByText('Select a month from 2026')).toBeTruthy();
    expect(result.getByTestId('budget-month-option-2026-10').props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByTestId('budget-month-option-2026-06')).toBeTruthy();

    // A tap only moves the draft: the check follows it, the screen's month does not.
    await fireEvent.press(result.getByTestId('budget-month-option-2026-09'));
    expect(result.getByTestId('budget-month-option-2026-09').props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByTestId('budget-month-option-2026-10').props.accessibilityState).toMatchObject({ selected: false });
    expect(mockUseBudgetOverview).not.toHaveBeenLastCalledWith('2026-09');

    await fireEvent.press(result.getByTestId('budget-month-confirm'));
    expect(mockUseBudgetOverview).toHaveBeenLastCalledWith('2026-09');
  });

  test('Cancel and the close button discard the draft; reopening starts from the screen\'s month', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();

    await fireEvent.press(result.getByTestId('budget-month-chip'));
    await fireEvent.press(result.getByTestId('budget-month-option-2026-08'));
    await fireEvent.press(result.getByTestId('budget-month-cancel'));
    expect(mockUseBudgetOverview).not.toHaveBeenLastCalledWith('2026-08');

    await fireEvent.press(result.getByTestId('budget-month-chip'));
    expect(result.getByTestId('budget-month-option-2026-10').props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByTestId('budget-month-option-2026-08').props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(result.getByTestId('budget-month-option-2026-07'));
    await fireEvent.press(result.getByTestId('budget-month-close'));
    expect(mockUseBudgetOverview).not.toHaveBeenLastCalledWith('2026-07');
  });

  test('the month list hides the tab bar while open and restores it on close', async () => {
    const { useTabBarVisibility } = jest.requireActual<typeof import('@/components/tab-bar-visibility-store')>('@/components/tab-bar-visibility-store');
    mockData(OCTOBER);
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('budget-month-chip'));
    expect(useTabBarVisibility.getState().hidden).toBe(true);
    // The sheet panel is accessibilityViewIsModal, which hides its sibling scrim from queries.
    await fireEvent.press(result.getByTestId('budget-month-sheet-scrim', { includeHiddenElements: true }));
    expect(useTabBarVisibility.getState().hidden).toBe(false);
  });

  test('the empty state keeps the month chip so another month can be picked', async () => {
    mockData(EMPTY_SEPTEMBER);
    const result = await renderScreen();
    expect(within(result.getByTestId('budget-month-chip')).getByText('Sep 2026')).toBeTruthy();
  });

  test('empty state when the month has no budget, and "Add budget" starts with the monthly limit', async () => {
    mockData(EMPTY_SEPTEMBER);
    const result = await renderScreen();
    expect(result.getByTestId('budgets-empty')).toBeTruthy();
    expect(result.getByText('No budget for September 2026')).toBeTruthy();
    await fireEvent.press(result.getByRole('button', { name: 'Add budget' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget/edit', params: { month: '2026-09', mode: 'limit' } });
  });

  test('tapping a category opens its spending review for the shown month', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('budget-row-3'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget/category/[id]', params: { id: '3', month: '2026-10' } });
  });

  test('"Add category budget" opens the create form for the shown month', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Add category budget' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget/edit', params: { month: '2026-10' } });
  });

  test('figures never truncate (no numberOfLines) so they wrap at 200% text', async () => {
    mockData(OCTOBER);
    const result = await renderScreen();
    for (const text of ['Rp4.257.000', 'Rp812.000', 'Over by Rp112.000', 'Rp247.667']) {
      expect(result.getByText(text).props.numberOfLines).toBeUndefined();
    }
  });
});
