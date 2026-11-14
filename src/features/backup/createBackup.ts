// "Buat cadangan" (create a backup), the ONE path every button for it goes through: the strip on
// More and the Backup screen. It exports the data (src/data/backup/export.ts) and puts the file where
// the person wants it, then records it in backup_log. Two destinations: a FOLDER the person picks
// (Android's folder picker: Download, a card, any folder; the default) or the system SHARE sheet (Drive,
// Gmail, Quick Share...). Only the share sheet ever needed the cache file. The device is touched through `io`, so the same function runs under
// Jest with a fake.
//
// A folder save is certain: the file is logged only after it has been written there, and closing the
// picker without a choice logs nothing. What the share sheet cannot say is whether the person picked a
// place or just closed it; that backup is logged once the sheet has been shown and closed.
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
  // Opens the folder picker and writes the file into the folder chosen. Resolves with the file's size, or
  // with null when the picker was closed without a choice. Rejects when the file could not be written.
  saveToFolder(fileName: string, json: string): Promise<{ sizeBytes: number } | null>;
}

export type BackupDestination = 'folder' | 'share';

export type CreateBackupResult =
  | { ok: true; fileName: string; sizeBytes: number; txCount: number; createdAt: string; destination: BackupDestination }
  | { ok: false; reason: 'failed' }
  | { ok: false; reason: 'cancelled' }; // the folder picker was closed without a choice: not a failure, nothing was written

// mono-backup-2026-10-28.json (DESIGN.md: the backup file name).
export function backupFileName(isoNow: string): string {
  return `mono-backup-${isoNow.slice(0, 10)}.json`;
}

export async function createBackup(
  db: Db,
  io: BackupIo,
  sha256Hex: Sha256Hex,
  now: string = nowIso(),
  destination: BackupDestination = 'share',
): Promise<CreateBackupResult> {
  try {
    const file = await exportBackup(db, now, sha256Hex);
    const fileName = backupFileName(now);
    const json = JSON.stringify(file);
    let sizeBytes: number;
    if (destination === 'folder') {
      const saved = await io.saveToFolder(fileName, json);
      if (!saved) return { ok: false, reason: 'cancelled' };
      sizeBytes = saved.sizeBytes;
    } else {
      const written = await io.write(fileName, json);
      await io.share(written.uri);
      sizeBytes = written.sizeBytes;
    }
    const txCount = file.counts.transactions;
    await insertBackupLog(db, { createdAt: now, fileName, sizeBytes, txCount, kind: 'manual' });
    return { ok: true, fileName, sizeBytes, txCount, createdAt: now, destination };
  } catch (err) {
    // Never shown to the person (the snackbar says it plainly), but a developer should be able to see why.
    if (__DEV__) console.warn('createBackup failed', err);
    return { ok: false, reason: 'failed' };
  }
}
