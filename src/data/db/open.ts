// expo-sqlite-backed implementation of the Db interface — the real app's database
// connection. Creates the database from the bundled schema asset on first run, then
// runs any pending migrations. Call once (e.g. app/_layout.tsx) and share the result;
// do not open a second connection.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';
import type { Db, RunResult } from './types';

const DB_NAME = 'mono-finance.db';

function wrap(native: SQLite.SQLiteDatabase): Db {
  return {
    execAsync: sql => native.execAsync(sql),
    runAsync: async (sql, params = []) => {
      const result = await native.runAsync(sql, params);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes } satisfies RunResult;
    },
    getAllAsync: (sql, params = []) => native.getAllAsync(sql, params),
    getFirstAsync: async (sql, params = []) => (await native.getFirstAsync(sql, params)) ?? null,
    withExclusiveTransactionAsync: fn =>
      native.withExclusiveTransactionAsync(txn => fn(wrap(txn))),
  };
}

async function loadSchemaSql(): Promise<string> {
  // Requires `sql` in Metro's resolver.assetExts (metro.config.js) so this resolves to
  // an asset module instead of Metro trying to parse it as source.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require, not a dynamic module load
  const asset = Asset.fromModule(require('./mono_schema_v1.sql'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('mono_schema_v1.sql asset has no localUri after downloadAsync().');
  }
  return new File(asset.localUri).text();
}

// A genuinely fresh database (a brand-new .db file, or :memory:) has no tables at all —
// not even `meta` — so querying it to check the schema version must fail rather than
// return no rows. Checking sqlite_master first (instead of querying `meta` directly and
// treating "no rows" as "not yet created") is what actually distinguishes "doesn't exist
// yet" from "exists at version N". Pulled out from openDb() so the decision itself (not
// the native asset-loading/expo-sqlite specifics around it) can run against any Db,
// including a bare better-sqlite3 connection in a Jest test — see
// __tests__/open.test.ts, which is exactly how this bug (never caught by openTestDb(),
// which always execs the schema unconditionally and so never exercises this branch at
// all) was found: it only ever surfaced against a real, brand-new expo-sqlite file.
export async function initializeSchema(db: Db, loadSchemaSql: () => Promise<string>): Promise<void> {
  const metaTable = await db.getFirstAsync<{ name: string }>(
    "select name from sqlite_master where type = 'table' and name = 'meta'",
  );

  if (!metaTable) {
    await db.execAsync(await loadSchemaSql());
    return;
  }

  const versionRow = await db.getFirstAsync<{ value: string }>("select value from meta where key = 'schema_version'");
  await runMigrations(db, Number(versionRow!.value));
}

// Opens the app database: creates it from the bundled schema on first run (which seeds
// meta.schema_version = '1'), otherwise runs migrations up to the newest version.
export async function openDb(): Promise<Db> {
  const native = await SQLite.openDatabaseAsync(DB_NAME);
  await native.execAsync('PRAGMA foreign_keys = ON;');
  const db = wrap(native);
  await initializeSchema(db, loadSchemaSql);
  return db;
}
