import { openTestDb } from '../../db/openTestDb';
import { getAllSettings, getSetting, setSetting } from '../settings';

describe('settings repo', () => {
  test('reads a seeded setting', async () => {
    const db = openTestDb();
    expect(await getSetting(db, 'month_start_day')).toBe('1');
  });

  test('an unknown key returns null', async () => {
    const db = openTestDb();
    expect(await getSetting(db, 'nope')).toBeNull();
  });

  test('setSetting updates an existing key and inserts a new one', async () => {
    const db = openTestDb();
    await setSetting(db, 'month_start_day', '25');
    expect(await getSetting(db, 'month_start_day')).toBe('25');

    await setSetting(db, 'fx_last_success_at', '2026-11-04T12:00:00+07:00');
    expect(await getSetting(db, 'fx_last_success_at')).toBe('2026-11-04T12:00:00+07:00');
  });

  test('getAllSettings returns a plain key/value object', async () => {
    const db = openTestDb();
    const all = await getAllSettings(db);
    expect(all.ai_enabled).toBe('0');
    expect(all.fx_auto_update).toBe('0');
  });
});
