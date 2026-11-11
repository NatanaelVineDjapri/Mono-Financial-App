// The device-local log of backup files (never part of a backup, never touched by a restore).
import type { Db } from '../db/types';

// When the newest backup was made (an ISO instant), or null if there never was one.
export async function getLastBackupAt(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ created_at: string }>('select created_at from backup_log order by created_at desc, id desc limit 1');
  return row?.created_at ?? null;
}
