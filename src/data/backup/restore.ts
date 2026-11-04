// DATABASE.md section 7's restore sequence: validate fully first, then one exclusive
// transaction (guards_off on, delete everything in dependency order, insert from the
// file, guards_off off, PRAGMA foreign_key_check + v_integrity_issues) — any problem
// rolls back everything. A bad file never partly restores. Does not touch backup_log
// (that is device-local and the export/share flow's job, not restore's).
import type { Db } from '../db/types';
import { exportBackup } from './export';
import type { BackupFile, BackupTable, Sha256Hex } from './export';
import { validateBackup } from './validate';
import type { ValidationFailure } from './validate';

// Children before parents, so every delete is FK-safe at the moment it runs.
const DELETE_ORDER: BackupTable[] = [
  'recurring_events',
  'transactions',
  'recurring',
  'account_currencies',
  'budgets',
  'goals',
  'fx_rates',
  'monthly_limits',
  'settings',
  'accounts',
  'categories',
];

// The exact reverse: parents before children, so every insert's foreign keys already
// exist when it runs.
const INSERT_ORDER: BackupTable[] = [...DELETE_ORDER].reverse();

export type RestoreResult =
  | { ok: true; safetyBackup: BackupFile | null }
  | { ok: false; reason: 'invalid'; detail: ValidationFailure }
  | { ok: false; reason: 'integrity_check_failed'; issues: unknown[] };

export interface RestoreOptions {
  takeSafetyBackup?: boolean;
}

export async function restoreBackup(db: Db, raw: string, now: string, sha256Hex: Sha256Hex, opts: RestoreOptions = {}): Promise<RestoreResult> {
  const validation = await validateBackup(raw, sha256Hex);
  if (!validation.ok) {
    return { ok: false, reason: 'invalid', detail: validation };
  }
  const file = validation.file;

  // The file is a snapshot, not a sequence of edits, so a safety backup of the CURRENT
  // state is taken before anything is touched — outside the destructive transaction,
  // since it is a plain read.
  const safetyBackup = opts.takeSafetyBackup ? await exportBackup(db, now, sha256Hex) : null;

  let integrityIssues: unknown[] | null = null;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      await txn.runAsync("update meta set value = '1' where key = 'guards_off'");

      for (const table of DELETE_ORDER) {
        await txn.execAsync(`delete from ${table}`);
      }

      for (const table of INSERT_ORDER) {
        for (const r of file.data[table]) {
          const columns = Object.keys(r);
          if (columns.length === 0) continue;
          const placeholders = columns.map(c => `$${c}`).join(', ');
          const params: Record<string, unknown> = {};
          for (const c of columns) params[`$${c}`] = r[c] as string | number | null | boolean;
          await txn.runAsync(`insert into ${table} (${columns.join(', ')}) values (${placeholders})`, params as never);
        }
      }

      await txn.runAsync("update meta set value = '0' where key = 'guards_off'");

      const fkViolations = await txn.getAllAsync('PRAGMA foreign_key_check');
      const auditIssues = await txn.getAllAsync('select * from v_integrity_issues');
      if (fkViolations.length > 0 || auditIssues.length > 0) {
        integrityIssues = [...fkViolations, ...auditIssues];
        throw new Error('RESTORE_INTEGRITY_CHECK_FAILED');
      }
    });
  } catch (err) {
    if (integrityIssues) {
      return { ok: false, reason: 'integrity_check_failed', issues: integrityIssues };
    }
    throw err;
  }

  return { ok: true, safetyBackup };
}
