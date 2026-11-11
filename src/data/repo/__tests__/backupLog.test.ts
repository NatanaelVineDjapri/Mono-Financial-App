import { openTestDb } from '../../db/openTestDb';
import { getLastBackupAt } from '../backupLog';

async function log(db: ReturnType<typeof openTestDb>, createdAt: string, kind: 'manual' | 'safety' = 'manual') {
  await db.runAsync('insert into backup_log (created_at, file_name, size_bytes, tx_count, kind) values ($at, $name, 100, 5, $kind)', {
    $at: createdAt,
    $name: `mono-${createdAt}.json`,
    $kind: kind,
  });
}

describe('getLastBackupAt', () => {
  test('null when there never was a backup', async () => {
    expect(await getLastBackupAt(openTestDb())).toBeNull();
  });

  test('the newest one, whatever the order they were written in', async () => {
    const db = openTestDb();
    await log(db, '2026-10-21T20:14:00+07:00');
    await log(db, '2026-09-01T09:00:00+07:00');
    await log(db, '2026-10-05T09:00:00+07:00');
    expect(await getLastBackupAt(db)).toBe('2026-10-21T20:14:00+07:00');
  });

  test('a safety copy made before a restore counts too: it is a real file on the device', async () => {
    const db = openTestDb();
    await log(db, '2026-10-01T09:00:00+07:00');
    await log(db, '2026-10-20T09:00:00+07:00', 'safety');
    expect(await getLastBackupAt(db)).toBe('2026-10-20T09:00:00+07:00');
  });
});
