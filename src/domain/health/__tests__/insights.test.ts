import { computeHealth } from '../score';
import { buildInsights, type InsightInput, type NamedBudget } from '../insights';
import type { HealthResult } from '../types';

const BUDGETS: NamedBudget[] = [
  { categoryId: 1, name: 'Shopping', limit: 700_000, spent: 812_000 },
  { categoryId: 2, name: 'Bills', limit: 1_200_000, spent: 1_150_000 },
  { categoryId: 3, name: 'Transport', limit: 600_000, spent: 540_000 },
  { categoryId: 4, name: 'Food & drink', limit: 1_800_000, spent: 1_425_000 },
  { categoryId: 5, name: 'Leisure', limit: 400_000, spent: 210_000 },
  { categoryId: 6, name: 'Health', limit: 300_000, spent: 120_000 },
];

// October 2026, the same sample as the score tests; 3 days left in the period (28 Oct to 31 Oct).
const OCTOBER: InsightInput = {
  income: 7_500_000,
  expense: 4_257_000,
  budgets: BUDGETS,
  balance: 8_880_000,
  fixedMonthly: 1_201_990,
  netWorthSeries: [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_637_000, 8_880_000],
  dayOfPeriod: 28,
  previousExpense: 3_900_000,
  transactionCount: 11,
  dataSpanDays: 28,
  accountCount: 4,
  daysLeft: 3,
};

function eligible(input: InsightInput): Extract<HealthResult, { eligible: true }> {
  const r = computeHealth(input);
  if (!r.eligible) throw new Error('expected a score');
  return r;
}

describe('improvements ("Yang bisa dinaikkan")', () => {
  const ins = buildInsights(OCTOBER, eligible(OCTOBER));

  test('October: the over-limit budget is worth +4, the emergency fund +3, in that order', () => {
    expect(ins.improvements.map(i => [i.kind, i.points])).toEqual([['budget_over', 4], ['emergency', 3]]);
  });

  test('budget card: the worst over-limit budget with spent, limit, overshoot and share used', () => {
    expect(ins.improvements[0]).toMatchObject({
      kind: 'budget_over', categoryId: 1, name: 'Shopping', spent: 812_000, limit: 700_000, overBy: 112_000, usedBp: 11600, overCount: 1, daysLeft: 3,
    });
  });

  test('emergency card: 2,09 months goes to 3 months, which needs Rp3.891.000 more', () => {
    expect(ins.improvements[1]).toMatchObject({ kind: 'emergency', monthsX100: 209, targetMonths: 3, addAmount: 3_891_000 });
  });

  test('from 3 months or more the next target is 6 months', () => {
    const input = { ...OCTOBER, balance: 4_257_000 * 4 };
    const ins2 = buildInsights(input, eligible(input));
    const card = ins2.improvements.find(i => i.kind === 'emergency');
    expect(card).toMatchObject({ targetMonths: 6, addAmount: 4_257_000 * 2 });
    expect(card?.points).toBeGreaterThan(0);
  });

  test('already 6 months: no emergency card', () => {
    const input = { ...OCTOBER, balance: 4_257_000 * 6 };
    expect(buildInsights(input, eligible(input)).improvements.some(i => i.kind === 'emergency')).toBe(false);
  });

  test('with several budgets over, the biggest overshoot leads and the count says how many', () => {
    const budgets = [...BUDGETS, { categoryId: 7, name: 'Gifts', limit: 100_000, spent: 150_000 }];
    const input = { ...OCTOBER, budgets };
    const card = buildInsights(input, eligible(input)).improvements.find(i => i.kind === 'budget_over');
    expect(card).toMatchObject({ name: 'Shopping', overBy: 112_000, overCount: 2 });
  });

  test('savings under 20%: how much the expenses must drop, and the points that would bring', () => {
    const input = { ...OCTOBER, income: 5_000_000, expense: 4_800_000, budgets: [] };
    const card = buildInsights(input, eligible(input)).improvements.find(i => i.kind === 'savings');
    expect(card).toMatchObject({ kind: 'savings', savingsBp: 400, cutAmount: 800_000 });
    expect(card?.points).toBeGreaterThan(0);
  });

  test('fixed expenses above 20% of income: information with no points, last', () => {
    const input = { ...OCTOBER, income: 5_000_000, expense: 3_000_000, fixedMonthly: 1_500_000, budgets: [] };
    const cards = buildInsights(input, eligible(input)).improvements;
    expect(cards[cards.length - 1]).toMatchObject({ kind: 'fixed', points: 0, fixedBp: 3000 });
  });

  test('at most 3 cards, biggest gain first', () => {
    const input: InsightInput = {
      ...OCTOBER, income: 5_000_000, expense: 4_900_000, fixedMonthly: 2_000_000, balance: 1_000_000,
      netWorthSeries: [3, 2, 1], budgets: [{ categoryId: 1, name: 'A', limit: 10, spent: 20 }],
    };
    const cards = buildInsights(input, eligible(input)).improvements;
    expect(cards.length).toBeLessThanOrEqual(3);
    const points = cards.map(c => c.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  test('a card never claims zero points (except the fixed-expenses information)', () => {
    const cards = buildInsights(OCTOBER, eligible(OCTOBER)).improvements;
    expect(cards.filter(c => c.kind !== 'fixed').every(c => c.points > 0)).toBe(true);
  });

  test('the simulated gain is the real score difference', () => {
    const base = eligible(OCTOBER).score;
    const allInLimit = eligible({ ...OCTOBER, budgets: BUDGETS.map(b => ({ ...b, spent: Math.min(b.spent, b.limit) })) }).score;
    expect(allInLimit - base).toBe(4);
  });
});

describe('"Perhatikan"', () => {
  test('October: Bills at 95,83% with Rp50.000 left for 3 days; Transport at 90% is the other', () => {
    const w = buildInsights(OCTOBER, eligible(OCTOBER)).watch;
    expect(w).toMatchObject({ categoryId: 2, name: 'Bills', spent: 1_150_000, limit: 1_200_000, remaining: 50_000, usedBp: 9583, daysLeft: 3 });
    expect(w?.other).toEqual({ name: 'Transport', usedBp: 9000 });
  });

  test('exactly at the limit counts (0 left); over the limit does not', () => {
    const input = { ...OCTOBER, budgets: [{ categoryId: 1, name: 'A', limit: 100, spent: 100 }, { categoryId: 2, name: 'B', limit: 100, spent: 101 }] };
    const w = buildInsights(input, eligible(input)).watch;
    expect(w).toMatchObject({ name: 'A', remaining: 0, usedBp: 10000 });
  });

  test('a period that is over has nothing to watch', () => {
    expect(buildInsights({ ...OCTOBER, daysLeft: null }, eligible(OCTOBER)).watch).toBeNull();
  });

  test('under 90% is not worth a warning', () => {
    const input = { ...OCTOBER, budgets: [{ categoryId: 1, name: 'A', limit: 100, spent: 89 }] };
    expect(buildInsights(input, eligible(input)).watch).toBeNull();
  });

  test('no other budget near the limit: other is null', () => {
    const input = { ...OCTOBER, budgets: [{ categoryId: 1, name: 'A', limit: 100, spent: 95 }, { categoryId: 2, name: 'B', limit: 100, spent: 10 }] };
    expect(buildInsights(input, eligible(input)).watch?.other).toBeNull();
  });
});

describe('"Yang sudah baik"', () => {
  test('October: savings, fixed expenses and net worth, with the real figures', () => {
    const good = buildInsights(OCTOBER, eligible(OCTOBER)).good;
    expect(good.map(g => g.id)).toEqual(['savings', 'fixed', 'wealth']);
    expect(good[0]).toMatchObject({ id: 'savings', savingsBp: 4324 });
    expect(good[1]).toMatchObject({ id: 'fixed', amount: 1_201_990, bp: 1603 });
    expect(good[2]).toMatchObject({ id: 'wealth', rose: true, netWorth: 8_880_000, change: 3_243_000, changeBp: 5753 });
  });

  test('only components at 80% or more, at most 3', () => {
    const input = { ...OCTOBER, balance: 4_257_000 * 6 };
    expect(buildInsights(input, eligible(input)).good).toHaveLength(3);
    const low = { ...OCTOBER, income: 1_000_000, expense: 990_000, budgets: [], fixedMonthly: 0, netWorthSeries: [3, 2, 1], balance: 0 };
    expect(buildInsights(low, eligible(low)).good).toEqual([]);
  });

  test('net worth that fell in the last period is not described as a rise', () => {
    const input = { ...OCTOBER, budgets: [], fixedMonthly: 0, netWorthSeries: [1, 2, 3, 4, 5, 4] };
    const wealth = buildInsights(input, eligible(input)).good.find(g => g.id === 'wealth');
    expect(wealth).toMatchObject({ rose: false });
  });
});

describe('strongest and weakest', () => {
  test('October: savings is strongest, the emergency fund weakest (it gets the Terendah tag)', () => {
    const ins = buildInsights(OCTOBER, eligible(OCTOBER));
    expect(ins.strongestId).toBe('savings');
    expect(ins.weakestId).toBe('emergency');
  });

  test('weakIds: the parts that are not full, lowest first, at most 2, without the one praised', () => {
    expect(buildInsights(OCTOBER, eligible(OCTOBER)).weakIds).toEqual(['emergency', 'budget']);
    const input = { ...OCTOBER, balance: 100, income: 1_000_000, expense: 990_000, fixedMonthly: 900_000, netWorthSeries: [3, 2, 1] };
    const ids = buildInsights(input, eligible(input)).weakIds;
    expect(ids).toHaveLength(2);
  });

  test('everything full: no weakest', () => {
    const input = { ...OCTOBER, balance: 99_999_999_999, budgets: BUDGETS.map(b => ({ ...b, spent: 0 })) };
    const ins = buildInsights(input, eligible(input));
    expect(ins.weakestId).toBeNull();
  });

  test('skipped parts are never picked', () => {
    const input = { ...OCTOBER, budgets: [], fixedMonthly: 0 };
    const ins = buildInsights(input, eligible(input));
    expect(['budget', 'fixed']).not.toContain(ins.weakestId);
    expect(['budget', 'fixed']).not.toContain(ins.strongestId);
  });
});
