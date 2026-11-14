// Migration 1 -> 2 on a database that has data: the 11 transactions of the sample dataset, its
// budgets, goals and fixed expenses, plus one fixed-expense event that points at a transaction
// (the row a careless table rebuild would cascade away). Everything the views read must come
// out the same, every view/trigger/index must come back with the same SQL, and only then does
// 'scan' become a legal source.
import * as fs from 'fs';
import * as path from 'path';

import type { Db } from '../../types';
import { openTestDb } from '../../openTestDb';
import { runMigrations } from '../index';
import { addScanSource } from '../v2_scan_source';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../../tools/sample_data.sql'), 'utf8');
const NOW = '2026-11-03T10:00:00+07:00';

async function seeded(): Promise<Db> {
  const db = openTestDb();
  await db.execAsync(SAMPLE_SQL);
  // Gym (recurring 1) recorded as transaction 10: deleting that transaction must still take the event with it.
  await db.runAsync("insert into recurring_events (recurring_id, due_on, status, transaction_id, decided_at) values (1, '2026-10-28', 'recorded', 10, ?)", [NOW]);
  await db.runAsync("insert into recurring_events (recurring_id, due_on, status, transaction_id, decided_at) values (2, '2026-10-31', 'skipped', NULL, ?)", [NOW]);
  return db;
}

interface SchemaObject {
  type: string;
  name: string;
  sql: string;
}

async function schemaObjects(db: Db): Promise<SchemaObject[]> {
  return db.getAllAsync<SchemaObject>("select type, name, sql from sqlite_master where sql is not null and type in ('view','trigger','index') order by type, name");
}

// Everything the app reads about money, from the views.
async function readings(db: Db) {
  return {
    pockets: await db.getAllAsync('select * from v_pocket_balance order by 1, 2, 3'),
    accounts: await db.getAllAsync('select * from v_account_balance order by 1, 2, 3'),
    netWorth: await db.getAllAsync('select * from v_net_worth'),
    flow: await db.getAllAsync('select * from v_period_flow order by 1, 2, 3'),
    savings: await db.getAllAsync('select * from v_savings_rate order by 1, 2, 3'),
    spend: await db.getAllAsync('select * from v_category_spend order by 1, 2, 3'),
    budgets: await db.getAllAsync('select * from v_budget_status order by 1, 2, 3'),
    goals: await db.getAllAsync('select * from v_goal_progress order by 1, 2, 3'),
    activity: await db.getAllAsync('select * from v_account_activity order by 1, 2, 3'),
  };
}

const insertScan = (db: Db, source: string, date = '2026-10-29') =>
  db.runAsync(
    `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
     values ('expense', 2, 'IDR', 1, 48000, 48000, ?, 'Toko Sumber Rejeki', ?, ?, ?)`,
    [date, source, NOW, NOW],
  );

describe('migration 1 -> 2: transactions.source accepts scan', () => {
  test('before the migration, scan is not a legal source', async () => {
    const db = await seeded();
    await expect(insertScan(db, 'scan')).rejects.toThrow(/CHECK constraint failed/);
  });

  test('the data, the views and the reported numbers are the same afterwards', async () => {
    const db = await seeded();
    const before = await readings(db);
    const rowsBefore = await db.getAllAsync('select * from transactions order by 1, 2, 3');
    const eventsBefore = await db.getAllAsync('select * from recurring_events order by 1, 2, 3');
    expect(rowsBefore).toHaveLength(11);
    expect(eventsBefore).toHaveLength(2);

    await expect(runMigrations(db, 1)).resolves.toBe(8);

    expect(await db.getAllAsync('select * from transactions order by 1, 2, 3')).toEqual(rowsBefore);
    expect(await db.getAllAsync('select * from recurring_events order by 1, 2, 3')).toEqual(eventsBefore);
    expect(await readings(db)).toEqual(before);
    // The sample's own numbers (DESIGN.md section 10): net worth Rp8.880.000, October income/expense.
    expect(await db.getFirstAsync('select * from v_net_worth')).toMatchObject({ net_worth: 8880000 });
    expect(await db.getAllAsync("select * from v_period_flow where period = '2026-10'")).toEqual([
      expect.objectContaining({ income: 7500000, expense: 4257000 }),
    ]);
    expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '8' });
  });

  test('every view, trigger and index comes back with the same SQL (17 views, 23 triggers)', async () => {
    const db = await seeded();
    const before = await schemaObjects(db);
    expect(before.filter(o => o.type === 'view')).toHaveLength(17);
    expect(before.filter(o => o.type === 'trigger')).toHaveLength(23);

    await runMigrations(db, 1);

    // Later migrations add objects of their own (v3's table and triggers); everything that was
    // there before migration 1 -> 2 is unchanged, except the goal view that migration 6 -> 7 rebuilds.
    const rebuilt = new Set(['v_goal_progress']);
    const keep = (o: { name: string }) => !rebuilt.has(o.name);
    expect((await schemaObjects(db)).filter(o => before.some(b => b.name === o.name)).filter(keep)).toEqual(before.filter(keep));
  });

  test('the table keeps its shape: only the source CHECK changed', async () => {
    const db = await seeded();
    const before = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    await runMigrations(db, 1);
    const after = (await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql;
    expect(after).toBe(before.replace("'recurring'))", "'recurring','scan'))"));
  });

  test('scan is accepted, an unknown source is still refused', async () => {
    const db = await seeded();
    await runMigrations(db, 1);

    await insertScan(db, 'scan');
    expect(await db.getFirstAsync("select source from transactions where description = 'Toko Sumber Rejeki'")).toEqual({ source: 'scan' });
    await expect(insertScan(db, 'bogus')).rejects.toThrow(/CHECK constraint failed/);
    for (const source of ['manual', 'ai', 'recurring']) await insertScan(db, source);
  });

  test('the guards still work: the triggers were recreated, not lost', async () => {
    const db = await seeded();
    await runMigrations(db, 1);
    await expect(insertScan(db, 'scan', '2999-01-01')).rejects.toThrow('future_date');
    await expect(insertScan(db, 'scan', '2025-12-31')).rejects.toThrow('before_opening_date');
  });

  test('the foreign keys still work: deleting a transaction takes its fixed-expense event with it', async () => {
    const db = await seeded();
    await runMigrations(db, 1);
    expect(await db.getAllAsync('pragma foreign_key_check')).toEqual([]);
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);

    await db.runAsync('delete from transactions where id = 10');
    const events = await db.getAllAsync<{ recurring_id: number }>('select recurring_id from recurring_events');
    expect(events).toEqual([{ recurring_id: 2 }]); // only the skipped one is left
  });

  test('an empty database migrates too, and running it again changes nothing', async () => {
    const db = openTestDb();
    await runMigrations(db, 1);
    await expect(addScanSource(db)).resolves.toBeUndefined();
    expect((await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where name = 'transactions'"))!.sql).toContain("'recurring','scan'");
  });

  test('if the migration fails half way, nothing is changed', async () => {
    const db = await seeded();
    const before = await schemaObjects(db);
    const rowsBefore = await db.getAllAsync('select * from transactions order by 1, 2, 3');
    // Break the migration after the table has been rebuilt: the runner's transaction rolls it all back.
    const failing = {
      ...db,
      getAllAsync: async (sql: string, params?: unknown) => {
        if (sql === 'pragma foreign_key_check') return [{ table: 'transactions' }];
        return db.getAllAsync(sql, params as never);
      },
    } as Db;
    await expect(db.withExclusiveTransactionAsync(async txn => addScanSource({ ...txn, getAllAsync: failing.getAllAsync }))).rejects.toThrow(/foreign key/);

    expect(await schemaObjects(db)).toEqual(before);
    expect(await db.getAllAsync('select * from transactions order by 1, 2, 3')).toEqual(rowsBefore);
    await expect(insertScan(db, 'scan')).rejects.toThrow(/CHECK constraint failed/);
    expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '1' });
  });
});
