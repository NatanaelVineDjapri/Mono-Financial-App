// Device-local notifications inbox — not backed up (like backup_log).
import type { Db } from '../db/types';
import type { InboxItem, NotifKind, NotifPayload, NotifRow } from '../../domain/notify/types';

const RETENTION_DAYS = 90;
const MAX_ROWS = 200;

/** Insert new inbox items (INSERT OR IGNORE on dedupe_key). Returns count inserted. */
export async function insertInboxItems(db: Db, items: InboxItem[]): Promise<number> {
  let count = 0;
  for (const item of items) {
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO notifications (kind, dedupe_key, ref_type, ref_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        item.kind,
        item.dedupe_key,
        item.ref_type ?? null,
        item.ref_id ?? null,
        JSON.stringify(item.payload),
        item.created_at,
      ],
    );
    if (result.changes > 0) count++;
  }
  return count;
}

/** Mark one notification as read. */
export async function markRead(db: Db, id: number, now: string): Promise<void> {
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE id = ?', [now, id]);
}

/** Mark all notifications as read. */
export async function markAllRead(db: Db, now: string): Promise<void> {
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE read_at IS NULL', [now]);
}

/** Count unread notifications. */
export async function countUnread(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM notifications WHERE read_at IS NULL');
  return row?.n ?? 0;
}

/** List all notifications newest first. */
export async function listNotifications(db: Db): Promise<NotifRow[]> {
  return db.getAllAsync<NotifRow>('SELECT * FROM notifications ORDER BY created_at DESC, id DESC');
}

/** Get the full set of dedupe_keys currently in the inbox. */
export async function getDedupeKeys(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ dedupe_key: string }>('SELECT dedupe_key FROM notifications');
  return new Set(rows.map(r => r.dedupe_key));
}

/**
 * Prune old notifications: delete those older than RETENTION_DAYS and keep at most MAX_ROWS.
 * Called on app open.
 */
export async function pruneNotifications(db: Db, now: string): Promise<void> {
  // Delete older than 90 days
  const cutoff = new Date(new Date(now).getTime() - RETENTION_DAYS * 86400000).toISOString();
  await db.runAsync('DELETE FROM notifications WHERE created_at < ?', [cutoff]);
  // Keep only newest MAX_ROWS
  await db.runAsync(
    `DELETE FROM notifications WHERE id NOT IN (
      SELECT id FROM notifications ORDER BY created_at DESC, id DESC LIMIT ?
    )`,
    [MAX_ROWS],
  );
}
