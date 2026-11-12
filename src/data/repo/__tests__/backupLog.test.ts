import { openTestDb } from '../../db/openTestDb';
import { countTransactionsChangedSince, getLastBackupAt, insertBackupLog } from '../backupLog';

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

describe('insertBackupLog', () => {
  test('writes one row that getLastBackupAt then reports', async () => {
    const db = openTestDb();
    const id = await insertBackupLog(db, { createdAt: '2026-10-28T12:41:09+07:00', fileName: 'mono-backup-2026-10-28.json', sizeBytes: 2048, txCount: 11, kind: 'manual' });
    expect(id).toBeGreaterThan(0);
    expect(await db.getFirstAsync('select created_at, file_name, size_bytes, tx_count, kind from backup_log')).toEqual({
      created_at: '2026-10-28T12:41:09+07:00',
      file_name: 'mono-backup-2026-10-28.json',
      size_bytes: 2048,
      tx_count: 11,
      kind: 'manual',
    });
    expect(await getLastBackupAt(db)).toBe('2026-10-28T12:41:09+07:00');
  });

  test('the schema still refuses a kind it does not know', async () => {
    await expect(insertBackupLog(openTestDb(), { createdAt: '2026-10-28T12:41:09+07:00', fileName: 'x.json', sizeBytes: 1, txCount: 0, kind: 'weird' as never })).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('countTransactionsChangedSince', () => {
  async function withTransactions() {
    const db = openTestDb();
    await db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('BCA', 'bank', 1000000, '2026-01-01', '2026-01-01T00:00:00+07:00')");
    const add = (createdAt: string, updatedAt: string, day = '2026-10-01') =>
      db.runAsync(
        "insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('expense', 1, 'IDR', 1, 1000, 1000, ?, 'x', 'manual', ?, ?)",
        [day, createdAt, updatedAt],
      );
    await add('2026-10-10T09:00:00+07:00', '2026-10-10T09:00:00+07:00'); // before the backup, untouched
    await add('2026-10-20T09:00:00+07:00', '2026-10-25T09:00:00+07:00'); // before the backup, edited after it
    await add('2026-10-26T09:00:00+07:00', '2026-10-26T09:00:00+07:00'); // new since the backup
    await add('2026-10-27T09:00:00+07:00', '2026-10-27T10:00:00+07:00'); // new and edited since
    return db;
  }

  test('transactions created or edited after the backup, each counted once', async () => {
    const db = await withTransactions();
    expect(await countTransactionsChangedSince(db, '2026-10-21T00:00:00+07:00')).toBe(3);
  });

  test('nothing changed after a recent backup', async () => {
    const db = await withTransactions();
    expect(await countTransactionsChangedSince(db, '2026-10-28T00:00:00+07:00')).toBe(0);
  });

  test('a record made in the same second as the backup is not "since": the comparison is strict', async () => {
    const db = await withTransactions();
    expect(await countTransactionsChangedSince(db, '2026-10-26T09:00:00+07:00')).toBe(1); // only the one edited at 10.00 on the 27th
  });

  test('instants are compared as instants, whatever their offset', async () => {
    const db = await withTransactions();
    // 2026-10-26T02:00:00Z is 09:00 WIB: the same moment as the third record's creation
    expect(await countTransactionsChangedSince(db, '2026-10-26T02:00:00Z')).toBe(1);
    expect(await countTransactionsChangedSince(db, '2026-10-26T01:59:59Z')).toBe(2);
  });

  test('an empty database counts zero', async () => {
    expect(await countTransactionsChangedSince(openTestDb(), '2026-10-01T00:00:00+07:00')).toBe(0);
  });
});
