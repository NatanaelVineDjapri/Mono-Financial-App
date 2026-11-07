import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { BudgetFormContext } from '@/domain/budget';
import { saveBudget, setMonthlyLimit } from '@/domain/budget';
import { useBudgetFormContext } from '@/features/budgets/useBudgets';
import BudgetEditScreen from '../edit';

jest.mock('@/features/budgets/useBudgets');
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));
// The pure allocation check stays real; only the writes are replaced.
jest.mock('@/domain/budget', () => ({
  ...jest.requireActual('@/domain/budget'),
  saveBudget: jest.fn(() => Promise.resolve(1)),
  setMonthlyLimit: jest.fn(() => Promise.resolve()),
}));

let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockUseBudgetFormContext = useBudgetFormContext as jest.MockedFunction<typeof useBudgetFormContext>;
const mockSaveBudget = saveBudget as jest.MockedFunction<typeof saveBudget>;
const mockSetMonthlyLimit = setMonthlyLimit as jest.MockedFunction<typeof setMonthlyLimit>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <BudgetEditScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

// The sample October: six budgets that use the whole Rp5.000.000 limit.
const BUDGETS = [
  { id: 4, category_id: 1, category: 'Food & drink', limit_amount: 1800000, repeat: 1 },
  { id: 3, category_id: 2, category: 'Transport', limit_amount: 600000, repeat: 1 },
  { id: 1, category_id: 3, category: 'Shopping', limit_amount: 700000, repeat: 1 },
  { id: 2, category_id: 4, category: 'Bills', limit_amount: 1200000, repeat: 1 },
  { id: 6, category_id: 5, category: 'Health', limit_amount: 300000, repeat: 1 },
  { id: 5, category_id: 6, category: 'Leisure', limit_amount: 400000, repeat: 1 },
];

function context(overrides: Partial<BudgetFormContext> = {}): BudgetFormContext {
  return {
    month: '2026-10',
    monthlyLimit: { amount: 5000000, repeat: true },
    budgets: BUDGETS,
    availableCategories: [
      { id: 7, name: 'Housing' },
      { id: 8, name: 'Education' },
      { id: 9, name: 'Gifts' },
      { id: 10, name: 'Other' },
    ],
    editing: null,
    ...overrides,
  };
}

function mockContext(data: BudgetFormContext) {
  mockUseBudgetFormContext.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() } as never);
}

function saveButton(result: Awaited<ReturnType<typeof renderScreen>>) {
  return result.getByTestId('budget-save');
}

async function pickHousingAndType(result: Awaited<ReturnType<typeof renderScreen>>, amount: string) {
  await fireEvent.press(result.getByTestId('budget-category-chip-7'));
  await fireEvent.changeText(result.getByTestId('budget-amount-input'), amount);
}

describe('BudgetEditScreen — allocation check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { month: '2026-10' };
  });

  test('over (the board): Rp5.000.000 allocated + Rp500.000 blocks Save with the catalogue message', async () => {
    mockContext(context());
    const result = await renderScreen();
    await pickHousingAndType(result, '500000');

    const check = within(result.getByTestId('allocation-check'));
    expect(within(result.getByTestId('allocation-limit')).getByText('Rp5.000.000')).toBeTruthy();
    expect(within(result.getByTestId('allocation-allocated')).getByText('Already allocated, 6 categories')).toBeTruthy();
    expect(within(result.getByTestId('allocation-this')).getByText('+Rp500.000')).toBeTruthy();
    expect(within(result.getByTestId('allocation-total')).getByText('Rp5.500.000')).toBeTruthy();
    expect(check.getByText('Over the monthly limit by Rp500.000.')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByText('2 · Monthly limit for Housing')).toBeTruthy();
  });

  test('"Raise monthly limit to Rp5.500.000" makes it fit exactly and saves both in one call', async () => {
    mockContext(context());
    const result = await renderScreen();
    await pickHousingAndType(result, '500000');
    await fireEvent.press(result.getByRole('button', { name: 'Raise monthly limit to Rp5.500.000' }));

    expect(within(result.getByTestId('allocation-limit')).getByText('Rp5.500.000')).toBeTruthy();
    expect(within(result.getByTestId('allocation-limit')).getByText('Raised from Rp5.000.000')).toBeTruthy();
    expect(result.getByTestId('allocation-exact')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: false });

    await fireEvent.press(saveButton(result));
    expect(mockSaveBudget).toHaveBeenCalledWith({}, { month: '2026-10', categoryId: 7, limitAmount: 500000, repeat: true, monthlyLimit: 5500000 });
    expect(mockBack).toHaveBeenCalled();
  });

  test('under: names the unallocated rest and allows saving without touching the limit', async () => {
    mockContext(context({ monthlyLimit: { amount: 6000000, repeat: true } }));
    const result = await renderScreen();
    await pickHousingAndType(result, '500000');

    expect(result.getByText('Rp500.000 of the monthly limit is not allocated yet.')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(saveButton(result));
    expect(mockSaveBudget).toHaveBeenCalledWith({}, expect.objectContaining({ categoryId: 7, limitAmount: 500000, monthlyLimit: undefined }));
  });

  test('exact: the whole limit allocated is allowed', async () => {
    mockContext(context({ monthlyLimit: { amount: 5500000, repeat: true } }));
    const result = await renderScreen();
    await pickHousingAndType(result, '500000');
    expect(result.getByText('The whole monthly limit is allocated.')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: false });
  });

  test('missing category and amount: Save names both instead of writing', async () => {
    mockContext(context({ monthlyLimit: { amount: 6000000, repeat: true } }));
    const result = await renderScreen();
    await fireEvent.press(saveButton(result));
    expect(result.getByText('Choose a category.')).toBeTruthy();
    expect(result.getByText('Enter an amount above Rp0.')).toBeTruthy();
    expect(mockSaveBudget).not.toHaveBeenCalled();
  });
});

describe('BudgetEditScreen — edit mode uses the same form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { month: '2026-10', categoryId: '3' };
  });

  test('prefills the budget and counts only the other five categories', async () => {
    mockContext(context({ editing: BUDGETS[2] }));
    const result = await renderScreen();

    expect(result.getByText('Edit category budget')).toBeTruthy();
    expect(result.getByTestId('budget-amount-input').props.value).toBe('Rp700.000');
    expect(within(result.getByTestId('allocation-allocated')).getByText('Already allocated, 5 categories')).toBeTruthy();
    expect(within(result.getByTestId('allocation-allocated')).getByText('Rp4.300.000')).toBeTruthy();
    expect(result.getByTestId('allocation-exact')).toBeTruthy();
  });

  test('raising Shopping by Rp112.000 goes over and disables Save', async () => {
    mockContext(context({ editing: BUDGETS[2] }));
    const result = await renderScreen();
    await fireEvent.changeText(result.getByTestId('budget-amount-input'), '812000');
    expect(result.getByText('Over the monthly limit by Rp112.000.')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('BudgetEditScreen — monthly limit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { month: '2026-10', mode: 'limit' };
  });

  test('lowering the limit below the allocated budgets is blocked', async () => {
    mockContext(context());
    const result = await renderScreen();
    await fireEvent.changeText(result.getByTestId('budget-amount-input'), '4500000');
    expect(result.getByText('Over the monthly limit by Rp500.000.')).toBeTruthy();
    expect(saveButton(result).props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('a first limit for an empty month saves through setMonthlyLimit', async () => {
    mockContext(context({ monthlyLimit: null, budgets: [] }));
    const result = await renderScreen();
    await fireEvent.changeText(result.getByTestId('budget-amount-input'), '5000000');
    expect(result.getByText('Rp5.000.000 of the monthly limit is not allocated yet.')).toBeTruthy();
    await fireEvent.press(saveButton(result));
    expect(mockSetMonthlyLimit).toHaveBeenCalledWith({}, '2026-10', 5000000, true);
  });
});
