// The device-local log of backup files (never part of a backup, never touched by a restore).
import type { Db } from '../db/types';

export type BackupKind = 'manual' | 'safety';

// When the newest backup was made (an ISO instant), or null if there never was one.
export async function getLastBackupAt(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ created_at: string }>('select created_at from backup_log order by created_at desc, id desc limit 1');
  return row?.created_at ?? null;
}

// One more file in the log: when it was made, its name, its size and how many transactions it holds.
export async function insertBackupLog(db: Db, entry: { createdAt: string; fileName: string; sizeBytes: number; txCount: number; kind: BackupKind }): Promise<number> {
  const result = await db.runAsync('insert into backup_log (created_at, file_name, size_bytes, tx_count, kind) values ($createdAt, $fileName, $sizeBytes, $txCount, $kind)', {
    $createdAt: entry.createdAt,
    $fileName: entry.fileName,
    $sizeBytes: entry.sizeBytes,
    $txCount: entry.txCount,
    $kind: entry.kind,
  });
  return result.lastInsertRowId;
}

// How many transactions were created or changed after `sinceIso` (the newest backup's time): the
// records a restore of that backup would not have. Read from `transactions` every time, never
// stored. A transaction deleted since then leaves no trace to count. Instants are compared as
// instants (julianday), not as text, so two offsets cannot disagree.
export async function countTransactionsChangedSince(db: Db, sinceIso: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'select count(*) as n from transactions where julianday(created_at) > julianday($since) or julianday(updated_at) > julianday($since)',
    { $since: sinceIso },
  );
  return row?.n ?? 0;
}
