import { fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CategoryBudgetDetail } from '@/domain/budget';
import { useCategoryBudgetDetail } from '@/features/budgets/useBudgets';
import CategoryReviewScreen from '../[id]';

jest.mock('@/features/budgets/useBudgets');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '3', month: '2026-10' }),
}));

const mockUseDetail = useCategoryBudgetDetail as jest.MockedFunction<typeof useCategoryBudgetDetail>;
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const SHOPPING: CategoryBudgetDetail = {
  month: '2026-10',
  category: { id: 3, name: 'Shopping', kind: 'expense', icon: null },
  budget: {
    budget_id: 1,
    category_id: 3,
    category: 'Shopping',
    icon: null,
    limit_amount: 700000,
    spent: 812000,
    remaining: -112000,
    over_by: 112000,
    used_bp: 11600,
    is_over: 1,
    repeat: 1,
  },
  spent: 812000,
  monthlyLimit: 5000000,
  allocated: 5000000,
  transactions: [
    {
      id: 5,
      kind: 'expense',
      occurred_on: '2026-10-20',
      description: '',
      note: null,
      amount: 812000,
      amount_idr: 812000,
      currency: 'IDR',
      minor_factor: 1,
      amount_to: null,
      to_currency: null,
      category_id: 3,
      category_name: 'Shopping',
      account_id: 1,
      account_name: 'BCA Tabungan',
      to_account_id: null,
      to_account_name: null,
    },
  ],
  raise: { by: 112000, total: 5112000, monthlyLimit: 5000000, exceedsLimit: true },
};

async function renderScreen(data: CategoryBudgetDetail) {
  mockUseDetail.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() } as never);
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CategoryReviewScreen />
    </SafeAreaProvider>,
  );
}

describe('CategoryReviewScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('spent, the bar against its allocation and the over-by line', async () => {
    const result = await renderScreen(SHOPPING);
    expect(result.getByText('Shopping · October 2026')).toBeTruthy();
    const summary = within(result.getByTestId('category-summary'));
    expect(summary.getByText('Rp812.000')).toBeTruthy();
    expect(summary.getByText('Limit Rp700.000')).toBeTruthy();
    expect(summary.getByText('Over by Rp112.000')).toBeTruthy();
    expect(within(result.getByTestId('category-budget-bar')).getByRole('progressbar').props.accessibilityLabel).toBe(
      'Shopping: Rp812.000 spent of Rp700.000 limit, 116,00% used, over by Rp112.000',
    );
    expect(result.getByTestId('category-raise-note').props.children).toContain('Rp5.112.000');
  });

  test('lists its expenses and a tap opens /tx/[id]', async () => {
    const result = await renderScreen(SHOPPING);
    expect(result.getByText('1 item')).toBeTruthy();
    expect(within(result.getByTestId('category-tx-5')).getByText('BCA Tabungan · 20 Oct')).toBeTruthy();
    await fireEvent.press(result.getByTestId('category-tx-5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/[id]', params: { id: '5' } });
  });

  test('a month without transactions shows 0 spent and the empty list line', async () => {
    const result = await renderScreen({
      ...SHOPPING,
      budget: { ...SHOPPING.budget!, spent: 0, remaining: 700000, over_by: 0, used_bp: 0, is_over: 0 },
      spent: 0,
      transactions: [],
      raise: null,
    });
    expect(within(result.getByTestId('category-summary')).getByText('Rp0')).toBeTruthy();
    expect(within(result.getByTestId('category-summary')).getByText('Rp700.000 left')).toBeTruthy();
    expect(result.getByTestId('category-no-expenses')).toBeTruthy();
    expect(result.queryByTestId('category-raise-note')).toBeNull();
  });
});
