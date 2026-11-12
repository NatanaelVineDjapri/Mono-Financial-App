// Migration 1 -> 2: transactions.source accepts 'scan' (a transaction that came from a scanned
// receipt), so the CHECK becomes ('manual','ai','recurring','scan').
//
// SQLite cannot change a CHECK in place, so the table is rebuilt. Three things make that
// dangerous and are handled on purpose:
//   - recurring_events.transaction_id references transactions ON DELETE CASCADE. Dropping the
//     old table with foreign keys on would delete those rows, so they are parked in a temp table
//     first and put back after. (PRAGMA foreign_keys cannot be switched inside a transaction.)
//   - 17 views and 23 triggers read or guard transactions. They are dropped before the rebuild
//     and recreated afterwards from their own stored SQL (read from sqlite_master, not copied
//     here), so they come back byte for byte, in their original order. They are also what keeps
//     the historical rows from being judged again by the guards while they are copied across.
//   - The new table's SQL is the old one with only the source CHECK replaced. If the old SQL is
//     not in the form this expects, the migration throws and everything rolls back.
//
// Nothing here stores a derived number. Row counts of transactions and recurring_events are
// compared before and after, and a foreign key violation anywhere throws; the runner wraps the
// whole migration in one exclusive transaction, so a throw leaves the database as it was.
import type { Db } from '../types';

const OLD_CHECK = "CHECK (source IN ('manual','ai','recurring'))";
const NEW_CHECK = "CHECK (source IN ('manual','ai','recurring','scan'))";

interface Dependent {
  type: 'index' | 'view' | 'trigger';
  name: string;
  sql: string;
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function count(db: Db, table: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`);
  return row?.n ?? 0;
}

export async function addScanSource(db: Db): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where type = 'table' and name = 'transactions'");
  if (!table) throw new Error('v2 migration: the transactions table is missing.');
  if (table.sql.includes("'scan'")) return; // already done
  if (!table.sql.includes(OLD_CHECK)) throw new Error('v2 migration: transactions.source CHECK is not in the expected form.');
  const nextSql = table.sql.replace(OLD_CHECK, NEW_CHECK);

  // Everything that has to be recreated, in the order it was created: the indexes of
  // transactions (dropped with the table), every view, every trigger.
  const dependents = await db.getAllAsync<Dependent>(
    `select type, name, sql from sqlite_master
      where sql is not null and (type in ('view', 'trigger') or (type = 'index' and tbl_name = 'transactions'))
      order by rowid`,
  );
  const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(transactions)')).map(c => quote(c.name)).join(', ');

  const txBefore = await count(db, 'transactions');
  const eventsBefore = await count(db, 'recurring_events');

  await db.execAsync('create temp table mig_transactions as select * from transactions');
  await db.execAsync('create temp table mig_recurring_events as select * from recurring_events');

  for (const d of dependents) {
    if (d.type === 'trigger') await db.execAsync(`drop trigger ${quote(d.name)}`);
    if (d.type === 'view') await db.execAsync(`drop view ${quote(d.name)}`);
  }

  // The children go first so that dropping the parent cannot cascade into anything.
  await db.execAsync('delete from recurring_events');
  await db.execAsync('drop table transactions');
  await db.execAsync(nextSql);
  await db.execAsync(`insert into transactions (${columns}) select ${columns} from mig_transactions`);
  await db.execAsync('insert into recurring_events select * from mig_recurring_events');

  for (const d of dependents) await db.execAsync(d.sql);

  await db.execAsync('drop table mig_transactions');
  await db.execAsync('drop table mig_recurring_events');

  const [txAfter, eventsAfter] = [await count(db, 'transactions'), await count(db, 'recurring_events')];
  if (txAfter !== txBefore || eventsAfter !== eventsBefore) {
    throw new Error(`v2 migration: row counts changed (transactions ${txBefore} -> ${txAfter}, recurring_events ${eventsBefore} -> ${eventsAfter}).`);
  }
  const violations = await db.getAllAsync('pragma foreign_key_check');
  if (violations.length > 0) throw new Error('v2 migration: foreign key violations after the rebuild.');
}
