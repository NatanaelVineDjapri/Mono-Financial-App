import type { Db } from '../types';

// Migration 9 -> 10. Adds the device-local `notifications` inbox table (never backed up,
// like backup_log) and 12 new settings keys for the notification system.
// Old keys `backup_reminder` and `recurring_reminders` are mapped to the new keys and removed.
// Any previously scheduled expo-notifications are cancelled here via a flag in settings
// so the scheduler (src/features/notifications/scheduler.ts) knows to cancel on first run.
export async function addNotifications(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE notifications (
  id        INTEGER PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('daily','bill_due','bill_overdue','budget_near','budget_over','goal_milestone','backup')),
  dedupe_key TEXT NOT NULL UNIQUE,
  ref_type  TEXT,
  ref_id    INTEGER,
  payload   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at   TEXT
);

-- New settings with defaults
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('notif_enabled',   '0'),
  ('quiet_start',     '22:00'),
  ('quiet_end',       '06:00'),
  ('notif_daily',     '1'),
  ('notif_daily_time','20:00'),
  ('notif_bill_h1',   '1'),
  ('notif_bill_overdue','1'),
  ('notif_budget_near','1'),
  ('notif_budget_over','1'),
  ('notif_goal',      '1'),
  ('notif_backup',    '1'),
  ('notif_cancel_all','1');
`);

  // Migrate old keys -> new keys (preserve user's choices)
  const oldBackup = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'backup_reminder'",
  );
  if (oldBackup) {
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('notif_backup', ?)",
      [oldBackup.value === '0' ? '0' : '1'],
    );
    await db.runAsync("DELETE FROM settings WHERE key = 'backup_reminder'");
  }

  const oldRecurring = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'recurring_reminders'",
  );
  if (oldRecurring) {
    const v = oldRecurring.value === '0' ? '0' : '1';
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('notif_bill_h1', ?)",
      [v],
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('notif_bill_overdue', ?)",
      [v],
    );
    await db.runAsync("DELETE FROM settings WHERE key = 'recurring_reminders'");
  }
}
