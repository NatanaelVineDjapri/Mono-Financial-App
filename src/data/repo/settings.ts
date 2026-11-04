import type { Db } from '../db/types';

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('select value from settings where key = $key', { $key: key });
  return row ? row.value : null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  const existing = await db.getFirstAsync('select 1 from settings where key = $key', { $key: key });
  if (existing) {
    await db.runAsync('update settings set value = $value where key = $key', { $key: key, $value: value });
  } else {
    await db.runAsync('insert into settings (key, value) values ($key, $value)', { $key: key, $value: value });
  }
}

export async function getAllSettings(db: Db): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('select key, value from settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
