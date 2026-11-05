import { createAccount } from '../../domain/accounts';
import { createBudget, setMonthlyLimit } from '../../domain/budget';
import { createGoal } from '../../domain/goals';
import { addExpense, addIncome } from '../../domain/transactions';
import { openTestDb } from '../../data/db/openTestDb';
import { listCategories } from '../../data/repo/categories';
import { getNetWorth } from '../../domain/net-worth';
import { resetDatabase } from '../resetDatabase';

const NOW = '2026-10-28T10:00:00+07:00';

describe('resetDatabase', () => {
  test('clears entered data but keeps categories and settings', async () => {
    const db = openTestDb();
    const categories = await listCategories(db);
    const categoriesBefore = categories.length;
    const cat = (name: string) => categories.find(c => c.name === name)!.id;

    const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
    await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-10-25' }, NOW);
    await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 100000, occurredOn: '2026-10-26' }, NOW);
    await setMonthlyLimit(db, '2026-10', 5000000);
    await createBudget(db, { categoryId: cat('Bills'), month: '2026-10', limitAmount: 1200000 });
    await createGoal(db, { name: 'Travel fund', mode: 'account', accountId: bca, targetAmount: 8000000 }, NOW);

    expect((await getNetWorth(db)).netWorth).not.toBe(0);

    await resetDatabase(db);

    expect((await getNetWorth(db)).netWorth).toBe(0);
    expect(await db.getAllAsync('select * from accounts')).toHaveLength(0);
    expect(await db.getAllAsync('select * from transactions')).toHaveLength(0);
    expect(await db.getAllAsync('select * from budgets')).toHaveLength(0);
    expect(await db.getAllAsync('select * from goals')).toHaveLength(0);
    expect(await db.getAllAsync('select * from monthly_limits')).toHaveLength(0);

    expect((await listCategories(db)).length).toBe(categoriesBefore);
    expect(await db.getAllAsync('select * from settings')).not.toHaveLength(0);
    expect(await db.getAllAsync('select * from currencies')).not.toHaveLength(0);
  });
});
