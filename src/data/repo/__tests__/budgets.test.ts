import { listCategories } from '../categories';
import { openTestDb } from '../../db/openTestDb';
import { createBudget, deleteMonthlyLimit, getMonthBudget, getMonthlyLimit, listBudgetStatus, setMonthlyLimit, updateBudget } from '../budgets';

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
