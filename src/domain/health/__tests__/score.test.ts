import { bandFor, computeHealth, distributeWeights, mulDivRound, wholePercentBp } from '../score';
import { BASE_WEIGHTS, type HealthInput, type HealthResult } from '../types';

// The October 2026 sample (DATABASE.md section 6, the "Analyze" board): income 7.500.000, expenses 4.257.000,
// 5 of 6 budgets in limit, all accounts 8.880.000, fixed expenses 1.201.990 a month, net worth up in 5 of 5 months.
const OCTOBER: HealthInput = {
  income: 7_500_000,
  expense: 4_257_000,
  budgets: [
    { limit: 700_000, spent: 812_000 }, // Shopping, over
    { limit: 1_200_000, spent: 1_150_000 }, // Bills
    { limit: 600_000, spent: 540_000 }, // Transport
    { limit: 1_800_000, spent: 1_425_000 }, // Food & drink
    { limit: 400_000, spent: 210_000 }, // Leisure
    { limit: 300_000, spent: 120_000 }, // Health
  ],
  balance: 8_880_000,
  fixedMonthly: 200_000 + 385_000 + 54_990 + 562_000,
  netWorthSeries: [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_637_000, 8_880_000],
  dayOfPeriod: 28,
  previousExpense: 3_900_000,
  transactionCount: 11,
  dataSpanDays: 28,
  accountCount: 4,
};

function scored(input: HealthInput): Extract<HealthResult, { eligible: true }> {
  const result = computeHealth(input);
  if (!result.eligible) throw new Error('expected a score');
  return result;
}

function byId(result: Extract<HealthResult, { eligible: true }>, id: string) {
  const c = result.components.find(x => x.id === id);
  if (!c) throw new Error(`no component ${id}`);
  return c;
}

describe('mulDivRound', () => {
  test('rounds half away from zero and survives numbers past 2^53', () => {
    expect(mulDivRound(1, 1, 2)).toBe(1);
    expect(mulDivRound(-1, 1, 2)).toBe(-1);
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(5, 3, 10)).toBe(2);
    expect(mulDivRound(9_000_000_000_000, 50_000, 3_000_000_000_000)).toBe(150_000);
  });
});

describe('distributeWeights (largest remainder, always sums to 100)', () => {
  test('all five counted keeps the base weights', () => {
    expect(distributeWeights(['savings', 'budget', 'emergency', 'fixed', 'wealth'])).toEqual({
      savings: 25, budget: 25, emergency: 20, fixed: 15, wealth: 15,
    });
  });

  test('without budget and fixed: 25 / 20 / 15 becomes 42 / 33 / 25', () => {
    const w = distributeWeights(['savings', 'emergency', 'wealth']);
    expect(w).toEqual({ savings: 42, emergency: 33, wealth: 25 });
  });

  test('every subset sums to exactly 100', () => {
    const ids = Object.keys(BASE_WEIGHTS) as (keyof typeof BASE_WEIGHTS)[];
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const subset = ids.filter((_, i) => mask & (1 << i));
      const w = distributeWeights(subset);
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});

describe('wholePercentBp', () => {
  test('rounds half up to a whole percent', () => {
    expect(wholePercentBp(3477)).toBe(3500);
    expect(wholePercentBp(8333)).toBe(8300);
    expect(wholePercentBp(8350)).toBe(8400);
    expect(wholePercentBp(0)).toBe(0);
    expect(wholePercentBp(10000)).toBe(10000);
  });
});

describe('bands', () => {
  test.each([
    [100, 'healthy'], [80, 'healthy'], [79, 'fair'], [60, 'fair'], [59, 'weak'], [40, 'weak'], [39, 'needs_work'], [0, 'needs_work'],
  ])('score %i is %s', (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe('the October 2026 sample', () => {
  const r = scored(OCTOBER);

  test('savings: 43,24% is past the 20% target, full 25', () => {
    const c = byId(r, 'savings');
    expect(c).toMatchObject({ points: 25, max: 25, ratioBp: 10000, skipped: false, metric: 4324 });
  });

  test('budget: 5 of 6 = 83% of 25 = 21', () => {
    expect(byId(r, 'budget')).toMatchObject({ points: 21, max: 25, ratioBp: 8300, skipped: false, metric: 5 });
  });

  test('emergency: 2,09 months of 6 = 34,8%, shown as 35%, of 20 = 7', () => {
    expect(byId(r, 'emergency')).toMatchObject({ points: 7, max: 20, skipped: false, metric: 209 });
    expect(byId(r, 'emergency').ratioBp).toBe(3500);
  });

  test('fixed: 16,03% is under 20%, full 15', () => {
    expect(byId(r, 'fixed')).toMatchObject({ points: 15, max: 15, ratioBp: 10000, skipped: false, metric: 1603 });
  });

  test('wealth: up 5 of 5, full 15', () => {
    expect(byId(r, 'wealth')).toMatchObject({ points: 15, max: 15, ratioBp: 10000, skipped: false, metric: 5 });
  });

  test('the total is the sum of the rounded points: 25+21+7+15+15 = 83, Sehat', () => {
    expect(r.score).toBe(83);
    expect(r.band).toBe('healthy');
    expect(r.countedOf).toBe(5);
    expect(r.components.reduce((a, c) => a + c.points, 0)).toBe(r.score);
    expect(r.components.reduce((a, c) => a + c.max, 0)).toBe(100);
  });
});

describe('savings', () => {
  const only = (income: number, expense: number) => byId(scored({ ...OCTOBER, income, expense }), 'savings');

  test('zero income is 0 points, not skipped', () => {
    expect(only(0, 100_000)).toMatchObject({ points: 0, ratioBp: 0, skipped: false });
  });

  test('0% or negative is 0', () => {
    expect(only(1_000_000, 1_000_000).points).toBe(0);
    expect(only(1_000_000, 1_500_000)).toMatchObject({ points: 0, ratioBp: 0 });
  });

  test('straight line between 0% and 20%: 10% is half', () => {
    expect(only(1_000_000, 900_000)).toMatchObject({ ratioBp: 5000, points: 13 }); // 12,5 rounds half up
  });

  test('exactly 20% is full', () => {
    expect(only(1_000_000, 800_000)).toMatchObject({ ratioBp: 10000, points: 25 });
  });
});

describe('budget', () => {
  test('no budgets: skipped, weight shared', () => {
    const r = scored({ ...OCTOBER, budgets: [] });
    expect(byId(r, 'budget')).toMatchObject({ skipped: true, points: 0, max: 0 });
    expect(r.countedOf).toBe(4);
    expect(r.components.reduce((a, c) => a + c.max, 0)).toBe(100);
  });

  test('spent exactly at the limit counts as inside', () => {
    const r = scored({ ...OCTOBER, budgets: [{ limit: 100, spent: 100 }, { limit: 100, spent: 101 }] });
    expect(byId(r, 'budget')).toMatchObject({ metric: 1, ratioBp: 5000 });
  });
});

describe('emergency', () => {
  test('full at 6 months or more', () => {
    const c = byId(scored({ ...OCTOBER, balance: 4_257_000 * 6 }), 'emergency');
    expect(c).toMatchObject({ ratioBp: 10000, points: 20, metric: 600 });
    expect(byId(scored({ ...OCTOBER, balance: 99_999_999_999 }), 'emergency').ratioBp).toBe(10000);
  });

  test('a negative balance is zero', () => {
    expect(byId(scored({ ...OCTOBER, balance: -5 }), 'emergency')).toMatchObject({ ratioBp: 0, points: 0 });
  });

  test('a period younger than 10 days uses the previous full period', () => {
    const young = scored({ ...OCTOBER, dayOfPeriod: 9, expense: 300_000, previousExpense: 4_000_000, balance: 6_000_000 });
    expect(byId(young, 'emergency')).toMatchObject({ metric: 150, ratioBp: 2500 });
    const tenth = scored({ ...OCTOBER, dayOfPeriod: 10, expense: 3_000_000, previousExpense: 9_000_000, balance: 6_000_000 });
    expect(byId(tenth, 'emergency')).toMatchObject({ metric: 200 });
  });

  test('a young period with no previous period keeps the current expense', () => {
    const young = scored({ ...OCTOBER, dayOfPeriod: 3, expense: 1_000_000, previousExpense: null, balance: 2_000_000 });
    expect(byId(young, 'emergency').metric).toBe(200);
  });

  test('no expense at all with money in the bank is full', () => {
    const c = byId(scored({ ...OCTOBER, expense: 0, previousExpense: null, balance: 1_000 }), 'emergency');
    expect(c).toMatchObject({ ratioBp: 10000, metric: null });
  });
});

describe('fixed expenses', () => {
  const only = (fixedMonthly: number, income = 1_000_000) => byId(scored({ ...OCTOBER, income, expense: 100_000, fixedMonthly }), 'fixed');

  test('20% or less is full, 40% or more is zero, straight between', () => {
    expect(only(200_000)).toMatchObject({ ratioBp: 10000, points: 15 });
    expect(only(300_000)).toMatchObject({ ratioBp: 5000, points: 8 }); // 7,5 rounds half up
    expect(only(400_000)).toMatchObject({ ratioBp: 0, points: 0 });
    expect(only(900_000)).toMatchObject({ ratioBp: 0, points: 0 });
  });

  test('none, or no income: skipped', () => {
    expect(only(0).skipped).toBe(true);
    expect(only(300_000, 0).skipped).toBe(true);
  });
});

describe('wealth direction', () => {
  const series = (s: number[]) => byId(scored({ ...OCTOBER, netWorthSeries: s }), 'wealth');

  test('fewer than 2 points: skipped', () => {
    expect(series([]).skipped).toBe(true);
    expect(series([5]).skipped).toBe(true);
  });

  test('rises over comparisons; flat or falling is not a rise', () => {
    expect(series([1, 2, 2, 3, 1, 4])).toMatchObject({ metric: 3, ratioBp: 6000, points: 9 });
  });

  test('only the last 6 points are read (5 comparisons)', () => {
    expect(series([9, 8, 7, 1, 2, 3, 4, 5, 6])).toMatchObject({ metric: 5, ratioBp: 10000 });
  });

  test('two points, one rise: full', () => {
    expect(series([1, 2])).toMatchObject({ metric: 1, ratioBp: 10000, points: 15 });
  });
});

describe('skipped weights are shared and the total still matches', () => {
  test('only savings, emergency and wealth counted: 42 / 33 / 25', () => {
    const r = scored({ ...OCTOBER, budgets: [], fixedMonthly: 0 });
    expect(r.countedOf).toBe(3);
    expect(r.components.map(c => [c.id, c.max])).toEqual([
      ['savings', 42], ['budget', 0], ['emergency', 33], ['fixed', 0], ['wealth', 25],
    ]);
    expect(r.components.map(c => c.points)).toEqual([42, 0, 12, 0, 25]);
    expect(r.score).toBe(79);
    expect(r.components.reduce((a, c) => a + c.points, 0)).toBe(r.score);
  });

  test('a score can reach 0 and 100', () => {
    const best = scored({ ...OCTOBER, budgets: [{ limit: 10, spent: 1 }], balance: 99_999_999_999 });
    expect(best.score).toBe(100);
    const worst = scored({ ...OCTOBER, expense: 9_000_000, balance: 0, budgets: [{ limit: 1, spent: 2 }], fixedMonthly: 9_000_000, netWorthSeries: [5, 4, 3] });
    expect(worst.score).toBe(0);
    expect(worst.band).toBe('needs_work');
  });
});

describe('eligibility', () => {
  test('9 transactions is not enough', () => {
    const r = computeHealth({ ...OCTOBER, transactionCount: 9 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.checks.find(c => c.id === 'transactions')).toEqual({ id: 'transactions', met: false, have: 9, need: 10 });
  });

  test('27 days of data is not enough, 28 is', () => {
    expect(computeHealth({ ...OCTOBER, dataSpanDays: 27 }).eligible).toBe(false);
    expect(computeHealth({ ...OCTOBER, dataSpanDays: 28 }).eligible).toBe(true);
  });

  test('no account is not enough', () => {
    const r = computeHealth({ ...OCTOBER, accountCount: 0 });
    expect(r.eligible).toBe(false);
  });

  test('lists all three checks with what is there and what is needed', () => {
    const r = computeHealth({ ...OCTOBER, transactionCount: 6, dataSpanDays: 9, accountCount: 4 });
    expect(r).toEqual({
      eligible: false,
      checks: [
        { id: 'accounts', met: true, have: 4, need: 1 },
        { id: 'transactions', met: false, have: 6, need: 10 },
        { id: 'span', met: false, have: 9, need: 28 },
      ],
    });
  });
});

test('the same data always gives the same score and nothing is mutated', () => {
  const copy = JSON.parse(JSON.stringify(OCTOBER)) as HealthInput;
  expect(computeHealth(OCTOBER)).toEqual(computeHealth(OCTOBER));
  expect(OCTOBER).toEqual(copy);
});
