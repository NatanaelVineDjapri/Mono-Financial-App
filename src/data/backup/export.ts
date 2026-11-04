// DESIGN.md section 16 / DATABASE.md section 7. Eleven tables: the earlier nine plus
// account_currencies and fx_rates. Not included: currencies (static seed), meta
// (recreated), backup_log (device-local), and the Gemini key (secure storage).
import type { Db } from '../db/types';

export const BACKUP_TABLES = [
  'accounts',
  'account_currencies',
  'categories',
  'transactions',
  'budgets',
  'monthly_limits',
  'goals',
  'recurring',
  'recurring_events',
  'fx_rates',
  'settings',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupData = Record<BackupTable, Record<string, unknown>[]>;

export interface BackupFile {
  app: 'mono-finance';
  schema_version: number;
  exported_at: string;
  currency: 'IDR';
  counts: Record<BackupTable, number>;
  data: BackupData;
  checksum: string; // "sha256:<hex>"
}

export type Sha256Hex = (text: string) => Promise<string>;

// Table order is fixed and keys are written in BACKUP_TABLES order (not insertion
// order), so two exports of the same data always hash to the same checksum.
export function canonicalDataJson(data: BackupData): string {
  const ordered: Partial<BackupData> = {};
  for (const table of BACKUP_TABLES) ordered[table] = data[table];
  return JSON.stringify(ordered);
}

export async function exportBackup(db: Db, now: string, sha256Hex: Sha256Hex): Promise<BackupFile> {
  const data = {} as BackupData;
  const counts = {} as Record<BackupTable, number>;
  for (const table of BACKUP_TABLES) {
    // `table` only ever comes from the fixed BACKUP_TABLES list above, never user
    // input — SQL identifiers can't be bound as parameters, so this is the one place
    // string interpolation into SQL is both necessary and safe.
    const rows = await db.getAllAsync<Record<string, unknown>>(`select * from ${table}`);
    data[table] = rows;
    counts[table] = rows.length;
  }

  const versionRow = await db.getFirstAsync<{ value: string }>("select value from meta where key = 'schema_version'");
  const schemaVersion = Number(versionRow?.value ?? 1);

  const checksum = `sha256:${await sha256Hex(canonicalDataJson(data))}`;

  return { app: 'mono-finance', schema_version: schemaVersion, exported_at: now, currency: 'IDR', counts, data, checksum };
}
