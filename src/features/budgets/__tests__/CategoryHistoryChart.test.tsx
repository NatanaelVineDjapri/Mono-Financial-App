// The category's four-month bar chart: each bar carries its amount above it and its month under it, with no table
// beneath (the owner's choice), while the accessibility label still states every exact amount and the dashed limit
// line stays measured from the floor of the bars.
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CategoryHistoryChart } from '../CategoryHistoryChart';

const HISTORY = [
  { period: '2026-07', spent: 350_000 },
  { period: '2026-08', spent: 0 },
  { period: '2026-09', spent: 640_000 },
  { period: '2026-10', spent: 812_000 },
];

const hidden = { includeHiddenElements: true };

function renderChart(over: { hidden?: boolean; limit?: number } = {}) {
  return render(<CategoryHistoryChart history={HISTORY} limit={over.limit ?? 700_000} hidden={over.hidden ?? false} testID="chart" />);
}

describe('CategoryHistoryChart', () => {
  test('names every month under the bars and repeats no amount there', async () => {
    const view = await renderChart();
    for (const month of ['Jul', /^(Agu|Aug)$/, 'Sep', /^(Okt|Oct)$/]) expect(view.getByText(month, hidden)).toBeTruthy();
    for (const exact of ['Rp350.000', 'Rp0', 'Rp640.000', 'Rp812.000']) expect(view.queryByText(exact, hidden)).toBeNull();
  });

  test('the accessibility label states every month exactly, and the limit', async () => {
    const view = await renderChart();
    const label = String(view.getByRole('image').props.accessibilityLabel);
    for (const exact of ['Rp350.000', 'Rp0', 'Rp640.000', 'Rp812.000', 'Rp700.000']) expect(label).toContain(exact);
  });

  test('the dashed line sits at the limit, measured from the floor the bars stand on', async () => {
    // The tallest bar (812.000) is 120 high, so a 700.000 limit is 700/812 of that.
    const view = await renderChart();
    const style = StyleSheet.flatten(view.getByTestId('category-history-limit', hidden).props.style);
    expect(style.bottom).toBeCloseTo((700_000 / 812_000) * 120, 5);
    // Nothing else shares the box it is measured in: the month names are outside the 140 high plot.
    const plot = view.getByRole('image');
    expect(StyleSheet.flatten(plot.props.style).height).toBe(140);
    expect(plot.children).toHaveLength(2);
  });

  test('hidden amounts leave no figure in the label', async () => {
    const view = await renderChart({ hidden: true });
    expect(String(view.getByRole('image').props.accessibilityLabel)).not.toMatch(/\d{3}/);
  });
});
