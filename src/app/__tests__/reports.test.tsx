// Screen test for Reports (/reports): empty state, period stepper, range selector,
// cash flow, trend, categories, net worth, and CSV exports.
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useToastStore } from '@/components/toast-store';
import { setClockOverride } from '@/core/clock';
import type { ReportData } from '@/domain/reports';
import { createBalancesCsv, createTransactionsCsv } from '@/features/reports/createReportCsv';
import { useMonthStartDay, useReport } from '@/features/reports/useReport';
import ReportsScreen from '../reports';

jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => ({ fake: 'db' }),
}));

jest.mock('@/features/reports/useReport');
const mockUseMonthStartDay = useMonthStartDay as jest.MockedFunction<typeof useMonthStartDay>;
const mockUseReport = useReport as jest.MockedFunction<typeof useReport>;

jest.mock('@/features/reports/createReportCsv', () => ({
  createTransactionsCsv: jest.fn(),
  createBalancesCsv: jest.fn(),
}));
const mockCreateTransactionsCsv = createTransactionsCsv as jest.MockedFunction<typeof createTransactionsCsv>;
const mockCreateBalancesCsv = createBalancesCsv as jest.MockedFunction<typeof createBalancesCsv>;

jest.mock('react-native-gifted-charts', () => ({
  BarChart: 'BarChart',
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockBack }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>;

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: jest.fn() }) as never;

const SAMPLE_REPORT: ReportData = {
  period: '2026-10',
  range: 'month',
  rangePeriods: ['2026-10'],
  rangeStart: '2026-10-01',
  rangeEnd: '2026-10-28',
  flow: {
    income: 7500000,
    expense: 4257000,
    net: 3243000,
    savingsRateBp: 4324,
  },
  categories: [
    { id: 1, label: 'Food & drink', amount: 1425000, shareBp: 3347 },
    { id: 2, label: 'Bills', amount: 1150000, shareBp: 2701 },
  ],
  categoryTotal: 2575000,
  trend: [
    { period: '2026-05', income: 6800000, expense: 6800000, net: 0, partial: false },
    { period: '2026-06', income: 7000000, expense: 6600000, net: 400000, partial: false },
    { period: '2026-07', income: 7000000, expense: 6300000, net: 700000, partial: false },
    { period: '2026-08', income: 7200000, expense: 5800000, net: 1400000, partial: false },
    { period: '2026-09', income: 7000000, expense: 3900000, net: 3100000, partial: false },
    { period: '2026-10', income: 7500000, expense: 4300000, net: 3200000, partial: true },
  ],
  netWorthRows: [
    { month: '2026-05', netWorth: 0, change: null, partial: false },
    { month: '2026-06', netWorth: 400000, change: 400000, partial: false },
    { month: '2026-07', netWorth: 1100000, change: 700000, partial: false },
    { month: '2026-08', netWorth: 2500000, change: 1400000, partial: false },
    { month: '2026-09', netWorth: 5600000, change: 3100000, partial: false },
    { month: '2026-10', netWorth: 8900000, change: 3200000, partial: true },
  ],
  netWorth: 8880000,
  netWorthIncomplete: false,
  balanceMonthEnd: '2026-10-31',
  partialTrendPeriod: '2026-10',
  hasData: true,
  today: '2026-10-28',
  currentPeriod: '2026-10',
};

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setClockOverride('2026-10-28T10:00:00+07:00');
    mockUseMonthStartDay.mockReturnValue(1);
    mockUseReport.mockReturnValue(query(SAMPLE_REPORT));
  });

  afterEach(() => {
    setClockOverride(null);
  });

  test('displays loading spinner while query is loading', async () => {
    mockUseReport.mockReturnValue(query(null));
    const result = await render(wrap(<ReportsScreen />));
    expect(result.queryByTestId('reports-cash-flow')).toBeNull();
  });

  test('displays empty state when data is under one month', async () => {
    mockUseReport.mockReturnValue(query({ ...SAMPLE_REPORT, hasData: false }));
    const result = await render(wrap(<ReportsScreen />));
    expect(result.getByTestId('reports-empty')).toBeTruthy();
    expect(result.queryByTestId('reports-cash-flow')).toBeNull();
  });

  test('renders full report cards with data', async () => {
    const result = await render(wrap(<ReportsScreen />));

    // Cards are present
    expect(result.getByTestId('reports-cash-flow')).toBeTruthy();
    expect(result.getByTestId('reports-trend')).toBeTruthy();
    expect(result.getByTestId('reports-categories')).toBeTruthy();
    expect(result.getByTestId('reports-net-worth')).toBeTruthy();
    expect(result.getByTestId('reports-export')).toBeTruthy();

    // Cash flow numbers
    expect(result.getByText('+Rp7.500.000')).toBeTruthy();
    expect(result.getByText('−Rp4.257.000')).toBeTruthy();
    expect(result.getByText('+Rp3.243.000')).toBeTruthy();
    expect(result.getByText('43,24%')).toBeTruthy();

    // Category rows
    expect(result.getByText('Food & drink')).toBeTruthy();
    expect(result.getByText('33,47%')).toBeTruthy();
    expect(result.getByText('Bills')).toBeTruthy();
    expect(result.getByText('27,01%')).toBeTruthy();
  });

  test('range selector switches range state', async () => {
    const result = await render(wrap(<ReportsScreen />));
    const threeMonths = result.getByTestId('reports-range-3m');

    await act(async () => {
      fireEvent.press(threeMonths);
    });
    expect(mockUseReport).toHaveBeenCalledWith('2026-10', '3m');
  });

  test('header month chip opens month sheet and selecting month updates report query', async () => {
    const result = await render(wrap(<ReportsScreen />));
    const chip = result.getByTestId('reports-month-chip');

    await act(async () => {
      fireEvent.press(chip);
    });
    expect(result.getByTestId('budget-month-sheet')).toBeTruthy();

    const august = result.getByLabelText('August 2026');
    await act(async () => {
      fireEvent.press(august);
    });

    const confirm = result.getByRole('button', { name: 'Confirm' });
    await act(async () => {
      fireEvent.press(confirm);
    });

    expect(mockUseReport).toHaveBeenCalledWith('2026-08', 'month');
  });

  test('export transactions CSV triggers export and shows toast', async () => {
    mockCreateTransactionsCsv.mockResolvedValue({ ok: true, fileName: 'test.csv', rowCount: 10 });
    const result = await render(wrap(<ReportsScreen />));

    const exportBtn = result.getByTestId('reports-export-transactions');
    await act(async () => {
      fireEvent.press(exportBtn);
    });

    expect(mockCreateTransactionsCsv).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { start: '2026-10-01', end: '2026-10-28' },
    );
    expect(useToastStore.getState().visible).toBe(true);
  });

  test('export balances CSV triggers export', async () => {
    mockCreateBalancesCsv.mockResolvedValue({ ok: true, fileName: 'balances.csv', rowCount: 4 });
    const result = await render(wrap(<ReportsScreen />));

    const exportBtn = result.getByTestId('reports-export-balances');
    await act(async () => {
      fireEvent.press(exportBtn);
    });

    expect(mockCreateBalancesCsv).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { monthEnd: '2026-10-31' },
    );
    expect(useToastStore.getState().visible).toBe(true);
  });

  test('back button calls router.back', async () => {
    const result = await render(wrap(<ReportsScreen />));
    const backBtn = result.getByRole('button', { name: /Back to More|Kembali/i });

    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
