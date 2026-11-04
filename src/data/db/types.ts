// A thin, promise-based database interface so the same domain/repo code runs against
// expo-sqlite (open.ts, the real app) and better-sqlite3 (openTestDb.ts, Jest — jest-expo
// cannot run expo-sqlite's native binding, and all domain tests must use the real schema).

export type Params = Record<string, string | number | null | boolean> | (string | number | null | boolean)[];

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Db {
  // Runs a script of one or more statements (schema, migrations). No return value, no params.
  execAsync(sql: string): Promise<void>;
  // Runs one INSERT/UPDATE/DELETE statement with bound params.
  runAsync(sql: string, params?: Params): Promise<RunResult>;
  // Runs one SELECT, returning every row.
  getAllAsync<T = unknown>(sql: string, params?: Params): Promise<T[]>;
  // Runs one SELECT, returning the first row or null.
  getFirstAsync<T = unknown>(sql: string, params?: Params): Promise<T | null>;
  // One exclusive transaction: commits if `fn` resolves, rolls back if it throws.
  withExclusiveTransactionAsync(fn: (txn: Db) => Promise<void>): Promise<void>;
}
