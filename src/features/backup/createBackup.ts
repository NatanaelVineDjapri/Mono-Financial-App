// "Buat cadangan" (create a backup), the ONE path every button for it goes through: the strip on
// More and, when it is built, the Backup screen. It exports the data (src/data/backup/export.ts),
// writes the file, opens the system share sheet so the person can put it somewhere safe, and only
// then records it in backup_log. The device is touched through `io`, so the same function runs under
// Jest with a fake.
//
// What it cannot know: Android's share sheet does not say whether the person picked a place or just
// closed it. The backup is logged once the sheet has been shown and closed. (Saving straight into a
// folder the person picks would remove that doubt; that is a decision for the Backup screen.)
import { nowIso } from '../../core/clock';
import type { Db } from '../../data/db/types';
import { exportBackup, type Sha256Hex } from '../../data/backup/export';
import { insertBackupLog } from '../../data/repo/backupLog';

export interface BackupIo {
  // Writes the file (replacing an earlier one of the same name, and clearing old backup files out of
  // the cache) and says where it is and how big.
  write(fileName: string, json: string): Promise<{ uri: string; sizeBytes: number }>;
  // Shows the share sheet. Resolves when it closes; rejects when sharing is not possible.
  share(uri: string): Promise<void>;
}

export type CreateBackupResult = { ok: true; fileName: string; sizeBytes: number; txCount: number; createdAt: string } | { ok: false; reason: 'failed' };

// mono-backup-2026-10-28.json (DESIGN.md: the backup file name).
export function backupFileName(isoNow: string): string {
  return `mono-backup-${isoNow.slice(0, 10)}.json`;
}

export async function createBackup(db: Db, io: BackupIo, sha256Hex: Sha256Hex, now: string = nowIso()): Promise<CreateBackupResult> {
  try {
    const file = await exportBackup(db, now, sha256Hex);
    const fileName = backupFileName(now);
    const { uri, sizeBytes } = await io.write(fileName, JSON.stringify(file));
    await io.share(uri);
    const txCount = file.counts.transactions;
    await insertBackupLog(db, { createdAt: now, fileName, sizeBytes, txCount, kind: 'manual' });
    return { ok: true, fileName, sizeBytes, txCount, createdAt: now };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
