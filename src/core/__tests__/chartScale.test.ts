import { axisLabel, labelIndexes, millions, millionsCallout, millionsFixed, niceScale } from '../chartScale';

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
