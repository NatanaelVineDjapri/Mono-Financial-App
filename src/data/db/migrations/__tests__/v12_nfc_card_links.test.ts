// Migration 11 -> 12: card_links, the two system categories of a balance adjustment, and transactions.source
// accepting 'nfc'. The rebuild of `transactions` must not lose anything that cascades from it, nor any view, trigger or
// index, nor change a number the app reports.
import * as fs from 'fs';
import * as path from 'path';

import type { Db } from '../../types';
import { openTestDb } from '../../openTestDb';
import { LATEST_SCHEMA_VERSION, migrations, runMigrations } from '../index';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../../tools/sample_data.sql'), 'utf8');
const NOW = '2026-11-03T10:00:00+07:00';

// A database at schema version 11 holding the sample, a fixed-expense event and a transaction location.
async function atVersion11(): Promise<Db> {
  const db = openTestDb();
  await db.execAsync(SAMPLE_SQL);
  await db.runAsync("insert into recurring_events (recurring_id, due_on, status, transaction_id, decided_at) values (1, '2026-10-28', 'recorded', 10, ?)", [NOW]);
  for (let version = 1; version < 11; version++) {
    await db.withExclusiveTransactionAsync(async txn => {
      await migrations[version](txn);
      await txn.runAsync("update meta set value = ? where key = 'schema_version'", [String(version + 1)]);
    });
  }
  await db.runAsync("insert into transaction_locations (transaction_id, lat_e6, lng_e6, accuracy_m, place_name, captured_at) values (5, -6200000, 106816666, 20, 'Toko', ?)", [NOW]);
  return db;
}

interface SchemaObject {
  type: string;
  name: string;
  sql: string;
}
const schemaObjects = (db: Db) => db.getAllAsync<SchemaObject>("select type, name, sql from sqlite_master where sql is not null and type in ('view','trigger','index') order by type, name");

const insertTx = (db: Db, source: string, categoryId = 1) =>
  db.runAsync(
    `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
     values ('expense', 2, 'IDR', ?, 16000, 16000, '2026-10-29', 'Penyesuaian', ?, ?, ?)`,
    [categoryId, source, NOW, NOW],
  );

const link = (db: Db, accountId: number, fingerprint = 'f1', last4 = '7731', issuer = 'mandiri') =>
  db.runAsync('insert into card_links (account_id, issuer, last4, fingerprint, linked_at) values (?, ?, ?, ?, ?)', [accountId, issuer, last4, fingerprint, NOW]);

describe('migration 11 -> 12', () => {
  test('before it, nfc is not a legal source and card_links does not exist', async () => {
    const db = await atVersion11();
    await expect(insertTx(db, 'nfc')).rejects.toThrow(/CHECK constraint failed/);
    await expect(db.getAllAsync('select * from card_links')).rejects.toThrow(/no such table/);
  });

  test('transactions, their cascading children and every reported number are unchanged', async () => {
    const db = await atVersion11();
    const read = async () => ({
      transactions: await db.getAllAsync('select * from transactions order by 1'),
      events: await db.getAllAsync('select * from recurring_events order by 1'),
      locations: await db.getAllAsync('select * from transaction_locations order by 1'),
      netWorth: await db.getAllAsync('select * from v_net_worth'),
      flow: await db.getAllAsync('select * from v_period_flow order by 1'),
      budgets: await db.getAllAsync('select * from v_budget_status order by 1, 2'),
      balances: await db.getAllAsync('select * from v_account_balance order by 1'),
    });
    const before = await read();
    expect(before.transactions).toHaveLength(11);
    expect(before.events).toHaveLength(1);
    expect(before.locations).toHaveLength(1);

    await expect(runMigrations(db, 11)).resolves.toBe(LATEST_SCHEMA_VERSION);

    expect(await read()).toEqual(before);
    expect(await db.getFirstAsync('select * from v_net_worth')).toMatchObject({ net_worth: 8880000 });
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('every view, trigger and index comes back with the same SQL; the only new objects are the two guards', async () => {
    const db = await atVersion11();
    const before = await schemaObjects(db);
    await runMigrations(db, 11);
    const after = await schemaObjects(db);
    expect(after.filter(o => before.some(b => b.name === o.name))).toEqual(before);
    expect(after.filter(o => !before.some(b => b.name === o.name)).map(o => o.name).sort()).toEqual(['trg_card_link_account_type_upd', 'trg_card_link_ins']);
  });

  test('the table keeps its shape: only the source CHECK changed', async () => {
    const db = await atVersion11();
    const before = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    await runMigrations(db, 11);
    const after = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    expect(after).toBe(before.replace("'import'))", "'import','nfc'))"));
  });

  test('nfc is accepted, an unknown source is still refused, and the guards still work', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await insertTx(db, 'nfc');
    expect(await db.getFirstAsync("select source from transactions where description = 'Penyesuaian'")).toEqual({ source: 'nfc' });
    await expect(insertTx(db, 'bogus')).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      db.runAsync(
        `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
         values ('expense', 2, 'IDR', 1, 1000, 1000, '2999-01-01', 'x', 'nfc', ?, ?)`,
        [NOW, NOW],
      ),
    ).rejects.toThrow(/future_date/);
  });

  test('deleting a transaction still takes its location with it (the cascade survived)', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await db.runAsync('delete from transactions where id = 5');
    expect(await db.getAllAsync('select * from transaction_locations')).toEqual([]);
  });

  test('the two system categories are made once, one per kind', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    const rows = await db.getAllAsync<{ kind: string; archived: number }>("select kind, archived from categories where name = 'Penyesuaian saldo' order by kind");
    expect(rows).toEqual([{ kind: 'expense', archived: 0 }, { kind: 'income', archived: 0 }]);
  });

  test('a category the person already made with that name (any case) is reused, not doubled', async () => {
    const db = await atVersion11();
    await db.runAsync("insert into categories (name, kind, icon, sort_order, archived) values ('penyesuaian SALDO', 'expense', 'tag', 99, 0)");
    await runMigrations(db, 11);
    expect(await db.getAllAsync("select name, kind from categories where name = 'Penyesuaian saldo' order by kind")).toEqual([
      { name: 'penyesuaian SALDO', kind: 'expense' },
      { name: 'Penyesuaian saldo', kind: 'income' },
    ]);
  });

  test('card_links: only digits for the last 4, a known issuer, one card per account and one account per card', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await link(db, 3);
    expect(await db.getFirstAsync('select issuer, last4, fingerprint from card_links where account_id = 3')).toEqual({ issuer: 'mandiri', last4: '7731', fingerprint: 'f1' });
    await db.runAsync("update accounts set type = 'ewallet' where id = 4");
    await expect(link(db, 4, 'f1')).rejects.toThrow(/UNIQUE/); // the same card on a second account
    await expect(link(db, 3, 'f2')).rejects.toThrow(/UNIQUE|PRIMARY/); // a second card on the same account
    await expect(link(db, 4, 'f3', '77a1')).rejects.toThrow(/CHECK/);
    await expect(link(db, 4, 'f3', '773')).rejects.toThrow(/CHECK/);
    await expect(link(db, 4, 'f3', '7731', 'visa')).rejects.toThrow(/CHECK/);
  });

  test('only an e-wallet account can be linked, and a linked account keeps its type', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await expect(link(db, 1)).rejects.toThrow(/card_link_needs_ewallet/); // a bank account
    await link(db, 3);
    await expect(db.runAsync("update accounts set type = 'bank' where id = 3")).rejects.toThrow(/account_type_locked/);
    await db.runAsync("update accounts set name = 'GoPay 2' where id = 3"); // anything else is fine
  });

  test('a restore (guards_off) may bring its links back without the guards', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await db.runAsync("update meta set value = '1' where key = 'guards_off'");
    await link(db, 1); // would be refused otherwise
    await db.runAsync("update meta set value = '0' where key = 'guards_off'");
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from card_links'))!.n).toBe(1);
  });

  test('the link goes with its account', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Flazz', 'ewallet', 0, '2026-01-01', ?)", [NOW]);
    const id = (await db.getFirstAsync<{ id: number }>("select id from accounts where name = 'Flazz'"))!.id;
    await link(db, id, 'f9', '0001', 'flazz');
    await db.execAsync('pragma foreign_keys = on');
    await db.runAsync('delete from accounts where id = ?', [id]);
    expect(await db.getAllAsync('select * from card_links')).toEqual([]);
  });

  test('running it again does nothing harmful (the tables are not created twice)', async () => {
    const db = await atVersion11();
    await runMigrations(db, 11);
    await expect(migrations[11](db)).rejects.toThrow(/already exists/);
  });
});
