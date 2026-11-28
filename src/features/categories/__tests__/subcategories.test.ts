// Sub-categories: optional labels inside a category. The rules, the actions, the schema's guard and what a transaction does
// with one (save, edit, undo, delete and put back, backup and restore).
import { createHash } from 'crypto';

import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { runMigrations } from '../../../data/db/migrations';
import type { Db } from '../../../data/db/types';
import { exportBackup } from '../../../data/backup/export';
import { restoreBackup } from '../../../data/backup/restore';
import { listCategories } from '../../../data/repo/categories';
import { getTransaction } from '../../../data/repo/transactions';
import { saveNewTransaction, saveTransactionChanges, undoTransactionChanges } from '../../../core/tx/save';
import { validateTx, type TxFormValues } from '../../../core/tx/validate';
import { createAccount } from '../../../domain/accounts';
import { deleteTransactionWithSnapshot, restoreTransaction } from '../../../domain/transactions';
import { getTxFormData } from '../../../domain/txForm';
import {
  archiveSubcategory,
  checkSubcategoryName,
  createSubcategory,
  deleteSubcategory,
  listForCategory,
  renameSubcategory,
  restoreSubcategory,
  SUBCATEGORY_NAME_MAX,
} from '../subcategories';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture() {
  const db = await openMigratedTestDb();
  const account = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 5_000_000, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;
  return { db, account, food: cat('Food & drink'), transport: cat('Transport'), salary: cat('Salary') };
}

const values = (over: Partial<TxFormValues>): TxFormValues => ({
  type: 'expense',
  amount: 20_000,
  categoryId: null,
  accountId: null,
  toAccountId: null,
  date: '2026-11-02',
  description: 'Makan',
  note: '',
  ...over,
});

describe('checkSubcategoryName', () => {
  test('trimmed, 1 to 30 characters', () => {
    expect(checkSubcategoryName('  Sendiri ', [])).toEqual({ ok: true, name: 'Sendiri' });
    expect(checkSubcategoryName('   ', [])).toEqual({ ok: false, error: { code: 'name_empty' } });
    expect(checkSubcategoryName('x'.repeat(SUBCATEGORY_NAME_MAX + 1), [])).toEqual({ ok: false, error: { code: 'name_too_long' } });
    expect(checkSubcategoryName('x'.repeat(SUBCATEGORY_NAME_MAX), [])).toMatchObject({ ok: true });
  });

  test('unique inside the category without regard to case, archived ones included, and a rename of itself is fine', () => {
    const existing = [{ id: 1, name: 'Sendiri', archived: 0 }, { id: 2, name: 'Berdua', archived: 1 }];
    expect(checkSubcategoryName('sendiri', existing)).toEqual({ ok: false, error: { code: 'name_taken' } });
    expect(checkSubcategoryName('BERDUA', existing)).toEqual({ ok: false, error: { code: 'name_taken_archived' } });
    expect(checkSubcategoryName('SENDIRI', existing, 1)).toEqual({ ok: true, name: 'SENDIRI' });
  });
});

describe('the actions', () => {
  test('create, list (active first), rename, archive, restore', async () => {
    const { db, food } = await fixture();
    const alone = await createSubcategory(db, food, 'Sendiri');
    const together = await createSubcategory(db, food, 'Berdua');
    expect(alone).toMatchObject({ ok: true });
    expect(together).toMatchObject({ ok: true });
    expect((await listForCategory(db, food)).map(s => s.name)).toEqual(['Sendiri', 'Berdua']);

    expect(await renameSubcategory(db, (alone as { value: number }).value, 'Solo')).toEqual({ ok: true, value: undefined });
    await archiveSubcategory(db, (together as { value: number }).value);
    const list = await listForCategory(db, food);
    expect(list.map(s => [s.name, s.archived])).toEqual([['Solo', 0], ['Berdua', 1]]);

    await restoreSubcategory(db, (together as { value: number }).value);
    expect((await listForCategory(db, food)).every(s => s.archived === 0)).toBe(true);
  });

  test('the same name in another category is allowed; the same name twice in one is not', async () => {
    const { db, food, transport } = await fixture();
    expect(await createSubcategory(db, food, 'Kantor')).toMatchObject({ ok: true });
    expect(await createSubcategory(db, transport, 'kantor')).toMatchObject({ ok: true });
    expect(await createSubcategory(db, food, 'KANTOR')).toEqual({ ok: false, error: { code: 'name_taken' } });
  });

  test('a sub-category of a category that does not exist is refused', async () => {
    const { db } = await fixture();
    expect(await createSubcategory(db, 9999, 'X')).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  test('an unused one can be deleted; a used one can only be archived', async () => {
    const { db, food, account } = await fixture();
    const unused = (await createSubcategory(db, food, 'Kosong')) as { value: number };
    const used = (await createSubcategory(db, food, 'Dipakai')) as { value: number };
    await saveNewTransaction(db, values({ categoryId: food, subcategoryId: used.value, accountId: account }), NOW);
    expect(await deleteSubcategory(db, unused.value)).toEqual({ ok: true, value: undefined });
    expect(await deleteSubcategory(db, used.value)).toEqual({ ok: false, error: { code: 'in_use', count: 1 } });
    expect((await listForCategory(db, food)).map(s => [s.name, s.uses])).toEqual([['Dipakai', 1]]);
  });
});

describe('a transaction with a sub-category', () => {
  test('validateTx accepts none, accepts one of the category, refuses one of another category', async () => {
    const { db, food, transport, account } = await fixture();
    const sub = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    const other = (await createSubcategory(db, transport, 'Ojek')) as { value: number };
    const data = await getTxFormData(db);
    const ctx = { today: '2026-11-03', accounts: data.accounts, categories: data.categories, subcategories: data.subcategories };
    const base = values({ categoryId: food, accountId: account });
    expect(validateTx(base, ctx)).toEqual([]);
    expect(validateTx({ ...base, subcategoryId: sub.value }, ctx)).toEqual([]);
    expect(validateTx({ ...base, subcategoryId: other.value }, ctx).map(e => e.code)).toEqual(['subcategory_mismatch']);
    expect(validateTx({ ...base, subcategoryId: 9999 }, ctx).map(e => e.code)).toEqual(['subcategory_mismatch']);
  });

  test('it is saved with the record, and a record without one has none', async () => {
    const { db, food, account } = await fixture();
    const sub = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    const withSub = await saveNewTransaction(db, values({ categoryId: food, subcategoryId: sub.value, accountId: account }), NOW);
    const without = await saveNewTransaction(db, values({ categoryId: food, accountId: account }), NOW);
    expect(withSub.ok && without.ok).toBe(true);
    expect((await getTransaction(db, (withSub as { value: { id: number } }).value.id))?.subcategory_id).toBe(sub.value);
    expect((await getTransaction(db, (without as { value: { id: number } }).value.id))?.subcategory_id).toBeNull();
  });

  test('the schema refuses a sub-category of another category (the backstop behind the form)', async () => {
    const { db, food, transport, account } = await fixture();
    const other = (await createSubcategory(db, transport, 'Ojek')) as { value: number };
    const outcome = await saveNewTransaction(db, values({ categoryId: food, subcategoryId: other.value, accountId: account }), NOW);
    expect(outcome).toMatchObject({ ok: false });
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(0);
  });

  test('editing changes the sub-category; changing the category without a matching sub-category is refused; undo puts it back', async () => {
    const { db, food, transport, account } = await fixture();
    const alone = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    const together = (await createSubcategory(db, food, 'Berdua')) as { value: number };
    const saved = (await saveNewTransaction(db, values({ categoryId: food, subcategoryId: alone.value, accountId: account }), NOW)) as { value: { id: number } };
    const id = saved.value.id;
    const before = (await getTransaction(db, id))!;

    expect(await saveTransactionChanges(db, id, values({ categoryId: food, subcategoryId: together.value, accountId: account }), NOW)).toMatchObject({ ok: true });
    expect((await getTransaction(db, id))?.subcategory_id).toBe(together.value);

    // another category while still carrying the old sub-category: refused, nothing changed
    expect(await saveTransactionChanges(db, id, values({ categoryId: transport, subcategoryId: together.value, accountId: account }), NOW)).toMatchObject({ ok: false });
    expect((await getTransaction(db, id))?.category_id).toBe(food);

    // another category with no sub-category: fine, and the label is gone
    expect(await saveTransactionChanges(db, id, values({ categoryId: transport, subcategoryId: null, accountId: account }), NOW)).toMatchObject({ ok: true });
    expect((await getTransaction(db, id))).toMatchObject({ category_id: transport, subcategory_id: null });

    expect(await undoTransactionChanges(db, before, NOW)).toMatchObject({ ok: true });
    expect((await getTransaction(db, id))).toMatchObject({ category_id: food, subcategory_id: alone.value });
  });

  test('a deleted record comes back with its sub-category', async () => {
    const { db, food, account } = await fixture();
    const sub = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    const saved = (await saveNewTransaction(db, values({ categoryId: food, subcategoryId: sub.value, accountId: account }), NOW)) as { value: { id: number } };
    const snapshot = await deleteTransactionWithSnapshot(db, saved.value.id);
    expect(await getTransaction(db, saved.value.id)).toBeNull();
    await restoreTransaction(db, snapshot!);
    expect((await getTransaction(db, saved.value.id))?.subcategory_id).toBe(sub.value);
  });

  test('the form offers the active sub-categories of active categories, and an edited record keeps its own even when archived', async () => {
    const { db, food, account } = await fixture();
    const alone = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    const gone = (await createSubcategory(db, food, 'Lama')) as { value: number };
    const saved = (await saveNewTransaction(db, values({ categoryId: food, subcategoryId: gone.value, accountId: account }), NOW)) as { value: { id: number } };
    await archiveSubcategory(db, gone.value);
    expect((await getTxFormData(db)).subcategories?.map(s => s.name)).toEqual(['Sendiri']);
    const editing = await getTxFormData(db, saved.value.id);
    expect(editing.subcategories?.map(s => s.name).sort()).toEqual(['Lama', 'Sendiri']);
    expect(editing.record?.subcategoryId).toBe(gone.value);
    void alone;
  });

  test('income can have one too, and a transfer never does', async () => {
    const { db, salary, account } = await fixture();
    const sub = (await createSubcategory(db, salary, 'Bonus')) as { value: number };
    const income = await saveNewTransaction(db, values({ type: 'income', categoryId: salary, subcategoryId: sub.value, accountId: account }), NOW);
    expect(income).toMatchObject({ ok: true });
    await expect(db.runAsync("update transactions set kind = 'transfer' where subcategory_id is not null")).rejects.toThrow();
  });
});

describe('backup and restore', () => {
  test('sub-categories and the labels on transactions survive a round trip', async () => {
    const { db, food, account } = await fixture();
    const sub = (await createSubcategory(db, food, 'Sendiri')) as { value: number };
    await saveNewTransaction(db, values({ categoryId: food, subcategoryId: sub.value, accountId: account }), NOW);
    const file = await exportBackup(db, NOW, sha256Hex);
    expect(file.counts.subcategories).toBe(1);

    const fresh = await openMigratedTestDb();
    const result = await restoreBackup(fresh, JSON.stringify(file), NOW, sha256Hex);
    expect(result).toMatchObject({ ok: true });
    expect((await listForCategory(fresh, food)).map(s => s.name)).toEqual(['Sendiri']);
    expect((await fresh.getFirstAsync<{ n: number }>('select count(*) as n from transactions where subcategory_id is not null'))!.n).toBe(1);
  });

  test('a backup file from before sub-categories still restores, with no labels', async () => {
    const { db, food, account } = await fixture();
    await saveNewTransaction(db, values({ categoryId: food, accountId: account }), NOW);
    const file = await exportBackup(db, NOW, sha256Hex);
    // as the app of version 12 wrote it: no subcategories table, no subcategory_id column, its own checksum
    const legacyData: Record<string, unknown> = { ...file.data };
    delete legacyData.subcategories;
    legacyData.transactions = file.data.transactions.map(({ subcategory_id: _dropped, ...row }) => row);
    const ordered = Object.fromEntries(Object.keys(file.data).filter(t => t !== 'subcategories').map(t => [t, legacyData[t]]));
    const counts: Record<string, number> = { ...file.counts };
    delete counts.subcategories;
    const legacy = { ...file, schema_version: 12, data: legacyData, counts, checksum: `sha256:${await sha256Hex(JSON.stringify(ordered))}` };

    const fresh = await openMigratedTestDb();
    expect(await restoreBackup(fresh, JSON.stringify(legacy), NOW, sha256Hex)).toMatchObject({ ok: true });
    expect((await fresh.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(1);
    expect((await fresh.getFirstAsync<{ n: number }>('select count(*) as n from subcategories'))!.n).toBe(0);
  });
});

describe('migration 12 -> 13', () => {
  test('an existing database keeps every transaction (all without a sub-category) and gets the table and the guard', async () => {
    const db: Db = await openMigratedTestDb();
    // the database at version 12: the migrated one with the v13 objects taken away and the version put back
    await db.execAsync(`
      DROP TRIGGER trg_tx_subcategory_ins; DROP TRIGGER trg_tx_subcategory_upd; DROP INDEX ix_tx_subcategory;
      ALTER TABLE transactions DROP COLUMN subcategory_id;
      DROP TABLE subcategories;
      UPDATE meta SET value = '12' WHERE key = 'schema_version';
    `);
    const acc = (await db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('A', 'bank', 1000, '2026-01-01', ?)", [NOW])).lastInsertRowId;
    const cat = (await db.getFirstAsync<{ id: number }>("select id from categories where name = 'Food & drink'"))!.id;
    await db.runAsync(
      "insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('expense', ?, 'IDR', ?, 100, 100, '2026-02-01', 'x', 'manual', ?, ?)",
      [acc, cat, NOW, NOW],
    );
    await expect(runMigrations(db, 12, 13)).resolves.toBe(13);
    expect(await db.getFirstAsync('select subcategory_id from transactions')).toEqual({ subcategory_id: null });
    expect(await db.getAllAsync('select * from subcategories')).toEqual([]);
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
    await expect(runMigrations(db, 13, 13)).resolves.toBe(13); // nothing left to run
  });
});
