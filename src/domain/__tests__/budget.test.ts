import { listCategories } from '../../data/repo/categories';
import { getMonthlyLimit, listBudgets } from '../../data/repo/budgets';
import { openTestDb } from '../../data/db/openTestDb';
import { createBudget, deleteBudget, deleteMonthlyLimit, ensureMonth, getBudgetStatus, getMonthBudget, setMonthlyLimit, updateBudget } from '../budget';

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
