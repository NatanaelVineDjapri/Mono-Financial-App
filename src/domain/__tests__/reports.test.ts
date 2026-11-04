import { createAccount } from '../accounts';
import { addExpense, addIncome } from '../transactions';
import { listCategories } from '../../data/repo/categories';
import { setSetting } from '../../data/repo/settings';
import { openTestDb } from '../../data/db/openTestDb';
import { getPeriodFlow, getSavingsRate, listCategorySpend } from '../reports';

const NOW = '2026-11-03T10:00:00+07:00';

async function octoberSample() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const byName = (n: string) => categories.find(c => c.name === n)!.id;

  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Salary'), amount: 7000000, occurredOn: '2026-10-25' }, NOW);
  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Freelance'), amount: 500000, occurredOn: '2026-10-26' }, NOW);
  for (const [name, amount] of [
    ['Shopping', 812000],
    ['Bills', 1150000],
    ['Transport', 540000],
    ['Food & drink', 1425000],
    ['Leisure', 210000],
    ['Health', 120000],
  ] as const) {
    await addExpense(db, { accountId, currency: 'IDR', categoryId: byName(name), amount, occurredOn: '2026-10-20' }, NOW);
  }
  return { db, categories, byName };
}

describe('domain reports', () => {
  test('reproduces the October sample flow: income 7.500.000, expense 4.257.000, net +3.243.000', async () => {
    const { db } = await octoberSample();
    const flow = await getPeriodFlow(db, '2026-10');
    expect(flow).toMatchObject({ income: 7500000, expense: 4257000, net: 3243000 });
  });

  test('reproduces the October savings rate: 4324 bp', async () => {
    const { db } = await octoberSample();
    expect((await getSavingsRate(db, '2026-10'))?.savings_rate_bp).toBe(4324);
  });

  test('savings rate is null (not zero) when there is no income yet', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    expect(await getSavingsRate(db, '2026-10')).toBeNull();
  });

  test('category spend matches each category in the sample', async () => {
    const { db, byName } = await octoberSample();
    const spend = await listCategorySpend(db, '2026-10');
    expect(spend.find(s => s.category_id === byName('Shopping'))?.spent).toBe(812000);
    expect(spend.find(s => s.category_id === byName('Food & drink'))?.spent).toBe(1425000);
  });

  test('period bucketing follows settings.month_start_day, not just the calendar month', async () => {
    const db = openTestDb();
    await setSetting(db, 'month_start_day', '25');
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const salary = (await listCategories(db, { kind: 'income' })).find(c => c.name === 'Salary')!.id;

    // 24 Sep falls in the August period; 25 Sep starts the September period.
    await addIncome(db, { accountId, currency: 'IDR', categoryId: salary, amount: 1000, occurredOn: '2026-09-24' }, NOW);
    await addIncome(db, { accountId, currency: 'IDR', categoryId: salary, amount: 2000, occurredOn: '2026-09-25' }, NOW);

    expect((await getPeriodFlow(db, '2026-08'))?.income).toBe(1000);
    expect((await getPeriodFlow(db, '2026-09'))?.income).toBe(2000);
  });
});
