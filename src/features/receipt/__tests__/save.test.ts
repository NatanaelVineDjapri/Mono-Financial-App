// A reviewed scan is saved through the same function as the manual form, with source 'scan', on a
// database that went through the real migrations. Balances come from the views, nothing is stored.
import * as fs from 'fs';
import * as path from 'path';

import { saveNewTransaction } from '../../../core/tx/save';
import type { TxFormValues } from '../../../core/tx/validate';
import { openMigratedTestDb, openTestDb } from '../../../data/db/openTestDb';
import { findSimilarExpense, getLastUsedAccountId } from '../../../data/repo/transactions';
import type { Db } from '../../../data/db/types';
import { toFormValues, type ScanDraft } from '../draft';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../tools/sample_data.sql'), 'utf8');
const NOW = '2026-10-28T12:41:00+07:00';

async function sample(db: Db): Promise<Db> {
  await db.execAsync(SAMPLE_SQL);
  return db;
}

const DRAFT: ScanDraft = { description: ' Toko Sumber Rejeki ', date: '2026-10-28', dateFromReceipt: true, totals: [48000], amount: 48000, categoryId: 3, accountId: 2 };

describe('saving a scan', () => {
  test('one expense row with source scan, rupiah value on the day, and the balance moved in the view', async () => {
    const db = await sample(await openMigratedTestDb());
    const before = await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = 2');
    const outcome = await saveNewTransaction(db, toFormValues(DRAFT), NOW, 'scan');

    expect(outcome.ok).toBe(true);
    const row = await db.getFirstAsync('select kind, account_id, category_id, amount, amount_idr, occurred_on, description, source from transactions order by id desc limit 1');
    expect(row).toEqual({ kind: 'expense', account_id: 2, category_id: 3, amount: 48000, amount_idr: 48000, occurred_on: '2026-10-28', description: 'Toko Sumber Rejeki', source: 'scan' });
    const after = await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = 2');
    expect(after!.balance).toBe(before!.balance - 48000);
    // the sample's Cash wallet is Rp450.000
    expect(after!.balance).toBe(402000);
    expect(outcome.ok && outcome.value.accountBalanceAfter).toBe(402000);
  });

  test('the manual form still writes manual', async () => {
    const db = await sample(await openMigratedTestDb());
    await saveNewTransaction(db, toFormValues(DRAFT), NOW);
    expect(await db.getFirstAsync('select source from transactions order by id desc limit 1')).toEqual({ source: 'manual' });
  });

  test('the schema is still the backstop: a short balance is refused with the named code and nothing is written', async () => {
    const db = await sample(await openMigratedTestDb());
    const values: TxFormValues = { ...toFormValues(DRAFT), amount: 9_000_000 };
    const outcome = await saveNewTransaction(db, values, NOW, 'scan');
    expect(outcome.ok).toBe(false);
    expect(await db.getFirstAsync('select count(*) as n from transactions where source = ?', ['scan'])).toEqual({ n: 0 });
  });

  test('on a database that has not been migrated, scan is refused by the CHECK (the migration is what allows it)', async () => {
    const db = await sample(openTestDb());
    const outcome = await saveNewTransaction(db, toFormValues(DRAFT), NOW, 'scan');
    expect(outcome.ok).toBe(false);
  });
});

describe('the default account: the one used last', () => {
  test('the account of the latest income or expense, not of a transfer', async () => {
    const db = await sample(await openMigratedTestDb());
    await saveNewTransaction(db, { ...toFormValues(DRAFT), accountId: 3 }, '2026-11-04T10:00:00+07:00');
    expect(await getLastUsedAccountId(db)).toBe(3);
    await saveNewTransaction(db, { ...toFormValues(DRAFT), accountId: 2, amount: 10000 }, '2026-11-04T11:00:00+07:00');
    expect(await getLastUsedAccountId(db)).toBe(2);
  });

  test('none when nothing has been recorded', async () => {
    expect(await getLastUsedAccountId(await openMigratedTestDb())).toBeNull();
  });
});

describe('the duplicate hint', () => {
  async function withExpense(): Promise<Db> {
    const db = await sample(await openMigratedTestDb());
    await saveNewTransaction(db, { ...toFormValues(DRAFT), description: 'Sumber Rejeki', date: '2026-10-27' }, NOW);
    return db;
  }
  const query = (over: Partial<{ accountId: number; amount: number; date: string; from: string; to: string }> = {}) => ({
    accountId: 2,
    amount: 48000,
    date: '2026-10-28',
    from: '2026-10-27',
    to: '2026-10-29',
    ...over,
  });

  test('the same amount in the same account the day before is found', async () => {
    const db = await withExpense();
    expect(await findSimilarExpense(db, query())).toMatchObject({ occurred_on: '2026-10-27', description: 'Sumber Rejeki', amount: 48000 });
  });

  test('a different amount, account or a date two days away is not', async () => {
    const db = await withExpense();
    expect(await findSimilarExpense(db, query({ amount: 48500 }))).toBeNull();
    expect(await findSimilarExpense(db, query({ accountId: 1 }))).toBeNull();
    expect(await findSimilarExpense(db, query({ date: '2026-10-29', from: '2026-10-28', to: '2026-10-30' }))).toBeNull();
  });

  test('an income of the same amount is not an expense like it', async () => {
    const db = await sample(await openMigratedTestDb());
    await db.runAsync(
      "insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('income', 2, 'IDR', 11, 48000, 48000, '2026-10-28', 'Gift', 'manual', ?, ?)",
      [NOW, NOW],
    );
    expect(await findSimilarExpense(db, query())).toBeNull();
  });

  test('the nearest date wins', async () => {
    const db = await withExpense();
    await saveNewTransaction(db, { ...toFormValues(DRAFT), description: 'Same day' }, NOW);
    expect(await findSimilarExpense(db, query())).toMatchObject({ description: 'Same day' });
  });
});
