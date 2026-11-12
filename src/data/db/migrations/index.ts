import type { Db } from '../types';

import { addScanSource } from './v2_scan_source';

export type Migration = (db: Db) => Promise<void>;

// Keyed by the schema_version a migration moves FROM: migrations[1] runs on a database
// still at version 1 and takes it to version 2, and so on. Schema v1
// (CLAUDE.md: src/data/db/mono_schema_v1.sql) is the baseline; a database created from it is
// brought up to date by these, on creation as well as on every later open (open.ts).
//   1 -> 2: transactions.source also accepts 'scan' (receipt scan).
export const migrations: Record<number, Migration> = {
  1: addScanSource,
};

// Brings `db` from its current meta.schema_version up to the newest version this build
// knows about, one migration per exclusive transaction, oldest first. A safety backup
// before each step is src/data/backup's job once it exists (not yet — step 5).
// Returns the resulting schema_version.
export async function runMigrations(db: Db, currentVersion: number): Promise<number> {
  let version = currentVersion;
  while (migrations[version]) {
    const migrate = migrations[version];
    const nextVersion = version + 1;
    await db.withExclusiveTransactionAsync(async txn => {
      await migrate(txn);
      await txn.runAsync("update meta set value = ? where key = 'schema_version'", [String(nextVersion)]);
    });
    version = nextVersion;
  }
  return version;
}
