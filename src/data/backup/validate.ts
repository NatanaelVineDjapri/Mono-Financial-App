// Full validation before anything touches the database: app marker, schema version,
// counts, checksum, and internal references (a transaction's account_id actually exists
// in the same file's accounts array, etc.) — a bad file is caught here, before restore
// ever opens a transaction.
import { BACKUP_TABLES, canonicalDataJson } from './export';
import type { BackupData, BackupFile, BackupTable, Sha256Hex } from './export';

const SUPPORTED_SCHEMA_VERSION = 2;

export type ValidationFailure =
  | { ok: false; reason: 'not_json' }
  | { ok: false; reason: 'wrong_app' }
  | { ok: false; reason: 'newer_schema_version'; fileVersion: number; supportedVersion: number }
  | { ok: false; reason: 'missing_table'; table: BackupTable }
  | { ok: false; reason: 'count_mismatch'; table: BackupTable }
  | { ok: false; reason: 'checksum_mismatch' }
  | { ok: false; reason: 'broken_reference'; table: BackupTable };

export type ValidationResult = { ok: true; file: BackupFile } | ValidationFailure;

function row<T extends Record<string, unknown>>(r: unknown): T {
  return r as T;
}

// A reference check per table, in the order each one's own parents are checked. Returns
// the first table found with a dangling reference, or null if everything resolves.
function checkInternalReferences(data: BackupData): BackupTable | null {
  const idSet = (table: BackupTable) => new Set(data[table].map(r => row<{ id: unknown }>(r).id));
  const accountIds = idSet('accounts');
  const categoryIds = idSet('categories');
  const recurringIds = idSet('recurring');
  const transactionIds = idSet('transactions');

  for (const r of data.account_currencies) {
    if (!accountIds.has(row<{ account_id: unknown }>(r).account_id)) return 'account_currencies';
  }
  for (const r of data.transactions) {
    const t = row<{ account_id: unknown; to_account_id: unknown; category_id: unknown }>(r);
    if (!accountIds.has(t.account_id)) return 'transactions';
    if (t.to_account_id !== null && !accountIds.has(t.to_account_id)) return 'transactions';
    if (t.category_id !== null && !categoryIds.has(t.category_id)) return 'transactions';
  }
  for (const r of data.budgets) {
    if (!categoryIds.has(row<{ category_id: unknown }>(r).category_id)) return 'budgets';
  }
  for (const r of data.goals) {
    const g = row<{ account_id: unknown }>(r);
    if (g.account_id !== null && !accountIds.has(g.account_id)) return 'goals';
  }
  for (const r of data.recurring) {
    const c = row<{ account_id: unknown; category_id: unknown }>(r);
    if (!accountIds.has(c.account_id)) return 'recurring';
    if (!categoryIds.has(c.category_id)) return 'recurring';
  }
  for (const r of data.recurring_events) {
    const e = row<{ recurring_id: unknown; transaction_id: unknown }>(r);
    if (!recurringIds.has(e.recurring_id)) return 'recurring_events';
    if (e.transaction_id !== null && !transactionIds.has(e.transaction_id)) return 'recurring_events';
  }
  return null;
}

export async function validateBackup(raw: string, sha256Hex: Sha256Hex): Promise<ValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not_json' };
  }

  const file = parsed as Partial<BackupFile> | null;
  if (!file || typeof file !== 'object' || file.app !== 'mono-finance') {
    return { ok: false, reason: 'wrong_app' };
  }
  if (typeof file.schema_version !== 'number' || file.schema_version > SUPPORTED_SCHEMA_VERSION) {
    return { ok: false, reason: 'newer_schema_version', fileVersion: Number(file.schema_version), supportedVersion: SUPPORTED_SCHEMA_VERSION };
  }
  if (!file.data || !file.counts) {
    return { ok: false, reason: 'missing_table', table: BACKUP_TABLES[0] };
  }

  for (const table of BACKUP_TABLES) {
    const rows = file.data[table];
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'missing_table', table };
    }
    if (rows.length !== file.counts[table]) {
      return { ok: false, reason: 'count_mismatch', table };
    }
  }

  const expectedChecksum = `sha256:${await sha256Hex(canonicalDataJson(file.data as BackupData))}`;
  if (file.checksum !== expectedChecksum) {
    return { ok: false, reason: 'checksum_mismatch' };
  }

  const brokenTable = checkInternalReferences(file.data as BackupData);
  if (brokenTable) {
    return { ok: false, reason: 'broken_reference', table: brokenTable };
  }

  return { ok: true, file: file as BackupFile };
}
