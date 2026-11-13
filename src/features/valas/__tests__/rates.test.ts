// The maths of rates and exchanges: integers only, half away from zero, a missing rate is never zero.
import { toIdr } from '../../../core/money';
import { exchangeSummary, impliedRateE4, parseRateInput, valueIdr } from '../rates';

const RATES = { USD: 162500000, SGD: 125000000 }; // US$1 = Rp16.250, S$1 = Rp12.500
const idr = (amount: number) => ({ currency: 'IDR', amount, minorFactor: 1 });
const usd = (amount: number) => ({ currency: 'USD', amount, minorFactor: 100 });
const sgd = (amount: number) => ({ currency: 'SGD', amount, minorFactor: 100 });

describe('toIdr: one rounding, half away from zero', () => {
  test('US$250,00 at Rp16.250 is Rp4.062.500 and S$180,00 at Rp12.500 is Rp2.250.000 (the Valas sample)', () => {
    expect(toIdr(25000, 162500000, 100)).toBe(4062500);
    expect(toIdr(18000, 125000000, 100)).toBe(2250000);
    expect(4062500 + 2250000).toBe(6312500);
  });

  test('positive, with a fraction below the half: rounds down', () => {
    expect(toIdr(1, 162499999, 100)).toBe(162); // 162,499999 -> 162
  });

  test('exactly a half rounds away from zero, both ways', () => {
    expect(toIdr(1, 162500000, 100)).toBe(163); // Rp162,50 -> 163
    expect(toIdr(-1, 162500000, 100)).toBe(-163);
  });

  test('negative amounts mirror the positive ones', () => {
    expect(toIdr(-2000, 125000000, 100)).toBe(-250000);
    expect(toIdr(-1, 162499999, 100)).toBe(-162);
  });

  test('a currency with no minor unit (JPY): 1000 yen at Rp108,50 is Rp108.500', () => {
    expect(toIdr(1000, 1085000, 1)).toBe(108500);
  });

  test('a large amount does not lose a digit to floating point', () => {
    expect(toIdr(99_999_999_999, 162500000, 100)).toBe(16_249_999_999_838); // ...837,5 rounds up
  });
});

describe('parseRateInput: what the person types for a manual rate', () => {
  test.each([
    ['16.250', 162500000],
    ['16250', 162500000],
    ['Rp16.250', 162500000],
    ['Rp 16.250', 162500000],
    ['16.250,5', 162505000],
    ['16.250,25', 162502500],
    ['12500', 125000000],
    ['108,5', 1085000],
    ['0,05', 500],
  ])('%s', (text, expected) => {
    expect(parseRateInput(text)).toBe(expected);
  });

  test.each(['', 'abc', '0', '0,00', '-5', '16.25', '16,250,1', '16.250,123', '1e5', '99999999999'])('%s is refused', text => {
    expect(parseRateInput(text)).toBeNull();
  });
});

describe('impliedRateE4', () => {
  test('Rp1.625.000 for US$100,00 is Rp16.250 per dollar', () => {
    expect(impliedRateE4(1625000, 10000, 100)).toBe(162500000);
  });

  test('rounds once, half away from zero', () => {
    expect(impliedRateE4(1, 3, 1)).toBe(3333); // 0,3333 rupiah per unit
    expect(impliedRateE4(2, 3, 1)).toBe(6667); // 0,6667
  });

  test('nothing received gives 0, never a division by zero', () => {
    expect(impliedRateE4(100, 0, 100)).toBe(0);
  });
});

describe('valueIdr', () => {
  test('rupiah are themselves; a foreign amount uses the latest rate; a missing rate is null, not 0', () => {
    expect(valueIdr(idr(5000), RATES)).toBe(5000);
    expect(valueIdr(usd(25000), RATES)).toBe(4062500);
    expect(valueIdr(sgd(100), {})).toBeNull();
  });
});

describe('exchangeSummary', () => {
  test('rupiah to dollars at the stored rate: the same rate and no difference', () => {
    const s = exchangeSummary(idr(1625000), usd(10000), RATES);
    expect(s.yours).toEqual({ kind: 'idr', currency: 'USD', rateE4: 162500000 });
    expect(s.latest).toEqual({ kind: 'idr', currency: 'USD', rateE4: 162500000 });
    expect(s.differenceBp).toBe(0);
    expect(s.differenceIdr).toBe(0);
  });

  test('a worse deal than the stored rate shows as a negative difference, the amount net worth falls by', () => {
    // paid Rp1.650.000 for US$100,00: Rp25.000 more than at the stored rate
    const s = exchangeSummary(idr(1650000), usd(10000), RATES);
    expect(s.yours).toEqual({ kind: 'idr', currency: 'USD', rateE4: 165000000 });
    expect(s.differenceIdr).toBe(1625000 - 1650000);
    expect(s.differenceBp).toBe(-152); // -1,52% of Rp1.650.000
  });

  test('selling dollars for rupiah works the same way round', () => {
    const s = exchangeSummary(usd(10000), idr(1600000), RATES);
    expect(s.yours).toEqual({ kind: 'idr', currency: 'USD', rateE4: 160000000 });
    expect(s.differenceIdr).toBe(1600000 - 1625000);
  });

  test('dollars to Singapore dollars: units of the second per one of the first, and the difference at the latest rates', () => {
    // US$100,00 -> S$130,00 (stored cross rate: 16.250 / 12.500 = 1,3000)
    const s = exchangeSummary(usd(10000), sgd(13000), RATES);
    expect(s.yours).toEqual({ kind: 'cross', from: 'USD', to: 'SGD', perUnitE4: 13000 });
    expect(s.latest).toEqual({ kind: 'cross', from: 'USD', to: 'SGD', perUnitE4: 13000 });
    expect(s.differenceIdr).toBe(0);
    expect(s.differenceBp).toBe(0);
    // S$128,00 instead: Rp25.000 less than the stored rate would give
    expect(exchangeSummary(usd(10000), sgd(12800), RATES).differenceIdr).toBe(1600000 - 1625000);
  });

  test('a missing rate leaves the latest rate and the difference empty: never 0', () => {
    const s = exchangeSummary(idr(1625000), usd(10000), {});
    expect(s.yours).not.toBeNull();
    expect(s.latest).toBeNull();
    expect(s.differenceBp).toBeNull();
    expect(s.differenceIdr).toBeNull();
  });

  test('an empty amount or the same currency twice gives nothing', () => {
    expect(exchangeSummary(idr(0), usd(10000), RATES)).toEqual({ yours: null, latest: null, differenceBp: null, differenceIdr: null });
    expect(exchangeSummary(usd(100), usd(100), RATES).yours).toBeNull();
  });
});
