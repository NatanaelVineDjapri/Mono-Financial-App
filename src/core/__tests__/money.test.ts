import { pct, rp, shown } from '../money';

describe('rp', () => {
  test('formats a plain amount with thousands separators', () => {
    expect(rp(1250000)).toBe('Rp1.250.000');
  });

  test('formats an expense with a true minus sign', () => {
    expect(rp(-38500)).toBe('−Rp38.500');
  });

  test('formats a signed income with a leading plus', () => {
    expect(rp(7000000, true)).toBe('+Rp7.000.000');
  });

  test('does not add a separator under 1000', () => {
    expect(rp(999)).toBe('Rp999');
  });

  test('formats a billion-rupiah amount', () => {
    expect(rp(1000000000)).toBe('Rp1.000.000.000');
  });

  test('zero is never signed, even when sign is requested', () => {
    expect(rp(0, true)).toBe('Rp0');
  });

  test('zero without sign', () => {
    expect(rp(0)).toBe('Rp0');
  });
});

describe('pct', () => {
  test('formats basis points with two decimal places', () => {
    expect(pct(6810)).toBe('68,10%');
  });

  test('pads a small basis-point value', () => {
    expect(pct(5)).toBe('0,05%');
  });

  test('formats over 100%, as an over-budget category does', () => {
    expect(pct(11600)).toBe('116,00%');
  });

  test('formats a savings-rate style value', () => {
    expect(pct(4324)).toBe('43,24%');
  });

  test('formats a negative percentage with a true minus', () => {
    expect(pct(-150)).toBe('−1,50%');
  });

  test('zero basis points', () => {
    expect(pct(0)).toBe('0,00%');
  });
});

describe('shown', () => {
  test('passes the formatted value through when not hidden', () => {
    expect(shown('Rp1.250.000', false)).toBe('Rp1.250.000');
  });

  test('masks the value to a fixed placeholder when hidden', () => {
    expect(shown('Rp1.250.000', true)).toBe('Rp••••••••');
  });
});
