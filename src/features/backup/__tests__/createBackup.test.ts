// "Buat cadangan": the one path behind every backup button. Real database, fake device.
import { createHash } from 'crypto';

import { addExpense } from '../../../domain/transactions';
import { createAccount } from '../../../domain/accounts';
import { listCategories } from '../../../data/repo/categories';
import { countTransactionsChangedSince, getLastBackupAt } from '../../../data/repo/backupLog';
import { validateBackup } from '../../../data/backup/validate';
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import type { Db } from '../../../data/db/types';
import { backupState } from '../../more/backupStatus';
import { backupFileName, createBackup, type BackupIo } from '../createBackup';

const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');
const OPENED = '2026-10-05T09:00:00+07:00';
const NOW = '2026-10-28T12:41:09+07:00';

async function fixture(): Promise<{ db: Db; account: number; category: number }> {
  const db = await openMigratedTestDb();
  const account = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, OPENED);
  const category = (await listCategories(db, { kind: 'expense' }))[0].id;
  await addExpense(db, { accountId: account, currency: 'IDR', categoryId: category, amount: 45000, occurredOn: '2026-10-02', description: 'Makan siang' }, OPENED);
  await addExpense(db, { accountId: account, currency: 'IDR', categoryId: category, amount: 25000, occurredOn: '2026-10-03', description: 'Kopi' }, OPENED);
  return { db, account, category };
}

function fakeIo(over: Partial<BackupIo> = {}): BackupIo & { written: { fileName: string; json: string }[]; shared: string[] } {
  const written: { fileName: string; json: string }[] = [];
  const shared: string[] = [];
  return {
    written,
    shared,
    write: async (fileName, json) => {
      written.push({ fileName, json });
      return { uri: `file:///cache/${fileName}`, sizeBytes: json.length };
    },
    share: async uri => {
      shared.push(uri);
    },
    ...over,
  };
}

describe('createBackup', () => {
  test('exports, writes the file, shows the share sheet, then logs it', async () => {
    const { db } = await fixture();
    const io = fakeIo();
    const result = await createBackup(db, io, sha256Hex, NOW);

    expect(result).toMatchObject({ ok: true, fileName: 'mono-backup-2026-10-28.json', txCount: 2, createdAt: NOW });
    expect(io.written.map(w => w.fileName)).toEqual(['mono-backup-2026-10-28.json']);
    expect(io.shared).toEqual(['file:///cache/mono-backup-2026-10-28.json']);
    expect(await db.getFirstAsync('select created_at, file_name, tx_count, kind from backup_log')).toEqual({
      created_at: NOW,
      file_name: 'mono-backup-2026-10-28.json',
      tx_count: 2,
      kind: 'manual',
    });
    expect(await db.getFirstAsync<{ size_bytes: number }>('select size_bytes from backup_log')).toEqual({ size_bytes: io.written[0].json.length });
  });

  test('the file it writes is a real backup: it passes the same validation a restore uses', async () => {
    const { db } = await fixture();
    const io = fakeIo();
    await createBackup(db, io, sha256Hex, NOW);
    const validation = await validateBackup(io.written[0].json, sha256Hex);
    expect(validation.ok).toBe(true);
    expect(validation.ok && validation.file.counts.transactions).toBe(2);
  });

  test('the file name follows the date: mono-backup-YYYY-MM-DD.json', () => {
    expect(backupFileName('2026-10-28T12:41:09+07:00')).toBe('mono-backup-2026-10-28.json');
    expect(backupFileName('2026-01-05T00:00:00+07:00')).toBe('mono-backup-2026-01-05.json');
  });

  test('if the share sheet cannot be shown, nothing is logged: the strip would otherwise claim a backup that is not there', async () => {
    const { db } = await fixture();
    const io = fakeIo({
      share: async () => {
        throw new Error('sharing_unavailable');
      },
    });
    expect(await createBackup(db, io, sha256Hex, NOW)).toEqual({ ok: false, reason: 'failed' });
    expect(await getLastBackupAt(db)).toBeNull();
  });

  test('if the file cannot be written, nothing is shown or logged', async () => {
    const { db } = await fixture();
    const io = fakeIo({
      write: async () => {
        throw new Error('disk full');
      },
    });
    expect(await createBackup(db, io, sha256Hex, NOW)).toEqual({ ok: false, reason: 'failed' });
    expect(io.shared).toEqual([]);
    expect(await getLastBackupAt(db)).toBeNull();
  });

  test('it only reads the data: the transactions are exactly as they were', async () => {
    const { db } = await fixture();
    const before = await db.getAllAsync('select * from transactions order by id');
    await createBackup(db, fakeIo(), sha256Hex, NOW);
    expect(await db.getAllAsync('select * from transactions order by id')).toEqual(before);
  });
});

describe('the strip after a backup', () => {
  test('never backed up, then backed up (nothing changed), then a new transaction: 1 changed since', async () => {
    const { db, account, category } = await fixture();
    const nowMs = new Date('2026-10-28T13:00:00+07:00').getTime();
    const read = async () => {
      const last = await getLastBackupAt(db);
      return backupState(last, last ? await countTransactionsChangedSince(db, last) : 0, nowMs);
    };

    expect(await read()).toEqual({ kind: 'none' });

    await createBackup(db, fakeIo(), sha256Hex, NOW);
    expect(await read()).toEqual({ kind: 'recent', days: 0, changed: 0 });

    await addExpense(db, { accountId: account, currency: 'IDR', categoryId: category, amount: 10000, occurredOn: '2026-10-28', description: 'Parkir' }, '2026-10-28T12:50:00+07:00');
    expect(await read()).toEqual({ kind: 'recent', days: 0, changed: 1 });
  });

  test('a week later the same backup is stale', async () => {
    const { db } = await fixture();
    await createBackup(db, fakeIo(), sha256Hex, NOW);
    const last = (await getLastBackupAt(db)) as string;
    expect(backupState(last, 0, new Date('2026-11-04T09:00:00+07:00').getTime())).toMatchObject({ kind: 'stale', days: 7 });
    expect(backupState(last, 0, new Date('2026-11-03T09:00:00+07:00').getTime())).toMatchObject({ kind: 'recent', days: 6 });
  });
});
