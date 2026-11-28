// Full validation before anything touches the database: app marker, schema version,
// counts, checksum, and internal references (a transaction's account_id actually exists
// in the same file's accounts array, etc.) — a bad file is caught here, before restore
// ever opens a transaction.
import { LATEST_SCHEMA_VERSION } from '../db/migrations';
import { BACKUP_TABLES } from './export';
import type { BackupData, BackupFile, BackupTable, Sha256Hex } from './export';

const SUPPORTED_SCHEMA_VERSION = LATEST_SCHEMA_VERSION;

// The schema version in which a backup table first appeared (the others have been there from the start).
const TABLE_SINCE: Partial<Record<BackupTable, number>> = { transaction_locations: 9, card_links: 12, subcategories: 13, debts: 14 };

// Every checksum a file of `version` may legitimately carry: the tables as written by the app of that time, i.e. leaving
// out any subset of the tables that did not exist yet.
async function checksumCandidates(data: BackupData, version: number, sha256Hex: Sha256Hex): Promise<string[]> {
  const late = (Object.entries(TABLE_SINCE) as [BackupTable, number][]).filter(([, since]) => version < since).map(([table]) => table);
  const out: string[] = [];
  for (let mask = 0; mask < 1 << late.length; mask++) {
    const left = new Set(late.filter((_, i) => (mask >> i) & 1));
    const ordered = Object.fromEntries(BACKUP_TABLES.filter(t => !left.has(t)).map(t => [t, data[t]]));
    out.push(`sha256:${await sha256Hex(JSON.stringify(ordered))}`);
  }
  return out;
}

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
  const subcategoryIds = idSet('subcategories');

  for (const r of data.account_currencies) {
    if (!accountIds.has(row<{ account_id: unknown }>(r).account_id)) return 'account_currencies';
  }
  for (const r of data.transactions) {
    const t = row<{ account_id: unknown; to_account_id: unknown; category_id: unknown; subcategory_id?: unknown }>(r);
    if (!accountIds.has(t.account_id)) return 'transactions';
    if (t.to_account_id !== null && !accountIds.has(t.to_account_id)) return 'transactions';
    if (t.category_id !== null && !categoryIds.has(t.category_id)) return 'transactions';
    // A file from before sub-categories has no such column; a transaction without one has null.
    if (t.subcategory_id != null && !subcategoryIds.has(t.subcategory_id)) return 'transactions';
  }
  for (const r of data.subcategories) {
    if (!categoryIds.has(row<{ category_id: unknown }>(r).category_id)) return 'subcategories';
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
  for (const r of data.transaction_locations) {
    if (!transactionIds.has(row<{ transaction_id: unknown }>(r).transaction_id)) return 'transaction_locations';
  }
  for (const r of data.debts) {
    if (!accountIds.has(row<{ account_id: unknown }>(r).account_id)) return 'debts';
  }
  for (const r of data.card_links) {
    if (!accountIds.has(row<{ account_id: unknown }>(r).account_id)) return 'card_links';
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

  // A file written before a table existed does not have it: add it empty, in memory only (the file on disk is never
  // changed), so it restores as a valid snapshot.
  for (const [table, since] of Object.entries(TABLE_SINCE) as [BackupTable, number][]) {
    if (file.schema_version < since && !(file.data as Partial<BackupData>)[table]) {
      (file.data as BackupData)[table] = [];
      (file.counts as BackupFile['counts'])[table] = 0;
    }
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

  // The checksum was made over the tables that existed when the file was written, so a file from before a table
  // existed is checked with and without it.
  const accepted = await checksumCandidates(file.data as BackupData, file.schema_version, sha256Hex);
  if (!accepted.includes(file.checksum as string)) {
    return { ok: false, reason: 'checksum_mismatch' };
  }

  const brokenTable = checkInternalReferences(file.data as BackupData);
  if (brokenTable) {
    return { ok: false, reason: 'broken_reference', table: brokenTable };
  }

  return { ok: true, file: file as BackupFile };
}
