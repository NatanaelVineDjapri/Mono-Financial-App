import { openTestDb } from '../../db/openTestDb';
import { createAccount } from '../accounts';
import { listCategories } from '../categories';
import {
  buildTxFilterSql,
  deleteTransaction,
  getEarliestPeriod,
  getPeriodSummary,
  getTransaction,
  insertTransaction,
  listAccountActivity,
  listCategoryTotals,
  listDailyTotals,
  listTransactions,
  listTransactionsForPeriod,
  updateTransaction
} from '../transactions';

const NOW = '2026-01-01T00:00:00+07:00';

async function setup() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
  return { db, accountId, categoryId };
}

describe('transactions repo', () => {
  test('insert, read back via v_tx (with its period column)', async () => {
    const { db, accountId, categoryId } = await setup();
    const id = await insertTransaction(
      db,
      { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 50000, amountIdr: 50000, occurredOn: '2026-01-15' },
      NOW,
    );
    const row = await getTransaction(db, id);
    expect(row?.amount).toBe(50000);
    expect(row?.period).toBe('2026-01');
  });

  test('update changes fields and updated_at', async () => {
    const { db, accountId, categoryId } = await setup();
    const id = await insertTransaction(
      db,
      { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 50000, amountIdr: 50000, occurredOn: '2026-01-15' },
      NOW,
    );
    await updateTransaction(db, id, { amount: 60000, amountIdr: 60000 }, '2026-01-16T00:00:00+07:00');
    const row = await getTransaction(db, id);
    expect(row?.amount).toBe(60000);
    expect(row?.updated_at).toBe('2026-01-16T00:00:00+07:00');
  });

  test('delete removes the row', async () => {
    const { db, accountId, categoryId } = await setup();
    const id = await insertTransaction(
      db,
      { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 50000, amountIdr: 50000, occurredOn: '2026-01-15' },
      NOW,
    );
    await deleteTransaction(db, id);
    expect(await getTransaction(db, id)).toBeNull();
  });

  test('listTransactions filters by period', async () => {
    const { db, accountId, categoryId } = await setup();
    await insertTransaction(db, { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 1000, amountIdr: 1000, occurredOn: '2026-01-05' }, NOW);
    await insertTransaction(db, { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 2000, amountIdr: 2000, occurredOn: '2026-02-05' }, NOW);
    expect((await listTransactions(db, { period: '2026-01' })).length).toBe(1);
  });

  test('listAccountActivity gives a running balance', async () => {
    const { db, accountId, categoryId } = await setup();
    await insertTransaction(db, { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 100000, amountIdr: 100000, occurredOn: '2026-01-05' }, NOW);
    const activity = await listAccountActivity(db, accountId, 'IDR');
    expect(activity[0].balance_after).toBe(900000);
  });
});

describe('transactions repo: Transactions tab queries', () => {
  async function setupMonth() {
    const db = openTestDb();
    const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
    const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 275000, openingDate: '2026-01-01' }, NOW);
    const categories = await listCategories(db);
    const cat = (name: string) => categories.find(c => c.name === name)!.id;

    await insertTransaction(db, { kind: 'income', accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, amountIdr: 7000000, occurredOn: '2026-10-25', description: 'October pay' }, NOW);
    await insertTransaction(db, { kind: 'income', accountId: bca, currency: 'IDR', categoryId: cat('Freelance'), amount: 500000, amountIdr: 500000, occurredOn: '2026-10-26' }, NOW);
    await insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: cat('Shopping'), amount: 812000, amountIdr: 812000, occurredOn: '2026-10-20', note: 'New shoes' }, NOW);
    await insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 1150000, amountIdr: 1150000, occurredOn: '2026-10-20' }, NOW);
    await insertTransaction(db, { kind: 'transfer', accountId: bca, currency: 'IDR', toAccountId: jago, toCurrency: 'IDR', amount: 1000000, amountTo: 1000000, amountIdr: 1000000, occurredOn: '2026-10-27' }, NOW);
    // A different month, to prove period filtering actually scopes the queries.
    await insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 4100500, amountIdr: 4100500, occurredOn: '2026-08-10' }, NOW);

    return { db, bca, jago };
  }

  test('listTransactionsForPeriod scopes to the period and joins category/account names', async () => {
    const { db } = await setupMonth();
    const rows = await listTransactionsForPeriod(db, '2026-10');
    expect(rows).toHaveLength(5);
    const salary = rows.find(r => r.description === 'October pay');
    expect(salary).toMatchObject({ category_name: 'Salary', account_name: 'BCA Tabungan' });
    const transfer = rows.find(r => r.kind === 'transfer');
    expect(transfer).toMatchObject({ account_name: 'BCA Tabungan', to_account_name: 'Jago Pocket', category_name: null });
  });

  test('listTransactionsForPeriod filters by kind', async () => {
    const { db } = await setupMonth();
    expect(await listTransactionsForPeriod(db, '2026-10', { kind: 'income' })).toHaveLength(2);
    expect(await listTransactionsForPeriod(db, '2026-10', { kind: 'transfer' })).toHaveLength(1);
  });

  test('listTransactionsForPeriod search matches description, note, category name and account name', async () => {
    const { db } = await setupMonth();
    expect((await listTransactionsForPeriod(db, '2026-10', { search: 'october pay' }))).toHaveLength(1);
    expect((await listTransactionsForPeriod(db, '2026-10', { search: 'new shoes' }))).toHaveLength(1);
    expect((await listTransactionsForPeriod(db, '2026-10', { search: 'shopping' }))).toHaveLength(1);
    expect((await listTransactionsForPeriod(db, '2026-10', { search: 'jago' }))).toHaveLength(1); // the transfer's destination account
    expect((await listTransactionsForPeriod(db, '2026-10', { search: 'nonexistent' }))).toHaveLength(0);
  });

  test('getPeriodSummary reproduces the October sample totals, excluding the transfer', async () => {
    const { db } = await setupMonth();
    const summary = await getPeriodSummary(db, '2026-10');
    expect(summary).toEqual({ income: 7500000, expense: 1962000, net: 5538000, transfer_count: 1, transfer_total: 1000000 });
  });

  test('getPeriodSummary follows the same filter as the list (kind + search)', async () => {
    const { db } = await setupMonth();
    const incomeOnly = await getPeriodSummary(db, '2026-10', { kind: 'income' });
    expect(incomeOnly).toEqual({ income: 7500000, expense: 0, net: 7500000, transfer_count: 0, transfer_total: 0 });
  });

  test('listDailyTotals groups by day and excludes transfers from the net', async () => {
    const { db } = await setupMonth();
    const daily = await listDailyTotals(db, '2026-10');
    const oct20 = daily.find(d => d.occurred_on === '2026-10-20');
    expect(oct20).toEqual({ occurred_on: '2026-10-20', income: 0, expense: 1962000, net: -1962000 });
    const oct27 = daily.find(d => d.occurred_on === '2026-10-27');
    expect(oct27).toEqual({ occurred_on: '2026-10-27', income: 0, expense: 0, net: 0 });
  });

  test('getEarliestPeriod finds the oldest period regardless of any filter', async () => {
    const { db } = await setupMonth();
    expect(await getEarliestPeriod(db)).toBe('2026-08');
  });

  test('listCategoryTotals sums amount_idr per category for one kind, with the category\'s own name and icon', async () => {
    const { db } = await setupMonth();
    const expense = await listCategoryTotals(db, '2026-10', 'expense');
    expect(expense).toEqual([
      { category_id: expect.any(Number), category_name: 'Bills', category_icon: null, amount_idr: 1150000 },
      { category_id: expect.any(Number), category_name: 'Shopping', category_icon: null, amount_idr: 812000 },
    ]);

    const income = await listCategoryTotals(db, '2026-10', 'income');
    expect(income).toEqual([
      { category_id: expect.any(Number), category_name: 'Salary', category_icon: null, amount_idr: 7000000 },
      { category_id: expect.any(Number), category_name: 'Freelance', category_icon: null, amount_idr: 500000 },
    ]);
  });
});


describe('Transactions filter query builder', () => {
  test('binds a combined date, account, category, and rupiah-amount filter', () => {
    const params: Record<string, string | number> = {};
    const where = buildTxFilterSql({
      startDate: '2026-09-01',
      endDate: '2026-10-28',
      accountIds: [2, 7],
      categoryIds: [3, 5],
      minAmount: 100000,
      maxAmount: 900000,
    }, params);

    expect(where).toContain('t.occurred_on >= $startDate');
    expect(where).toContain('t.occurred_on <= $endDate');
    expect(where).toContain('(t.account_id in ($accountId0, $accountId1) or t.to_account_id in ($accountId0, $accountId1))');
    expect(where).toContain('t.category_id in ($categoryId0, $categoryId1)');
    expect(where).toContain('t.amount_idr >= $minAmount');
    expect(where).toContain('t.amount_idr <= $maxAmount');
    expect(params).toEqual({
      $startDate: '2026-09-01',
      $endDate: '2026-10-28',
      $accountId0: 2,
      $accountId1: 7,
      $categoryId0: 3,
      $categoryId1: 5,
      $minAmount: 100000,
      $maxAmount: 900000,
    });
  });

  test('rejects an amount range whose minimum exceeds its maximum', () => {
    expect(() => buildTxFilterSql({ minAmount: 900000, maxAmount: 100000 }, {})).toThrow(RangeError);
  });
});
