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

// Opens the app database: creates it from the bundled schema on first run (which seeds
// meta.schema_version = '1'), otherwise runs migrations up to the newest version.
export async function openDb(): Promise<Db> {
  const native = await SQLite.openDatabaseAsync(DB_NAME);
  await native.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await native.getFirstAsync<{ value: string }>(
    "select value from meta where key = 'schema_version'",
  );
  const db = wrap(native);

  if (!versionRow) {
    const schemaSql = await loadSchemaSql();
    await native.execAsync(schemaSql);
  } else {
    await runMigrations(db, Number(versionRow.value));
  }

  return db;
}
