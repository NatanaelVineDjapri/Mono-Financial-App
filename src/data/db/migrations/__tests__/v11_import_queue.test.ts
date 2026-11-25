// Migration 10 -> 11: the import review queue tables and transactions.source accepting 'import'. The rebuild of
// `transactions` must not lose anything that cascades from it (fixed-expense events, transaction locations), nor any
// view, trigger or index, nor change a number the app reports.
import * as fs from 'fs';
import * as path from 'path';

import type { Db } from '../../types';
import { openTestDb } from '../../openTestDb';
import { migrations, LATEST_SCHEMA_VERSION, runMigrations } from '../index';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../../tools/sample_data.sql'), 'utf8');
const NOW = '2026-11-03T10:00:00+07:00';

// A database at schema version 10 holding the sample, a fixed-expense event and a transaction location.
async function atVersion10(): Promise<Db> {
  const db = openTestDb();
  await db.execAsync(SAMPLE_SQL);
  await db.runAsync("insert into recurring_events (recurring_id, due_on, status, transaction_id, decided_at) values (1, '2026-10-28', 'recorded', 10, ?)", [NOW]);
  for (let version = 1; version < 10; version++) {
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

const insertImported = (db: Db, source: string) =>
  db.runAsync(
    `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
     values ('expense', 2, 'IDR', 1, 25000, 25000, '2026-10-29', 'Kopi', ?, ?, ?)`,
    [source, NOW, NOW],
  );

describe('migration 10 -> 11', () => {
  test('before it, import is not a legal source and the queue does not exist', async () => {
    const db = await atVersion10();
    await expect(insertImported(db, 'import')).rejects.toThrow(/CHECK constraint failed/);
    await expect(db.getAllAsync('select * from import_queue')).rejects.toThrow(/no such table/);
  });

  test('transactions, their cascading children and every reported number are unchanged', async () => {
    const db = await atVersion10();
    const read = async () => ({
      transactions: await db.getAllAsync('select * from transactions order by 1'),
      events: await db.getAllAsync('select * from recurring_events order by 1'),
      locations: await db.getAllAsync('select * from transaction_locations order by 1'),
      netWorth: await db.getAllAsync('select * from v_net_worth'),
      flow: await db.getAllAsync('select * from v_period_flow order by 1'),
      budgets: await db.getAllAsync('select * from v_budget_status order by 1, 2'),
    });
    const before = await read();
    expect(before.transactions).toHaveLength(11);
    expect(before.events).toHaveLength(1);
    expect(before.locations).toHaveLength(1);

    await expect(runMigrations(db, 10, 12)).resolves.toBe(12);

    expect(await read()).toEqual(before);
    expect(await db.getFirstAsync('select * from v_net_worth')).toMatchObject({ net_worth: 8880000 });
  });

  test('every view, trigger and index comes back with the same SQL', async () => {
    const db = await atVersion10();
    const before = await schemaObjects(db);
    await runMigrations(db, 10, 12);
    const after = await schemaObjects(db);
    expect(after.filter(o => before.some(b => b.name === o.name))).toEqual(before);
    // the only new objects are the queue's own index
    expect(after.filter(o => !before.some(b => b.name === o.name)).map(o => o.name).sort()).toEqual(['idx_import_queue_status', 'trg_card_link_account_type_upd', 'trg_card_link_ins']);
  });

  test('the table keeps its shape: only the source CHECK changed', async () => {
    const db = await atVersion10();
    const before = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    await runMigrations(db, 10, 12);
    const after = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    expect(after).toBe(before.replace("'scan'))", "'scan','import','nfc'))"));
  });

  test('import is accepted, an unknown source is still refused, and the guards still work', async () => {
    const db = await atVersion10();
    await runMigrations(db, 10, 12);
    await insertImported(db, 'import');
    expect(await db.getFirstAsync("select source from transactions where description = 'Kopi'")).toEqual({ source: 'import' });
    await expect(insertImported(db, 'bogus')).rejects.toThrow(/CHECK constraint failed/);
    // a future date is still refused by the trigger that was recreated
    await expect(
      db.runAsync(
        `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
         values ('expense', 2, 'IDR', 1, 1000, 1000, '2999-01-01', 'x', 'import', ?, ?)`,
        [NOW, NOW],
      ),
    ).rejects.toThrow(/future_date/);
  });

  test('deleting a transaction still takes its location with it (the cascade survived)', async () => {
    const db = await atVersion10();
    await runMigrations(db, 10, 12);
    await db.runAsync('delete from transactions where id = 5');
    expect(await db.getAllAsync('select * from transaction_locations')).toEqual([]);
  });

  test('the queue: parsed fields only, one row per notification, kind and category may be empty', async () => {
    const db = await atVersion10();
    await runMigrations(db, 10, 12);
    const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(import_queue)')).map(c => c.name);
    expect(columns).toEqual(['id', 'package', 'app_name', 'account_id', 'kind', 'amount_idr', 'merchant', 'category_id', 'guessed', 'occurred_at', 'fingerprint', 'status', 'created_at']);
    // nothing in the table could hold a notification's title or text
    expect(columns.some(c => /text|title|body|message|content/i.test(c))).toBe(false);

    const insert = (fingerprint: string, kind: string | null, amount = 25000) =>
      db.runAsync(
        `insert into import_queue (package, app_name, account_id, kind, amount_idr, merchant, occurred_at, fingerprint, created_at)
         values ('com.gojek.app', 'Gojek', 3, ?, ?, 'Kopi Kenangan', ?, ?, ?)`,
        [kind, amount, NOW, fingerprint, NOW],
      );
    await insert('a', 'expense');
    await insert('b', null); // "Perlu dicek"
    await expect(insert('a', 'expense')).rejects.toThrow(/UNIQUE/); // the same notification twice is one row
    await expect(insert('c', 'transfer')).rejects.toThrow(/CHECK/);
    await expect(insert('d', 'expense', 0)).rejects.toThrow(/CHECK/);
  });

  test('an account that has queued items cannot be deleted from under them', async () => {
    const db = await atVersion10();
    await runMigrations(db, 10, 12);
    await db.runAsync("insert into import_queue (package, app_name, account_id, kind, amount_idr, occurred_at, fingerprint, created_at) values ('p', 'P', 3, 'expense', 1000, ?, 'f', ?)", [NOW, NOW]);
    await db.execAsync('pragma foreign_keys = on');
    await expect(db.runAsync('delete from accounts where id = 3')).rejects.toThrow();
  });

  test('running it again does nothing (the source is already allowed)', async () => {
    const db = await atVersion10();
    await runMigrations(db, 10, 12);
    await expect(migrations[10](db)).rejects.toThrow(/already exists/); // the tables are not created twice
  });
});
