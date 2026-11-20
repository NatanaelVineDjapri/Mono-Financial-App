// Migration 10 -> 11: the review queue of the automatic import from notifications (docs/IMPORT_PLAN.md).
//
//   import_queue          what the general parser read from an allowed app's notification, waiting for the
//                         person's review. ONLY parsed fields: the notification's title and text are never stored
//                         (CLAUDE.md rule 17). `kind` NULL is "Perlu dicek" (income or expense not clear), and
//                         `category_id` NULL is "Pilih kategori". `fingerprint` is unique, so the same notification
//                         read twice is one row, and a rejected one never comes back.
//   import_merchant_memory the category the person last chose for a merchant ("Ingat kategori untuk ...").
//   transactions.source   also accepts 'import', a transaction saved from the review queue.
//
// Both tables point at rows that a restore replaces (accounts, categories), so they are device-specific like
// import_app_settings: not in a backup, emptied before a restore and before "Erase all data".
//
// Changing a CHECK means rebuilding `transactions`, exactly as migration 1 -> 2 did (see v2_scan_source.ts for the
// reasoning). The children that cascade from transactions are parked first and put back after: recurring_events and
// transaction_locations. Every view, trigger and index is dropped and recreated from its own stored SQL. Row counts
// are compared and a foreign key violation throws, which rolls the whole migration back.
import type { Db } from '../types';

// The source CHECK as an older database has it: with 'scan' (migration 1 -> 2 ran) or, for a database that skipped that
// step, without it. Either way the rebuilt table gets the full list.
const OLD_CHECK = /CHECK \(source IN \('manual','ai','recurring'(?:,'scan')?\)\)/;
const NEW_CHECK = "CHECK (source IN ('manual','ai','recurring','scan','import'))";

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

async function allowImportSource(db: Db): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where type = 'table' and name = 'transactions'");
  if (!table) throw new Error('v11 migration: the transactions table is missing.');
  if (table.sql.includes("'import'")) return; // already done
  if (!OLD_CHECK.test(table.sql)) throw new Error('v11 migration: transactions.source CHECK is not in the expected form.');
  const nextSql = table.sql.replace(OLD_CHECK, NEW_CHECK);

  const dependents = await db.getAllAsync<Dependent>(
    `select type, name, sql from sqlite_master
      where sql is not null and (type in ('view', 'trigger') or (type = 'index' and tbl_name = 'transactions'))
      order by rowid`,
  );
  const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(transactions)')).map(c => quote(c.name)).join(', ');
  const children = [];
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

  if ((await count(db, 'transactions')) !== txBefore) throw new Error('v11 migration: the number of transactions changed.');
  for (const name of children) {
    if ((await count(db, name)) !== childBefore.get(name)) throw new Error(`v11 migration: the number of rows in ${name} changed.`);
  }
  const violations = await db.getAllAsync('pragma foreign_key_check');
  if (violations.length > 0) throw new Error('v11 migration: foreign key violations after the rebuild.');
}

export async function addImportQueue(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE import_queue (
  id           INTEGER PRIMARY KEY,
  package      TEXT    NOT NULL,
  app_name     TEXT    NOT NULL,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  kind         TEXT    CHECK (kind IS NULL OR kind IN ('income','expense')),
  amount_idr   INTEGER NOT NULL CHECK (amount_idr > 0),
  merchant     TEXT    NOT NULL DEFAULT '' CHECK (length(merchant) <= 80),
  category_id  INTEGER REFERENCES categories(id),
  guessed      INTEGER NOT NULL DEFAULT 1 CHECK (guessed IN (0,1)),
  occurred_at  TEXT    NOT NULL,
  fingerprint  TEXT    NOT NULL UNIQUE,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rejected','saved')),
  created_at   TEXT    NOT NULL
);
CREATE INDEX idx_import_queue_status ON import_queue (status, occurred_at);

CREATE TABLE import_merchant_memory (
  merchant_key TEXT    PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  updated_at   TEXT    NOT NULL
);
`);
  await allowImportSource(db);
}
