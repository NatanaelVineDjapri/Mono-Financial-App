import { currencyInputText, decimalsOf, parseCurrencyText } from '../amountText';

describe('decimalsOf', () => {
  test('the number of minor-unit digits', () => {
    expect(decimalsOf(100)).toBe(2);
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(1000)).toBe(3);
  });
});

describe('parseCurrencyText: integers in minor units, never a float', () => {
  test.each([
    ['250', 100, 25000],
    ['250,5', 100, 25050],
    ['250,50', 100, 25050],
    ['250.50', 100, 25050],
    ['250,', 100, 25000],
    [',5', 100, 50],
    ['0,05', 100, 5],
    ['1.250', 100, 125000], // three digits after the mark: a thousands mark
    ['1,250.50', 100, 125050],
    ['1.250,50', 100, 125050],
    ['1.250.000', 100, 125000000],
    ['  12 345,6 ', 100, 1234560],
    ['1000', 1, 1000],
    ['1.000', 1, 1000],
    ['1,000,000', 1, 1000000],
    ['0', 100, 0],
  ])('%s (factor %d)', (text, factor, expected) => {
    expect(parseCurrencyText(text, factor)).toBe(expected);
  });

  test.each([
    ['', 100],
    ['abc', 100],
    ['-5', 100],
    ['1e5', 100],
    ['.', 100],
    ['12,34,56,7', 100],
    ['1.23,4', 100],
    ['1.2', 1], // yen have no decimals
    ['12.34.567', 100],
    ['99999999999999999999', 100],
  ])('%s (factor %d) is refused', (text, factor) => {
    expect(parseCurrencyText(text, factor)).toBeNull();
  });
});

describe('currencyInputText', () => {
  test('round trips through parseCurrencyText', () => {
    for (const [minor, factor] of [[25050, 100], [5, 100], [0, 100], [1000, 1], [99_999_999, 100]] as const) {
      expect(parseCurrencyText(currencyInputText(minor, factor), factor)).toBe(minor);
    }
    expect(currencyInputText(25050, 100)).toBe('250,50');
    expect(currencyInputText(5, 100)).toBe('0,05');
    expect(currencyInputText(1000, 1)).toBe('1000');
  });
});
