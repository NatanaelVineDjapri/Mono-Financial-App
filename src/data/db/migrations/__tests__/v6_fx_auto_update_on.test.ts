import { openTestDb } from '../../openTestDb';
import { runMigrations } from '../index';

// Migration 5 -> 6: a database from an older build carries the old seeded '0' for
// "Perbarui otomatis"; the upgrade turns it on once.
describe('migration 5 -> 6 (fx auto-update on from the start)', () => {
  test('turns the old seeded off into on, and bumps the version', async () => {
    const db = openTestDb();
    await db.runAsync("update settings set value = '0' where key = 'fx_auto_update'");

    await expect(runMigrations(db, 5)).resolves.toBe(6);

    expect(await db.getFirstAsync("select value from settings where key = 'fx_auto_update'")).toEqual({ value: '1' });
    expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '6' });
  });

  test('leaves other settings as they are', async () => {
    const db = openTestDb();
    await db.runAsync("update settings set value = '0' where key = 'fx_auto_update'");

    await runMigrations(db, 5);

    expect(await db.getFirstAsync("select value from settings where key = 'ai_enabled'")).toEqual({ value: '0' });
    expect(await db.getFirstAsync("select value from settings where key = 'month_start_day'")).toEqual({ value: '1' });
  });
});
