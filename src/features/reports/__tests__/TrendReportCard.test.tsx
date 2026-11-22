// "Six-month trend" is drawn like the Overview's cash flow bars: gold income against grey expenses, a labelled y axis with its
// gridlines, the month under each pair, the legend next to the title. The exact values stay in the table beneath.
import { act, render } from '@testing-library/react-native';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { ReportTrendRow } from '@/domain/reports';
import { expensesCardLabel, incomeCardLabel, reportsSixMonthTrendTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';

import { TrendReportCard } from '../TrendReportCard';

// The chart library is replaced by a component that remembers what it was asked to draw.
let mockBarProps: Record<string, any> = {};
jest.mock('react-native-gifted-charts', () => ({
  BarChart: (props: Record<string, any>) => {
    mockBarProps = props;
    return null;
  },
}));

const ROWS: ReportTrendRow[] = [
  { period: '2026-06', income: 7_500_000, expense: 0, net: 7_500_000, partial: false },
  { period: '2026-07', income: 0, expense: 0, net: 0, partial: false },
  { period: '2026-08', income: 0, expense: 4_100_000, net: -4_100_000, partial: false },
  { period: '2026-09', income: 0, expense: 600_000, net: -600_000, partial: false },
  { period: '2026-10', income: 7_500_000, expense: 4_300_000, net: 3_200_000, partial: false },
  { period: '2026-11', income: 14_400_000, expense: 11_500_000, net: 2_900_000, partial: true },
];

const bars = (_view: unknown) => mockBarProps;

describe('TrendReportCard', () => {
  afterEach(async () => await act(async () => useHideAmounts.getState().setHidden(false)));

  test('a pair of bars per month: income gold, expenses grey, the month under the pair', async () => {
    const props = bars(await render(<TrendReportCard rows={ROWS} today="2026-11-22" partialPeriod="2026-11" />));
    expect(props.data).toHaveLength(12);
    const incomes = props.data.filter((_: unknown, i: number) => i % 2 === 0);
    const expenses = props.data.filter((_: unknown, i: number) => i % 2 === 1);
    expect(incomes.every((d: { frontColor: string }) => d.frontColor === MonoColors.accent)).toBe(true);
    expect(expenses.every((d: { frontColor: string }) => d.frontColor === MonoColors.textDisabled)).toBe(true);
    expect(incomes.map((d: { label: string }) => d.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
    expect(expenses.every((d: { label: string }) => d.label === '')).toBe(true);
    expect(props.data.map((d: { value: number }) => d.value)).toEqual([7_500_000, 0, 0, 0, 0, 4_100_000, 0, 600_000, 7_500_000, 4_300_000, 14_400_000, 11_500_000]);
  });

  test('has the Overview axis: gridlines and labelled ticks up to a round ceiling that covers the biggest bar', async () => {
    const props = bars(await render(<TrendReportCard rows={ROWS} today="2026-11-22" partialPeriod="2026-11" />));
    expect(props.hideRules).toBe(false);
    expect(props.rulesColor).toBe(MonoColors.border);
    expect(props.maxValue).toBeGreaterThanOrEqual(14_400_000);
    expect(props.noOfSections).toBe(props.yAxisLabelTexts.length - 1);
    expect(props.yAxisLabelTexts[0]).toBe('0');
    expect(props.hideYAxisText).toBe(false);
  });

  test('Hide amounts takes the amounts off the axis', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    const props = bars(await render(<TrendReportCard rows={ROWS} today="2026-11-22" partialPeriod="2026-11" />));
    expect(props.hideYAxisText).toBe(true);
  });

  test('with nothing recorded the axis is still a sane one, not a flat line', async () => {
    const empty = ROWS.map(row => ({ ...row, income: 0, expense: 0, net: 0 }));
    const props = bars(await render(<TrendReportCard rows={empty} today="2026-11-22" partialPeriod={null} />));
    expect(props.maxValue).toBeGreaterThan(0);
    expect(props.yAxisLabelTexts.length).toBeGreaterThan(1);
  });

  test('the legend sits beside the title, and the exact values are still in the table beneath', async () => {
    const view = await render(<TrendReportCard rows={ROWS} today="2026-11-22" partialPeriod="2026-11" />);
    expect(view.getByRole('header', { name: reportsSixMonthTrendTitle() })).toBeTruthy();
    // the legend names both series (the table's column heads say them again, hence "at least one")
    expect(view.getAllByText(incomeCardLabel()).length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText(expensesCardLabel()).length).toBeGreaterThanOrEqual(1);
    expect(view.getByTestId('reports-trend-table')).toBeTruthy();
  });
});
