import { axisLabel, labelIndexes, millions, millionsCallout, millionsFixed, niceRange, niceScale, PAIR_EDGE, PAIR_INNER_GAP, PAIR_Y_AXIS_WIDTH, pairedBarSizes } from '../chartScale';

describe('niceScale', () => {
  test('the cash flow board: a 7,5 million high gives 0, 4, 8', () => {
    expect(niceScale(7_500_000)).toEqual({ top: 8_000_000, step: 4_000_000, ticks: [0, 4_000_000, 8_000_000] });
  });

  test('the net worth board: a 30 million goal gives 0, 10, 20, 30', () => {
    expect(niceScale(30_000_000).ticks).toEqual([0, 10_000_000, 20_000_000, 30_000_000]);
  });

  test('8,88 million alone gives 0, 4, 8, 12 (three intervals)', () => {
    expect(niceScale(8_880_000).ticks).toEqual([0, 4_000_000, 8_000_000, 12_000_000]);
  });

  test('the top is always at least the max, with at most three intervals', () => {
    for (const max of [1, 999, 50_000, 640_000, 1_000_000, 1_000_001, 12_345_678, 250_000_000, 4_000_000_000]) {
      const scale = niceScale(max);
      expect(scale.top).toBeGreaterThanOrEqual(max);
      expect(scale.ticks.length).toBeLessThanOrEqual(4);
      expect(scale.ticks[0]).toBe(0);
      expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.top);
    }
  });

  test('nothing recorded still gets a usable axis', () => {
    expect(niceScale(0).top).toBeGreaterThan(0);
    expect(niceScale(-5).ticks[0]).toBe(0);
  });
});

describe('millions', () => {
  test.each([
    [0, '0'],
    [8_000_000, '8'],
    [8_880_000, '8,9'],
    [400_000, '0,4'],
    [1_100_000, '1,1'],
    [49_999, '0'],
    [50_000, '0,1'], // half rounds away from zero
    [-2_500_000, '−2,5'],
    [12_000_000, '12'],
  ])('%i → %s', (value, expected) => expect(millions(value)).toBe(expected));
});

describe('millionsFixed', () => {
  test.each([
    [0, '0,0'],
    [6_800_000, '6,8'],
    [6_849_999, '6,8'],
    [6_850_000, '6,9'], // half rounds away from zero
    [100_000, '0,1'],
    [-1_200_000, '−1,2'],
    [-49_999, '0,0'], // no sign on a value that rounds to zero
  ])('%i → %s', (value, expected) => expect(millionsFixed(value)).toBe(expected));
});

test('axisLabel: millions from Rp1 million up, thousands below', () => {
  expect(axisLabel(4_000_000, 8_000_000)).toBe('4');
  expect(axisLabel(200_000, 600_000)).toBe('200k');
});

test('millionsCallout: "8,9 jt"', () => {
  expect(millionsCallout(8_880_000)).toBe('8,9 jt');
});

describe('labelIndexes', () => {
  test('few labels: all of them', () => expect(labelIndexes(6, 7)).toEqual([0, 1, 2, 3, 4, 5]));
  test('many labels: thinned, always ending on the last', () => {
    const indexes = labelIndexes(24, 6);
    expect(indexes[indexes.length - 1]).toBe(23);
    expect(indexes.length).toBeLessThanOrEqual(7);
  });
});

describe('niceRange', () => {
  test('a balance that moves between 312.500 and 375.500 gets 280k, 320k, 360k, 400k', () => {
    expect(niceRange(312_500, 375_500)).toEqual({ low: 280_000, high: 400_000, step: 40_000, ticks: [280_000, 320_000, 360_000, 400_000] });
  });

  test('the range always covers min..max with at most three intervals and round gridlines', () => {
    const cases: [number, number][] = [[0, 1], [0, 1_000_000], [1_270_000, 1_650_000], [9_990_000, 10_010_000], [4_300_000, 34_900_000], [1, 999], [-500_000, 250_000]];
    for (const [min, max] of cases) {
      const range = niceRange(min, max);
      expect(range.low).toBeLessThanOrEqual(min);
      expect(range.high).toBeGreaterThanOrEqual(max);
      expect(range.ticks[0]).toBe(range.low);
      expect(range.ticks[range.ticks.length - 1]).toBe(range.high);
      expect(range.ticks.length - 1).toBeLessThanOrEqual(3);
      expect(range.ticks.length).toBeGreaterThanOrEqual(2);
      expect(Math.abs(range.low % range.step)).toBe(0);
    }
  });

  test('a flat line still gets a band around it', () => {
    const range = niceRange(500_000, 500_000);
    expect(range.high).toBeGreaterThan(range.low);
    expect(range.low).toBeLessThanOrEqual(500_000);
    expect(range.high).toBeGreaterThanOrEqual(500_000);
  });

  test('no money at all (0 to 0) is a sane axis, not a zero-height one', () => {
    const range = niceRange(0, 0);
    expect(range.high).toBeGreaterThan(range.low);
  });

  test('the gridlines are integers', () => {
    expect(niceRange(33, 71).ticks.every(Number.isInteger)).toBe(true);
  });
});

describe('pairedBarSizes: every month fits the plot, the last one included', () => {
  test.each([[320, 12], [360, 12], [412, 12], [320, 6], [412, 6]])('on a chart %ipx wide, %i months fill the plot from edge to edge and none runs past it', (width, count) => {
    const { bar, gap, slot } = pairedBarSizes(width, count);
    const plot = width - PAIR_Y_AXIS_WIDTH - PAIR_EDGE * 2;
    expect(slot * count).toBeCloseTo(plot, 5);
    expect(2 * bar + PAIR_INNER_GAP + gap).toBeCloseTo(slot, 5);
    // the left edge, every pair with its gap, and the right edge add up to the chart's width: nothing is cut off
    expect(PAIR_Y_AXIS_WIDTH + PAIR_EDGE + count * (2 * bar + PAIR_INNER_GAP + gap) + PAIR_EDGE).toBeCloseTo(width, 5);
    expect(bar).toBeGreaterThan(0);
  });

  test('before the chart is measured (or with nothing to draw) it uses the fixed sizes', () => {
    expect(pairedBarSizes(0, 12)).toMatchObject({ bar: 14, gap: 10 });
    expect(pairedBarSizes(360, 0)).toMatchObject({ bar: 14, gap: 10 });
  });
});
