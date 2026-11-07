import { createAccount } from '../accounts';
import { listCategories } from '../../data/repo/categories';
import { openTestDb } from '../../data/db/openTestDb';
import { setMonthlyLimit } from '../budget';
import { addExpense, addIncome } from '../transactions';
import { getCategoryStats, largestRemainderSharesBp } from '../categoryStats';

const NOW = '2026-10-28T10:00:00+07:00';

describe('largestRemainderSharesBp', () => {
  test('October\'s six expense categories sum to exactly 10000bp (100.0%)', () => {
    // Food & drink 1.425.000, Bills 1.150.000, Shopping 812.000, Transport 540.000,
    // Leisure 210.000, Health 120.000 — total 4.257.000, CLAUDE.md's sample data.
    const values = [1425000, 1150000, 812000, 540000, 210000, 120000];
    const total = values.reduce((a, b) => a + b, 0);
    const shares = largestRemainderSharesBp(values, total);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(shares.every(s => Number.isInteger(s))).toBe(true);
  });

  test('an empty set or a zero total returns all zeros, not NaN/Infinity', () => {
    expect(largestRemainderSharesBp([], 0)).toEqual([]);
    expect(largestRemainderSharesBp([100, 200], 0)).toEqual([0, 0]);
  });

  test('a single value gets the whole 10000bp', () => {
    expect(largestRemainderSharesBp([500], 500)).toEqual([10000]);
  });
});

describe('getCategoryStats', () => {
  async function buildOctoberSample() {
    const db = openTestDb();
    const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
    const categories = await listCategories(db);
    const cat = (name: string) => categories.find(c => c.name === name)!.id;

    await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, occurredOn: '2026-10-25' }, NOW);
    await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Freelance'), amount: 500000, occurredOn: '2026-10-26' }, NOW);
    for (const [name, amount] of [
      ['Shopping', 812000],
      ['Bills', 1150000],
      ['Transport', 540000],
      ['Food & drink', 1425000],
      ['Leisure', 210000],
      ['Health', 120000],
    ] as const) {
      await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat(name), amount, occurredOn: '2026-10-20' }, NOW);
    }
    await setMonthlyLimit(db, '2026-10', 5000000);
    return db;
  }

  test('buckets the top 4 expense categories plus an "Others" total, in descending order', async () => {
    const db = await buildOctoberSample();
    const { categories, total } = await getCategoryStats(db, '2026-10', 'expense', true);

    expect(total).toBe(4257000);
    expect(categories).toHaveLength(5); // 4 named + 1 synthetic "Others"
    expect(categories.map(c => c.label)).toEqual(['Food & drink', 'Bills', 'Shopping', 'Transport', '']);
    expect(categories[4].id).toBe(-1); // the synthetic "Others" bucket — caller supplies its label
    expect(categories[4].amountIdr).toBe(210000 + 120000); // Leisure + Health
    expect(categories.reduce((sum, c) => sum + c.shareBp, 0)).toBe(10000);
  });

  test('assigns the 5-colour chart palette in order, largest category first', async () => {
    const db = await buildOctoberSample();
    const { categories } = await getCategoryStats(db, '2026-10', 'expense', true);
    expect(categories.map(c => c.color)).toEqual(['#E3C27A', '#A3A3A3', '#737373', '#525252', '#3A3A3A']);
  });

  test('income categories are bucketed separately from expense (no "Others" when under the cap)', async () => {
    const db = await buildOctoberSample();
    const { categories, total } = await getCategoryStats(db, '2026-10', 'income', true);
    expect(total).toBe(7500000);
    expect(categories.map(c => c.label)).toEqual(['Salary', 'Freelance']);
  });

  test('the monthly limit is only attached for the current period\'s expense stats', async () => {
    const db = await buildOctoberSample();
    const currentExpense = await getCategoryStats(db, '2026-10', 'expense', true);
    expect(currentExpense.limitIdr).toBe(5000000);

    const pastExpense = await getCategoryStats(db, '2026-09', 'expense', false);
    expect(pastExpense.limitIdr).toBeUndefined();

    const currentIncome = await getCategoryStats(db, '2026-10', 'income', true);
    expect(currentIncome.limitIdr).toBeUndefined(); // a limit is a spending concept only
  });
});
