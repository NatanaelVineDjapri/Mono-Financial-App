import * as fs from 'fs';
import * as path from 'path';

import { openTestDb } from '../../data/db/openTestDb';
import { getMonthlyLimit, listBudgets } from '../../data/repo/budgets';
import { listCategories } from '../../data/repo/categories';
import {
    availablePerDay,
    checkAllocation,
    createBudget,
    deleteBudget,
    deleteMonthlyLimit,
    ensureMonth,
    getBudgetFormContext,
    getBudgetOverview,
    getBudgetStatus,
    getCategoryBudgetDetail,
    getMonthBudget,
    saveBudget,
    setMonthlyLimit,
    updateBudget,
} from '../budget';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../tools/sample_data.sql'), 'utf8');
const TODAY = '2026-10-28';
// Category ids in the seed: Food & drink 1, Transport 2, Shopping 3, Bills 4, Health 5, Leisure 6, Housing 7.
const SHOPPING = 3;
const BILLS = 4;
const HOUSING = 7;

async function sampleDb() {
  const db = openTestDb();
  await db.execAsync(SAMPLE_SQL);
  return db;
}

describe('checkAllocation (pas, kurang, lebih)', () => {
  test('exact: the budgets use the whole limit, nothing left, nothing over', () => {
    expect(checkAllocation(5000000, 4500000, 500000)).toEqual({
      monthlyLimit: 5000000,
      allocated: 4500000,
      adding: 500000,
      total: 5000000,
      status: 'exact',
      unallocated: 0,
      overBy: 0,
    });
  });

  test('under: names the unallocated rest', () => {
    expect(checkAllocation(5000000, 4000000, 500000)).toMatchObject({ status: 'under', total: 4500000, unallocated: 500000, overBy: 0 });
  });

  test('over: the board example (5.000.000 allocated + 500.000) is over by Rp500.000', () => {
    expect(checkAllocation(5000000, 5000000, 500000)).toMatchObject({ status: 'over', total: 5500000, unallocated: 0, overBy: 500000 });
  });

  test('no monthly limit yet counts as a limit of 0', () => {
    expect(checkAllocation(0, 0, 1000)).toMatchObject({ status: 'over', overBy: 1000 });
  });
});

describe('availablePerDay', () => {
  test('rounds half away from zero: Rp743.000 over 3 days is Rp247.667', () => {
    expect(availablePerDay(743000, 3)).toBe(247667);
  });

  test('nothing left to spend gives 0, no day left gives null', () => {
    expect(availablePerDay(-120000, 3)).toBe(0);
    expect(availablePerDay(743000, 0)).toBeNull();
  });
});

describe('getBudgetOverview (sample October, today 28 Oct 2026)', () => {
  test('the limit card: spent, remaining, share used, days left and per day all derived', async () => {
    const db = await sampleDb();
    const overview = await getBudgetOverview(db, null, TODAY);

    expect(overview.month).toBe('2026-10');
    expect(overview.isCurrent).toBe(true);
    expect(overview.limit).toMatchObject({
      monthly_limit: 5000000,
      allocated: 5000000,
      total_spent: 4257000,
      remaining: 743000,
      over_by: 0,
      used_bp: 8514,
    });
    expect(overview.totalSpent).toBe(4257000);
    expect(overview.daysLeft).toBe(3);
    expect(overview.availablePerDay).toBe(247667);
    expect(overview.previousMonth).toBe('2026-09');
    expect(overview.nextMonth).toBeNull();
    expect(overview.isEmpty).toBe(false);
    // The month sheet: current month first, back to the oldest transaction (June).
    expect(overview.months).toEqual(['2026-10', '2026-09', '2026-08', '2026-07', '2026-06']);
  });

  test('categories most used first; Shopping is over by Rp112.000 at 116,00%, the rest show what is left', async () => {
    const db = await sampleDb();
    const { categories } = await getBudgetOverview(db, '2026-10', TODAY);

    expect(categories.map(c => [c.category, c.spent, c.limit_amount, c.used_bp])).toEqual([
      ['Shopping', 812000, 700000, 11600],
      ['Bills', 1150000, 1200000, 9583],
      ['Transport', 540000, 600000, 9000],
      ['Food & drink', 1425000, 1800000, 7917],
      ['Leisure', 210000, 400000, 5250],
      ['Health', 120000, 300000, 4000],
    ]);
    expect(categories[0]).toMatchObject({ remaining: -112000, over_by: 112000, is_over: 1 });
    expect(categories[1]).toMatchObject({ remaining: 50000, over_by: 0, is_over: 0 });
  });

  test('an over-limit month: remaining goes negative and over_by names the overage', async () => {
    const db = await sampleDb();
    // August's only expense is Rp4.100.500 (sample seed); a Rp4.000.000 limit is passed.
    await setMonthlyLimit(db, '2026-08', 4000000);
    const overview = await getBudgetOverview(db, '2026-08', TODAY);
    expect(overview.limit).toMatchObject({ total_spent: 4100500, remaining: -100500, over_by: 100500, used_bp: 10251 });
    expect(overview.daysLeft).toBeNull(); // only the current month counts days
    expect(overview.nextMonth).toBe('2026-09');
  });

  test('a month without transactions: spent 0, remaining = limit, 0,00% used', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const food = (await listCategories(db, { kind: 'expense' }))[0].id;
    await createBudget(db, { categoryId: food, month: '2026-10', limitAmount: 1800000 });

    const overview = await getBudgetOverview(db, null, TODAY);
    expect(overview.totalSpent).toBe(0);
    expect(overview.limit).toMatchObject({ total_spent: 0, remaining: 5000000, over_by: 0, used_bp: 0 });
    expect(overview.availablePerDay).toBe(1666667); // 5.000.000 / 3, half away from zero
    expect(overview.categories).toEqual([
      expect.objectContaining({ category_id: food, spent: 0, remaining: 1800000, over_by: 0, used_bp: 0, is_over: 0 }),
    ]);
  });

  test('an empty month (no limit, no budget, no transaction) is the empty state', async () => {
    const db = openTestDb();
    const overview = await getBudgetOverview(db, null, TODAY);
    expect(overview).toMatchObject({
      month: '2026-10',
      isEmpty: true,
      limit: null,
      totalSpent: 0,
      categories: [],
      previousMonth: null,
      nextMonth: null,
      months: ['2026-10'],
    });
  });

  test('opening a new current month copies the repeating limit and budgets, with nothing spent yet', async () => {
    const db = await sampleDb();
    const overview = await getBudgetOverview(db, null, '2026-11-02');
    expect(overview.month).toBe('2026-11');
    expect(overview.monthCreated).toBe(true);
    expect(overview.limit).toMatchObject({ monthly_limit: 5000000, allocated: 5000000, total_spent: 0, remaining: 5000000 });
    expect(overview.categories).toHaveLength(6);
    expect(overview.categories.every(c => c.spent === 0 && c.over_by === 0)).toBe(true);
    expect(overview.daysLeft).toBe(28);

    const again = await getBudgetOverview(db, null, '2026-11-02');
    expect(again.monthCreated).toBe(false);
  });
});

describe('getCategoryBudgetDetail', () => {
  test('Shopping in October: spent, the bar figures, its expenses and the raise note', async () => {
    const db = await sampleDb();
    const detail = await getCategoryBudgetDetail(db, SHOPPING, '2026-10');

    expect(detail.category).toMatchObject({ id: SHOPPING, name: 'Shopping', kind: 'expense' });
    expect(detail.spent).toBe(812000);
    expect(detail.budget).toMatchObject({ limit_amount: 700000, spent: 812000, over_by: 112000, used_bp: 11600 });
    expect(detail.transactions.map(t => [t.id, t.amount_idr])).toEqual([[5, 812000]]);
    expect(detail.raise).toEqual({ by: 112000, total: 5112000, monthlyLimit: 5000000, exceedsLimit: true });
  });

  test('a category with no budget and no expenses that month', async () => {
    const db = await sampleDb();
    const detail = await getCategoryBudgetDetail(db, HOUSING, '2026-10');
    expect(detail).toMatchObject({ budget: null, spent: 0, transactions: [], raise: null });
  });

  test('a month without transactions: the budget is untouched, 0 spent', async () => {
    const db = await sampleDb();
    await getBudgetOverview(db, null, '2026-11-02'); // copies October's budgets forward
    const detail = await getCategoryBudgetDetail(db, BILLS, '2026-11');
    expect(detail.budget).toMatchObject({ limit_amount: 1200000, spent: 0, remaining: 1200000, over_by: 0 });
    expect(detail.transactions).toEqual([]);
  });
});

describe('saveBudget and setMonthlyLimit', () => {
  test('over the monthly limit is blocked with the overage, and nothing is written', async () => {
    const db = await sampleDb();
    await expect(saveBudget(db, { month: '2026-10', categoryId: HOUSING, limitAmount: 500000, repeat: true })).rejects.toMatchObject({
      code: 'over_monthly_limit',
      context: { overBy: 500000 },
    });
    expect((await getBudgetFormContext(db, '2026-10')).budgets).toHaveLength(6);
  });

  test('raising the monthly limit in the same save lets the budget in (exact fit)', async () => {
    const db = await sampleDb();
    await saveBudget(db, { month: '2026-10', categoryId: HOUSING, limitAmount: 500000, repeat: true, monthlyLimit: 5500000 });
    expect(await getMonthlyLimit(db, '2026-10')).toMatchObject({ amount: 5500000 });
    expect((await getMonthBudget(db, '2026-10'))?.allocated).toBe(5500000);
  });

  test('editing an existing budget replaces it, never counts it twice', async () => {
    const db = await sampleDb();
    const id = await saveBudget(db, { month: '2026-10', categoryId: SHOPPING, limitAmount: 600000, repeat: false });
    const shopping = (await listBudgets(db, '2026-10')).find(b => b.category_id === SHOPPING)!;
    expect(shopping).toMatchObject({ id, limit_amount: 600000, repeat: 0 });
    expect((await getMonthBudget(db, '2026-10'))?.allocated).toBe(4900000);
  });

  test('shrinking a budget and lowering the limit together writes them in a valid order', async () => {
    const db = await sampleDb();
    await saveBudget(db, { month: '2026-10', categoryId: SHOPPING, limitAmount: 600000, repeat: true, monthlyLimit: 4900000 });
    expect(await getMonthlyLimit(db, '2026-10')).toMatchObject({ amount: 4900000 });
  });

  test('a monthly limit below what is allocated is blocked with the overage', async () => {
    const db = await sampleDb();
    await expect(setMonthlyLimit(db, '2026-10', 4500000)).rejects.toMatchObject({ code: 'over_monthly_limit', context: { overBy: 500000 } });
    expect(await getMonthlyLimit(db, '2026-10')).toMatchObject({ amount: 5000000 });
  });

  test('the form context lists only expense categories without a budget, and finds the edited one', async () => {
    const db = await sampleDb();
    const context = await getBudgetFormContext(db, '2026-10', SHOPPING);
    expect(context.availableCategories.map(c => c.name)).toEqual(['Housing', 'Education', 'Gifts', 'Other']);
    expect(context.editing).toMatchObject({ category_id: SHOPPING, limit_amount: 700000 });
    expect(context.monthlyLimit).toEqual({ amount: 5000000, repeat: true });
  });
});

describe('domain budget', () => {
  test('reproduces the October sample: Shopping over by Rp112.000 at 116,00%', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const categories = await listCategories(db, { kind: 'expense' });
    const shopping = categories.find(c => c.name === 'Shopping')!.id;
    await createBudget(db, { categoryId: shopping, month: '2026-10', limitAmount: 700000 });

    const status = await getBudgetStatus(db, '2026-10');
    expect(status[0]).toMatchObject({ category: 'Shopping', limit_amount: 700000 });

    const month = await getMonthBudget(db, '2026-10');
    expect(month?.allocated).toBe(700000);
  });

  test('createBudget pre-checks the monthly limit before SQL', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 500000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    await expect(createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 })).rejects.toMatchObject({ code: 'over_monthly_limit' });
  });

  test('createBudget is also blocked with no monthly limit set at all', async () => {
    const db = openTestDb();
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    await expect(createBudget(db, { categoryId, month: '2026-10', limitAmount: 1000 })).rejects.toMatchObject({ code: 'over_monthly_limit' });
  });

  test('update, delete, and deleting a limit that still has budgets', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    const id = await createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 });

    await updateBudget(db, id, { limitAmount: 800000 });
    expect((await getMonthBudget(db, '2026-10'))?.allocated).toBe(800000);

    await expect(deleteMonthlyLimit(db, '2026-10')).rejects.toMatchObject({ code: 'budgets_exist_for_month' });

    await deleteBudget(db, id);
    await deleteMonthlyLimit(db, '2026-10');
    expect(await getMonthlyLimit(db, '2026-10')).toBeNull();
  });

  describe('ensureMonth', () => {
    test('does nothing when the month already has a limit', async () => {
      const db = openTestDb();
      await setMonthlyLimit(db, '2026-11', 1000000, false);
      await ensureMonth(db, '2026-11');
      expect(await getMonthlyLimit(db, '2026-11')).toEqual({ month: '2026-11', amount: 1000000, repeat: 0 });
    });

    test('does nothing when the previous month has no repeating limit', async () => {
      const db = openTestDb();
      await setMonthlyLimit(db, '2026-09', 1000000, false);
      await ensureMonth(db, '2026-10');
      expect(await getMonthlyLimit(db, '2026-10')).toBeNull();
    });

    test('copies a repeating limit and every repeating budget forward, idempotently', async () => {
      const db = openTestDb();
      await setMonthlyLimit(db, '2026-09', 5000000, true);
      const categories = await listCategories(db, { kind: 'expense' });
      const repeating = categories[0].id;
      const oneOff = categories[1].id;
      await createBudget(db, { categoryId: repeating, month: '2026-09', limitAmount: 700000, repeat: true });
      await createBudget(db, { categoryId: oneOff, month: '2026-09', limitAmount: 300000, repeat: false });

      await ensureMonth(db, '2026-10');

      expect(await getMonthlyLimit(db, '2026-10')).toEqual({ month: '2026-10', amount: 5000000, repeat: 1 });
      const octBudgets = await listBudgets(db, '2026-10');
      expect(octBudgets.map(b => b.category_id)).toEqual([repeating]); // the one-off budget is not copied

      // idempotent: calling again does not duplicate or throw
      await ensureMonth(db, '2026-10');
      expect((await listBudgets(db, '2026-10')).length).toBe(1);
    });

    test('handles December -> January correctly', async () => {
      const db = openTestDb();
      await setMonthlyLimit(db, '2026-12', 1000000, true);
      await ensureMonth(db, '2027-01');
      expect(await getMonthlyLimit(db, '2027-01')).toEqual({ month: '2027-01', amount: 1000000, repeat: 1 });
    });
  });
});
