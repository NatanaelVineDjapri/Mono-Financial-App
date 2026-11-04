import { createAccount } from '../accounts';
import { listCategories } from '../categories';
import { openTestDb } from '../../db/openTestDb';
import { deleteTransaction, getTransaction, insertTransaction, listAccountActivity, listTransactions, updateTransaction } from '../transactions';

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
