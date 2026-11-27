// Archiving and deleting accounts, and deleting archived categories: money must never appear or vanish by moving records.
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { deleteArchivedCategory, getCategoryRemoval } from '../../features/categories/removal';
import { archiveAccount, createAccount, deleteArchivedAccount, getAccountRemoval, restoreAccount } from '../accounts';
import { getTxFormData } from '../txForm';

const NOW = '2026-10-28T10:00:00.000Z';

async function account(db: Db, name: string, openingBalance: number, openingDate = '2026-10-01'): Promise<number> {
  return createAccount(db, { name, type: 'bank', openingBalance, openingDate }, NOW);
}

async function category(db: Db, name: string, kind: 'expense' | 'income' = 'expense'): Promise<number> {
  return (await db.runAsync('insert into categories (name, kind) values ($name, $kind)', { $name: name, $kind: kind })).lastInsertRowId;
}

async function spend(db: Db, accountId: number, categoryId: number, amount: number): Promise<number> {
  return (
    await db.runAsync(
      "insert into transactions (kind, account_id, category_id, amount, amount_idr, occurred_on, created_at, updated_at) values ('expense', $a, $c, $n, $n, '2026-10-10', $now, $now)",
      { $a: accountId, $c: categoryId, $n: amount, $now: NOW },
    )
  ).lastInsertRowId;
}

async function transfer(db: Db, from: number, to: number, amount: number): Promise<void> {
  await db.runAsync(
    "insert into transactions (kind, account_id, to_account_id, to_currency, amount, amount_to, amount_idr, occurred_on, created_at, updated_at) values ('transfer', $f, $t, 'IDR', $n, $n, $n, '2026-10-11', $now, $now)",
    { $f: from, $t: to, $n: amount, $now: NOW },
  );
}

const balance = async (db: Db, id: number) => (await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = $id', { $id: id }))?.balance;
const netWorth = async (db: Db) => (await db.getFirstAsync<{ net_worth: number }>('select net_worth from v_net_worth'))!.net_worth;
const count = async (db: Db, sql: string) => (await db.getFirstAsync<{ n: number }>(sql))!.n;

describe('accounts', () => {
  test('deleting a used account moves its records and balance; net worth and the other accounts keep their money', async () => {
    const db = await openMigratedTestDb();
    const food = await category(db, 'Jajan');
    const old = await account(db, 'Lama', 500_000, '2026-09-01');
    const keep = await account(db, 'Baru', 200_000);
    const third = await account(db, 'Lain', 100_000);
    await spend(db, old, food, 50_000);
    await transfer(db, old, keep, 100_000); // between the two being merged: cancels out
    await transfer(db, old, third, 30_000); // to another account: moves with the records
    const before = await netWorth(db);
    const oldBalance = (await balance(db, old))!;
    const keepBalance = (await balance(db, keep))!;
    const thirdBalance = await balance(db, third);

    expect(await archiveAccount(db, old)).toEqual({ ok: true });
    expect(await netWorth(db)).toBe(before); // archived money still counts
    expect(await deleteArchivedAccount(db, old, null, NOW)).toEqual({ ok: false, error: 'needs_replacement' });
    expect((await getAccountRemoval(db, old))!.replacements.map(a => a.id)).toEqual([keep, third]);
    expect(await deleteArchivedAccount(db, old, keep, NOW)).toEqual({ ok: true });

    expect(await netWorth(db)).toBe(before);
    expect(await balance(db, keep)).toBe(oldBalance + keepBalance);
    expect(await balance(db, third)).toBe(thirdBalance);
    expect(await count(db, `select count(*) as n from accounts where id = ${old}`)).toBe(0);
    expect(await count(db, 'select count(*) as n from transactions')).toBe(2);
    expect(await db.getFirstAsync('select opening_date from accounts where id = $id', { $id: keep })).toEqual({ opening_date: '2026-09-01' });
    expect(await db.getFirstAsync("select value from meta where key = 'guards_off'")).toEqual({ value: '0' });
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('an account with nothing recorded is deleted as it is; only an archived one', async () => {
    const db = await openMigratedTestDb();
    const empty = await account(db, 'Kosong', 75_000);
    expect(await deleteArchivedAccount(db, empty, null, NOW)).toEqual({ ok: false, error: 'not_archived' });
    await archiveAccount(db, empty);
    await restoreAccount(db, empty);
    await archiveAccount(db, empty);
    expect(await deleteArchivedAccount(db, empty, null, NOW)).toEqual({ ok: true });
    expect(await netWorth(db)).toBe(0);
  });

  test('a goal or a running fixed expense blocks archiving', async () => {
    const db = await openMigratedTestDb();
    const food = await category(db, 'Jajan');
    const a = await account(db, 'A', 100_000);
    await db.runAsync("insert into goals (name, mode, account_id, target_amount, created_at) values ('G', 'account', $a, 1000, $now)", { $a: a, $now: NOW });
    expect(await archiveAccount(db, a)).toEqual({ ok: false, error: 'in_goal' });
    await db.runAsync('delete from goals', {});
    await db.runAsync(
      "insert into recurring (name, amount, account_id, category_id, day_of_month, first_due_on, created_at) values ('R', 1000, $a, $c, 1, '2026-11-01', $now)",
      { $a: a, $c: food, $now: NOW },
    );
    expect(await archiveAccount(db, a)).toEqual({ ok: false, error: 'in_fixed_expense' });
  });

  test('editing an old record still offers its archived account', async () => {
    const db = await openMigratedTestDb();
    const food = await category(db, 'Jajan');
    const a = await account(db, 'A', 100_000);
    const id = await spend(db, a, food, 10_000);
    await archiveAccount(db, a);
    expect((await getTxFormData(db)).accounts.map(x => x.id)).not.toContain(a);
    expect((await getTxFormData(db, id)).accounts.map(x => x.id)).toContain(a);
  });
});

describe('categories', () => {
  test('deleting a used category moves its records to the replacement and drops budgets and sub-categories', async () => {
    const db = await openMigratedTestDb();
    const a = await account(db, 'A', 1_000_000);
    const old = await category(db, 'Jajan');
    const keep = await category(db, 'Makan');
    const income = await category(db, 'Bonus', 'income');
    const id = await spend(db, a, old, 10_000);
    const sub = (await db.runAsync("insert into subcategories (category_id, name) values ($c, 'Kopi')", { $c: old })).lastInsertRowId;
    await db.runAsync('update transactions set subcategory_id = $s where id = $id', { $s: sub, $id: id });
    await db.runAsync("insert into monthly_limits (month, amount) values ('2026-10', 100000)", {});
    await db.runAsync("insert into budgets (category_id, month, limit_amount) values ($c, '2026-10', 50000)", { $c: old });
    const before = await netWorth(db);

    expect(await deleteArchivedCategory(db, old, keep, NOW)).toEqual({ ok: false, error: 'not_archived' });
    await db.runAsync('update categories set archived = 1 where id = $id', { $id: old });
    expect(await deleteArchivedCategory(db, old, null, NOW)).toEqual({ ok: false, error: 'needs_replacement' });
    expect(await deleteArchivedCategory(db, old, income, NOW)).toEqual({ ok: false, error: 'bad_replacement' });
    expect((await getCategoryRemoval(db, old))!.links).toMatchObject({ records: 1, budgets: 1, fixedExpenses: 0 });
    expect(await deleteArchivedCategory(db, old, keep, NOW)).toEqual({ ok: true });

    expect(await db.getFirstAsync('select category_id, subcategory_id from transactions where id = $id', { $id: id })).toEqual({ category_id: keep, subcategory_id: null });
    expect(await count(db, `select count(*) as n from categories where id = ${old}`)).toBe(0);
    expect(await count(db, 'select count(*) as n from budgets')).toBe(0);
    expect(await count(db, 'select count(*) as n from subcategories')).toBe(0);
    expect(await netWorth(db)).toBe(before);
  });

  test('an unused archived category is simply deleted', async () => {
    const db = await openMigratedTestDb();
    const unused = await category(db, 'Tak dipakai');
    await db.runAsync('update categories set archived = 1 where id = $id', { $id: unused });
    expect(await deleteArchivedCategory(db, unused, null, NOW)).toEqual({ ok: true });
    expect(await count(db, `select count(*) as n from categories where id = ${unused}`)).toBe(0);
  });
});
