// The balance line of the account detail (and any screen that wants the net cash flow look): the curve never overshoots
// the balances it joins, the axis labels follow Hide amounts, and touching the plot reads out the point under the finger.
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LineAreaChart, linePath } from '../LineAreaChart';

describe('linePath', () => {
  const numbers = (d: string) => d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);

  test('is empty without points, and a bare move for one point', () => {
    expect(linePath([])).toBe('');
    expect(linePath([{ x: 5, y: 7 }])).toBe('M 5 7');
  });

  test('a steep rise followed by a flat run never swings past the balances it joins', () => {
    // y grows downward: a rise is a smaller y. 0.3 -> 1.3 -> 1.3 -> 1.3 as in an account that was topped up once.
    const points = [
      { x: 0, y: 120 },
      { x: 40, y: 20 },
      { x: 80, y: 20 },
      { x: 120, y: 20 },
    ];
    const n = numbers(linePath(points));
    // M x y, then 3 segments of C c1x c1y c2x c2y x y: every control point's y stays between the two points of its segment
    for (let seg = 0; seg < 3; seg++) {
      const base = 2 + seg * 6;
      const [c1y, c2y] = [n[base + 1], n[base + 3]];
      const ys = [points[seg].y, points[seg + 1].y];
      for (const y of [c1y, c2y]) {
        expect(y).toBeGreaterThanOrEqual(Math.min(...ys));
        expect(y).toBeLessThanOrEqual(Math.max(...ys));
      }
    }
  });
});

describe('LineAreaChart', () => {
  const props = {
    values: [300_000, 900_000, 1_300_000, 1_300_000],
    axis: { low: 0, high: 1_500_000, ticks: [0, 500_000, 1_000_000, 1_500_000] },
    yLabel: (tick: number) => `y${tick}`,
    xLabelIndexes: [0, 3],
    xLabel: (index: number) => `x${index}`,
    renderTooltip: (index: number) => <Text>{`point ${index}`}</Text>,
    accessibilityLabel: 'Balance from 1 Oct to 28 Oct',
    testID: 'chart',
  };

  async function renderChart(over: Partial<typeof props> & { hideYLabels?: boolean; referenceValue?: number; endLabel?: string } = {}) {
    const view = await render(<LineAreaChart {...props} {...over} />);
    await fireEvent(view.getByTestId('chart-plot'), 'layout', { nativeEvent: { layout: { width: 320, height: 166 } } });
    return view;
  }

  test('says what it shows to a screen reader, as an image', async () => {
    const view = await renderChart();
    const plot = view.getByTestId('chart-plot');
    expect(plot.props.accessibilityRole).toBe('image');
    expect(plot.props.accessibilityLabel).toBe('Balance from 1 Oct to 28 Oct');
  });

  test('a footer sits in the same card as the plot, and its buttons stay reachable (the image role is on the plot only)', async () => {
    const onPress = jest.fn();
    const view = await render(
      <LineAreaChart {...props} footer={<Text onPress={onPress} accessibilityRole="button">1Y</Text>} />,
    );
    const card = view.getByTestId('chart');
    expect(card.props.accessibilityRole).toBeUndefined();
    expect(view.getByTestId('chart-plot').props.accessibilityRole).toBe('image');
    // the footer is inside the card, after the plot
    expect(card.children).toHaveLength(2);
    await fireEvent.press(view.getByRole('button', { name: '1Y' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('draws the axis labels and the labels under the axis', async () => {
    const view = await renderChart();
    // Hidden from a screen reader on purpose (the chart's own label says it all), so they are looked for as hidden.
    for (const tick of ['y0', 'y500000', 'y1000000', 'y1500000', 'x0', 'x3']) expect(view.getByText(tick, { includeHiddenElements: true })).toBeTruthy();
  });

  test('Hide amounts takes the amounts off the axis; the line and the dates stay', async () => {
    const view = await renderChart({ hideYLabels: true });
    expect(view.queryByText('y500000', { includeHiddenElements: true })).toBeNull();
    expect(view.getByText('x0', { includeHiddenElements: true })).toBeTruthy();
  });

  test('a reference line and an end label are drawn only when asked for', async () => {
    const dashed = (tree: unknown) => JSON.stringify(tree).includes('[6,5]');
    const plain = await renderChart();
    expect(dashed(plain.toJSON())).toBe(false);
    expect(plain.queryByText('1,3 jt', { includeHiddenElements: true })).toBeNull();
    await plain.unmount();

    const view = await renderChart({ referenceValue: 1_000_000, endLabel: '1,3 jt' });
    expect(dashed(view.toJSON())).toBe(true);
    expect(view.getByText('1,3 jt', { includeHiddenElements: true })).toBeTruthy();
  });

  test('draws nothing before it knows its width', async () => {
    const view = await render(<LineAreaChart {...props} />);
    expect(view.queryByText('y0', { includeHiddenElements: true })).toBeNull();
  });

  test('touching the plot shows the point under the finger, and letting go hides it', async () => {
    const view = await renderChart();
    const plot = view.getByTestId('chart-plot');
    expect(view.queryByTestId('chart-tooltip')).toBeNull();
    await act(async () => plot.props.onResponderGrant({ nativeEvent: { locationX: 320 - 12 } })); // the right end
    expect(view.getByText('point 3')).toBeTruthy();
    await act(async () => plot.props.onResponderMove({ nativeEvent: { locationX: 44 } })); // the left end of the plot
    expect(view.getByText('point 0')).toBeTruthy();
    await act(async () => plot.props.onResponderRelease());
    expect(view.queryByTestId('chart-tooltip')).toBeNull();
  });

  test('a touch outside the plot reads the nearest end, never a point that is not there', async () => {
    const view = await renderChart();
    await act(async () => view.getByTestId('chart-plot').props.onResponderGrant({ nativeEvent: { locationX: -50 } }));
    expect(view.getByText('point 0')).toBeTruthy();
    await act(async () => view.getByTestId('chart-plot').props.onResponderGrant({ nativeEvent: { locationX: 9999 } }));
    expect(view.getByText('point 3')).toBeTruthy();
  });
});
