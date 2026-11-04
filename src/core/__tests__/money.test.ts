import { money, pct, rp, shown, toIdr } from '../money';

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

describe('money', () => {
  test('formats a 2-decimal currency (US$250,00)', () => {
    expect(money(25000, 'USD', 100)).toBe('US$250,00');
  });

  test('a zero-decimal currency (JPY) has no comma', () => {
    expect(money(500, 'JPY', 1)).toBe('¥500');
  });

  test('negative amounts use a true minus sign', () => {
    expect(money(-25000, 'USD', 100)).toBe('−US$250,00');
  });

  test('signed amounts get a leading plus', () => {
    expect(money(25000, 'USD', 100, true)).toBe('+US$250,00');
  });

  test('zero is never signed, even when sign is requested', () => {
    expect(money(0, 'USD', 100, true)).toBe('US$0,00');
  });

  test('an unlisted currency code falls back to the code itself', () => {
    expect(money(1000, 'XYZ', 100)).toBe('XYZ 10,00');
  });
});

describe('toIdr', () => {
  test('US$250,00 at rate 16.250 is Rp4.062.500', () => {
    expect(toIdr(25000, 162500000, 100)).toBe(4062500);
  });

  test('S$200,00 at rate 12.500 is Rp2.500.000', () => {
    expect(toIdr(2000, 125000000, 100)).toBe(250000);
  });

  test('half away from zero: 1 yen at Rp108,50 rounds up to 109', () => {
    expect(toIdr(1, 1085000, 1)).toBe(109);
  });

  test('half away from zero: 3 yen at Rp108,50 (325,5) rounds up to 326', () => {
    expect(toIdr(3, 1085000, 1)).toBe(326);
  });

  test('an amount above US$5.000.000 keeps exact precision (needs BigInt, not Number)', () => {
    // 500.000.001 cents = US$5.000.000,01; minor * rateE4 alone is ~8,1 x 10^16,
    // past Number.MAX_SAFE_INTEGER (2^53 - 1 ~= 9,007 x 10^15).
    expect(toIdr(500000001, 162500000, 100)).toBe(81250000163);
  });

  test('a negative amount mirrors the positive rounding', () => {
    expect(toIdr(-500000001, 162500000, 100)).toBe(-81250000163);
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
