import { openTestDb } from '../../openTestDb';
import { runMigrations } from '../index';
import { BACKUP_TABLES } from '../../../backup/export';

describe('migration 9 -> 10 notifications', () => {
  test('creates notifications table and new settings keys', async () => {
    const db = openTestDb();
    await runMigrations(db, 9);

    expect(await db.getFirstAsync("SELECT value FROM meta WHERE key = 'schema_version'")).toEqual({ value: '10' });
    expect(await db.getFirstAsync('SELECT count(*) AS n FROM notifications')).toEqual({ n: 0 });

    const keys = ['notif_enabled','quiet_start','quiet_end','notif_daily','notif_daily_time',
      'notif_bill_h1','notif_bill_overdue','notif_budget_near','notif_budget_over','notif_goal','notif_backup'];
    for (const key of keys) {
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
      expect(row).not.toBeNull();
    }
  });

  test('maps backup_reminder -> notif_backup and removes old key', async () => {
    const db = openTestDb();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_reminder', '0')");
    await runMigrations(db, 9);

    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'notif_backup'")).toEqual({ value: '0' });
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'backup_reminder'")).toBeNull();
  });

  test('maps recurring_reminders -> notif_bill_h1 + notif_bill_overdue and removes old key', async () => {
    const db = openTestDb();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('recurring_reminders', '1')");
    await runMigrations(db, 9);

    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'notif_bill_h1'")).toEqual({ value: '1' });
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'notif_bill_overdue'")).toEqual({ value: '1' });
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'recurring_reminders'")).toBeNull();
  });

  test('notifications table is NOT in BACKUP_TABLES', () => {
    expect((BACKUP_TABLES as readonly string[]).includes('notifications')).toBe(false);
  });

  test('notifications table integrity view passes', async () => {
    const db = openTestDb();
    await runMigrations(db, 9);
    // Insert a valid row
    await db.runAsync(
      "INSERT INTO notifications (kind, dedupe_key, payload, created_at) VALUES ('daily', 'daily:2026-01-01', '{}', '2026-01-01T00:00:00+07:00')"
    );
    expect(await db.getFirstAsync('SELECT count(*) AS n FROM notifications')).toEqual({ n: 1 });
    // Duplicate dedupe_key is rejected
    await expect(
      db.runAsync("INSERT INTO notifications (kind, dedupe_key, payload, created_at) VALUES ('daily', 'daily:2026-01-01', '{}', '2026-01-01T00:00:00+07:00')")
    ).rejects.toThrow();
  });
});
