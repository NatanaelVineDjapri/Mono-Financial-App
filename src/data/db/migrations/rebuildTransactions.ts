// Changing a CHECK of `transactions` means rebuilding the table (SQLite cannot alter a CHECK). Migrations 1 -> 2 and
// 10 -> 11 did it for the `source` column; this is the same procedure, written once, for the next ones (see
// v2_scan_source.ts and v11_import_queue.ts for the reasoning).
//
// The children that cascade from transactions are parked first and put back after: recurring_events and
// transaction_locations. Every view, trigger and index is dropped and recreated from its own stored SQL. Row counts are
// compared and a foreign key violation throws, which rolls the whole migration back.
import type { Db } from '../types';

// Rows that point at transactions with ON DELETE CASCADE: dropping the parent would delete them.
const CASCADE_CHILDREN = ['recurring_events', 'transaction_locations'] as const;

interface Dependent {
  type: 'index' | 'view' | 'trigger';
  name: string;
  sql: string;
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function count(db: Db, table: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${quote(table)}`);
  return row?.n ?? 0;
}

async function tableExists(db: Db, table: string): Promise<boolean> {
  return (await db.getFirstAsync("select 1 as x from sqlite_master where type = 'table' and name = ?", [table])) != null;
}

export interface RebuildTransactionsInput {
  // The CHECK as the table has it now, and as it must be after. `marker` is a text only the new form contains, so a
  // table that is already rebuilt is left alone.
  oldCheck: RegExp;
  newCheck: string;
  marker: string;
  label: string; // for error messages, e.g. 'v12'
}

export async function rebuildTransactions(db: Db, input: RebuildTransactionsInput): Promise<void> {
  const { oldCheck, newCheck, marker, label } = input;
  const table = await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where type = 'table' and name = 'transactions'");
  if (!table) throw new Error(`${label} migration: the transactions table is missing.`);
  if (table.sql.includes(marker)) return; // already done
  if (!oldCheck.test(table.sql)) throw new Error(`${label} migration: transactions.source CHECK is not in the expected form.`);
  const nextSql = table.sql.replace(oldCheck, newCheck);

  const dependents = await db.getAllAsync<Dependent>(
    `select type, name, sql from sqlite_master
      where sql is not null and (type in ('view', 'trigger') or (type = 'index' and tbl_name = 'transactions'))
      order by rowid`,
  );
  const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(transactions)')).map(c => quote(c.name)).join(', ');
  const children: string[] = [];
  for (const name of CASCADE_CHILDREN) if (await tableExists(db, name)) children.push(name);

  const txBefore = await count(db, 'transactions');
  const childBefore = new Map<string, number>();
  for (const name of children) childBefore.set(name, await count(db, name));

  await db.execAsync('create temp table mig_transactions as select * from transactions');
  for (const name of children) await db.execAsync(`create temp table mig_${name} as select * from ${quote(name)}`);

  for (const d of dependents) {
    if (d.type === 'trigger') await db.execAsync(`drop trigger ${quote(d.name)}`);
    if (d.type === 'view') await db.execAsync(`drop view ${quote(d.name)}`);
  }

  // The children go first so that dropping the parent cannot cascade into anything.
  for (const name of children) await db.execAsync(`delete from ${quote(name)}`);
  await db.execAsync('drop table transactions');
  await db.execAsync(nextSql);
  await db.execAsync(`insert into transactions (${columns}) select ${columns} from mig_transactions`);
  for (const name of children) await db.execAsync(`insert into ${quote(name)} select * from mig_${name}`);

  for (const d of dependents) await db.execAsync(d.sql);

  await db.execAsync('drop table mig_transactions');
  for (const name of children) await db.execAsync(`drop table mig_${name}`);

  if ((await count(db, 'transactions')) !== txBefore) throw new Error(`${label} migration: the number of transactions changed.`);
  for (const name of children) {
    if ((await count(db, name)) !== childBefore.get(name)) throw new Error(`${label} migration: the number of rows in ${name} changed.`);
  }
  const violations = await db.getAllAsync('pragma foreign_key_check');
  if (violations.length > 0) throw new Error(`${label} migration: foreign key violations after the rebuild.`);
}
