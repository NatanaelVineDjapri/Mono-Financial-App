import * as fs from 'fs';
import * as path from 'path';

import { openTestDb } from '../../db/openTestDb';
import {
    createBudget,
    deleteMonthlyLimit,
    getBudgetOverview,
    getCategoryBudgetDetail,
    getMonthBudget,
    getMonthlyLimit,
    listBudgetStatus,
    listCategoriesWithoutBudget,
    setMonthlyLimit,
    updateBudget,
} from '../budgets';
import { listCategories } from '../categories';

describe('budgets repo', () => {
  test('setMonthlyLimit inserts then updates the same month', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    expect(await getMonthlyLimit(db, '2026-10')).toEqual({ month: '2026-10', amount: 5000000, repeat: 1 });

    await setMonthlyLimit(db, '2026-10', 5500000, false);
    expect(await getMonthlyLimit(db, '2026-10')).toEqual({ month: '2026-10', amount: 5500000, repeat: 0 });
  });

  test('create a budget and read its status', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    await createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 });

    const status = await listBudgetStatus(db, '2026-10');
    expect(status).toEqual([{ month: '2026-10', category_id: categoryId, category: expect.any(String), limit_amount: 700000, spent: 0, remaining: 700000, used_bp: 0, is_over: 0 }]);
  });

  test('deleting a monthly limit with budgets still on it is blocked (budgets_exist_for_month)', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    await createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 });
    await expect(deleteMonthlyLimit(db, '2026-10')).rejects.toThrow(/budgets_exist_for_month/);
  });

  test('a budget over the monthly limit is blocked (over_monthly_limit)', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 500000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    await expect(createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 })).rejects.toThrow(/over_monthly_limit/);
  });

  test('getMonthBudget aggregates allocated and spent', async () => {
    const db = openTestDb();
    await setMonthlyLimit(db, '2026-10', 5000000);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    const budgetId = await createBudget(db, { categoryId, month: '2026-10', limitAmount: 700000 });
    await updateBudget(db, budgetId, { limitAmount: 800000 });
    expect((await getMonthBudget(db, '2026-10'))?.allocated).toBe(800000);
  });
});

describe('Budgets screen queries (Fase 4.4)', () => {
  const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../tools/sample_data.sql'), 'utf8');

  async function sampleDb() {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);
    return db;
  }

  test('getBudgetOverview reads the October limit card and the six category rows from the views', async () => {
    const db = await sampleDb();
    const overview = await getBudgetOverview(db, '2026-10');
    expect(overview.limit).toEqual({
      month: '2026-10',
      monthly_limit: 5000000,
      limit_repeat: 1,
      allocated: 5000000,
      total_spent: 4257000,
      remaining: 743000,
      over_by: 0,
      used_bp: 8514,
    });
    expect(overview.totalSpent).toBe(4257000);
    expect(overview.categories[0]).toMatchObject({ category: 'Shopping', remaining: -112000, over_by: 112000, used_bp: 11600, is_over: 1 });
    expect(overview.categories.slice(1).every(c => c.over_by === 0 && c.remaining >= 0)).toBe(true);
  });

  test('getBudgetOverview on a month without transactions or a limit', async () => {
    const db = await sampleDb();
    expect(await getBudgetOverview(db, '2026-09')).toEqual({ month: '2026-09', limit: null, totalSpent: 0, categories: [] });
  });

  test('transfers never count as spent', async () => {
    const db = await sampleDb();
    // The seed's Rp1.000.000 transfer on 27 Oct is not in October's Rp4.257.000.
    const overview = await getBudgetOverview(db, '2026-10');
    expect(overview.totalSpent).toBe(4257000);
  });

  test('getCategoryBudgetDetail reads one category: budget row, spend, month allocation, expenses', async () => {
    const db = await sampleDb();
    const detail = await getCategoryBudgetDetail(db, 4, '2026-10'); // Bills
    expect(detail.category).toEqual({ id: 4, name: 'Bills', kind: 'expense', icon: null });
    expect(detail.budget).toMatchObject({ limit_amount: 1200000, spent: 1150000, remaining: 50000, over_by: 0, used_bp: 9583 });
    expect(detail.spent).toBe(1150000);
    expect(detail.monthlyLimit).toBe(5000000);
    expect(detail.allocated).toBe(5000000);
    expect(detail.transactions.map(t => t.id)).toEqual([6]);
  });

  test('listCategoriesWithoutBudget leaves out budgeted and income categories', async () => {
    const db = await sampleDb();
    expect((await listCategoriesWithoutBudget(db, '2026-10')).map(c => c.name)).toEqual(['Housing', 'Education', 'Gifts', 'Other']);
  });
});
