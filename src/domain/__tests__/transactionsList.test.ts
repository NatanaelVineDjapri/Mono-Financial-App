// Reproduces the October sample numbers (CLAUDE.md "Sample data") through
// src/domain/transactionsList.ts alone — the Transactions tab's own read path.
import { createAccount } from '../accounts';
import { listCategories } from '../../data/repo/categories';
import { openTestDb } from '../../data/db/openTestDb';
import { addExpense, addIncome, addTransfer } from '../transactions';
import { getCurrentPeriod, getEarliestPeriod, getTransactionsPage } from '../transactionsList';

const NOW = '2026-10-28T10:00:00+07:00';

async function buildOctoberSample() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 275000, openingDate: '2026-01-01' }, NOW);
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
  await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: jago, amount: 1000000, occurredOn: '2026-10-27' }, NOW);

  return { db, bca, jago };
}

describe('transactionsList domain', () => {
  test('getCurrentPeriod reads month_start_day (default 1) against today', async () => {
    const { db } = await buildOctoberSample();
    expect(await getCurrentPeriod(db, NOW)).toBe('2026-10');
  });

  test('getTransactionsPage reproduces October: income 7.500.000, expense 4.257.000, net 3.243.000, 1 transfer of 1.000.000', async () => {
    const { db } = await buildOctoberSample();
    const page = await getTransactionsPage(db, '2026-10', {}, NOW);

    expect(page.summary).toEqual({ income: 7500000, expense: 4257000, net: 3243000, transfer_count: 1, transfer_total: 1000000 });
    expect(page.rows).toHaveLength(9);
    expect(page.isCurrent).toBe(true);
    expect(page.isEmpty).toBe(false);
    expect(page.monthLabel).toBe('October 2026');
    expect(page.previousPeriod).toBe('2026-09');
  });

  test('the open (current) period\'s range runs from the 1st to today, not month end', async () => {
    const { db } = await buildOctoberSample();
    const page = await getTransactionsPage(db, '2026-10', {}, NOW);
    expect(page.rangeStart).toBe('2026-10-01');
    expect(page.rangeEnd).toBe('2026-10-28'); // today, per NOW — the month itself runs through the 31st
  });

  test('a past period\'s range runs to its own month end', async () => {
    const { db } = await buildOctoberSample();
    const page = await getTransactionsPage(db, '2026-09', {}, NOW);
    expect(page.rangeStart).toBe('2026-09-01');
    expect(page.rangeEnd).toBe('2026-09-30');
    expect(page.isCurrent).toBe(false);
    expect(page.isEmpty).toBe(true);
  });

  test('filtering by kind narrows both the rows and the summary together', async () => {
    const { db } = await buildOctoberSample();
    const page = await getTransactionsPage(db, '2026-10', { kind: 'expense' }, NOW);
    expect(page.rows).toHaveLength(6);
    expect(page.summary.income).toBe(0);
    expect(page.summary.expense).toBe(4257000);
  });

  test('getEarliestPeriod finds the first period with any record', async () => {
    const { db } = await buildOctoberSample();
    expect(await getEarliestPeriod(db)).toBe('2026-10');
  });
});
