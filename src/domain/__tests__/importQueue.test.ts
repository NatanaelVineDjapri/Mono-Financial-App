// The review queue: a notification of an allowed app becomes at most one row with only the parsed fields; a row
// becomes a transaction only through saveQueueItem (the same checks as a manual one, source 'import').
import { setClockOverride } from '../../core/clock';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { getMerchantCategory, listPending } from '../../data/repo/importQueue';
import { activateImportApp, recordSeenApps } from '../importApps';
import { countQueue, enqueueNotification, fingerprintOf, getQueueEntry, rejectQueueItem, saveAllComplete, saveQueueItem, updateQueueEntry } from '../importQueue';

const NOW = '2026-11-03T10:00:00+07:00';
const POSTED = new Date('2026-11-03T09:30:00+07:00').getTime();

async function fixture(): Promise<{ db: Db; bca: number; valas: number }> {
  const db = await openMigratedTestDb();
  const add = async (name: string, type: string, opening: number) =>
    (await db.runAsync('insert into accounts (name, type, opening_balance, opening_date, created_at) values (?, ?, ?, ?, ?)', [name, type, opening, '2026-01-01', NOW])).lastInsertRowId;
  const bca = await add('BCA Tabungan', 'bank', 1_000_000);
  const valas = await add('Valas', 'forex', 0);
  await recordSeenApps(
    db,
    [
      { package: 'com.example.bank', appName: 'Example Bank', lastSeenAt: NOW },
      { package: 'com.example.other', appName: 'Other', lastSeenAt: NOW },
    ],
    () => 'generic',
  );
  await activateImportApp(db, 'com.example.bank', bca);
  return { db, bca, valas };
}

const payment = (overrides: Partial<{ package: string; title: string | null; text: string | null; bigText: string | null; postedAt: number }> = {}) => ({
  package: 'com.example.bank',
  title: 'Pembayaran berhasil',
  text: 'Kamu membayar Rp25.000 di Kopi Kenangan',
  bigText: null,
  postedAt: POSTED,
  ...overrides,
});

beforeEach(() => setClockOverride(NOW));
afterEach(() => setClockOverride(null));

describe('enqueueNotification', () => {
  test('a payment of an allowed app becomes one pending row with the parsed fields and a suggested category', async () => {
    const { db, bca } = await fixture();
    expect(await enqueueNotification(db, payment())).toBe('added');
    const [row] = await listPending(db);
    expect(row).toMatchObject({ package: 'com.example.bank', app_name: 'Example Bank', account_id: bca, kind: 'expense', amount_idr: 25000, merchant: 'Kopi Kenangan', category_name: 'Food & drink', guessed: 1, status: 'pending' });
    expect(row.occurred_at).toBe('2026-11-03T09:30:00+07:00');
  });

  test('the same payment twice (an updated notification) is one row', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    expect(await enqueueNotification(db, payment({ postedAt: POSTED + 30_000 }))).toBe('ignored');
    expect(await countQueue(db)).toBe(1);
  });

  test('a different amount, or the same one much later, is another row', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp30.000 di Kopi Kenangan' }));
    await enqueueNotification(db, payment({ postedAt: POSTED + 10 * 60_000 }));
    expect(await countQueue(db)).toBe(3);
  });

  test('an app that is not switched on, or unknown, is ignored', async () => {
    const { db } = await fixture();
    expect(await enqueueNotification(db, payment({ package: 'com.example.other' }))).toBe('ignored');
    expect(await enqueueNotification(db, payment({ package: 'com.never.seen' }))).toBe('ignored');
    expect(await countQueue(db)).toBe(0);
  });

  test('something that is not a transaction is dropped and leaves nothing', async () => {
    const { db } = await fixture();
    expect(await enqueueNotification(db, payment({ title: 'Kode OTP', text: 'Kode OTP kamu 123456. Jangan berikan ke siapa pun.' }))).toBe('ignored');
    expect(await countQueue(db)).toBe(0);
  });

  test('an unclear kind is stored as null ("Perlu dicek") with no category', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ title: 'Top up berhasil', text: 'Top up Rp100.000 berhasil' }));
    const [row] = await listPending(db);
    expect(row).toMatchObject({ kind: null, amount_idr: 100000, category_id: null });
  });

  test('the longer of text and bigText is read', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ text: 'Pembayaran berhasil', bigText: 'Kamu membayar Rp18.500 di Warung Bu Tini' }));
    expect((await listPending(db))[0]).toMatchObject({ amount_idr: 18500, merchant: 'Warung Bu Tini' });
  });

  test('a time in the future is brought back to now', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ postedAt: new Date('2026-12-25T10:00:00+07:00').getTime() }));
    expect((await listPending(db))[0].occurred_at.slice(0, 10)).toBe('2026-11-03');
  });

  test('the Valas account is never a target', async () => {
    const { db, valas } = await fixture();
    // The schema refuses to switch an app on with a Valas account, so the app stays off and is ignored.
    await expect(db.runAsync('update import_app_settings set account_id = ?, enabled = 1 where package = ?', [valas, 'com.example.other'])).rejects.toBeDefined();
    expect(await enqueueNotification(db, payment({ package: 'com.example.other' }))).toBe('ignored');
  });

  test('no message text reaches any table', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp25.000 di Kopi Kenangan pada 3 Nov. Catatan RAHASIA-XYZ, saldo Rp975.000' }));
    const dump = JSON.stringify(await db.getAllAsync('select * from import_queue'));
    expect(dump).not.toContain('RAHASIA');
    expect(dump).not.toContain('Pembayaran berhasil');
  });
});

describe('fingerprintOf', () => {
  test('is plain text of the parsed fields, the same inside one time bucket', () => {
    const a = fingerprintOf('p', 'expense', 25000, 'Kopi Kenangan', POSTED);
    expect(a).toBe(fingerprintOf('p', 'expense', 25000, 'kopi  kenangan', POSTED + 1000));
    expect(a).not.toBe(fingerprintOf('p', 'income', 25000, 'Kopi Kenangan', POSTED));
  });
});

describe('saveQueueItem (Simpan)', () => {
  test('a complete row becomes one normal transaction with source import, and is marked saved', async () => {
    const { db, bca } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    const outcome = await saveQueueItem(db, row.id);
    expect(outcome.ok).toBe(true);
    const tx = await db.getFirstAsync<{ kind: string; amount: number; amount_idr: number; account_id: number; source: string; description: string; occurred_on: string }>('select * from transactions');
    expect(tx).toMatchObject({ kind: 'expense', amount: 25000, amount_idr: 25000, account_id: bca, source: 'import', description: 'Kopi Kenangan', occurred_on: '2026-11-03' });
    expect((await getQueueEntry(db, row.id))?.status).toBe('saved');
    expect(await countQueue(db)).toBe(0);
  });

  test('the sub-category chosen on the check screen is saved with it', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    const sub = (await db.runAsync("insert into subcategories (category_id, name) values (?, 'Kopi')", [row.category_id])).lastInsertRowId;
    expect((await saveQueueItem(db, row.id, { subcategoryId: sub })).ok).toBe(true);
    expect(await db.getFirstAsync('select subcategory_id from transactions')).toEqual({ subcategory_id: sub });
  });

  test('nothing is saved without Simpan: queueing writes no transaction', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))?.n).toBe(0);
  });

  test('a row with no kind, or no category, is refused and stays', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ title: 'Top up berhasil', text: 'Top up Rp100.000 berhasil' }));
    const [row] = await listPending(db);
    expect((await saveQueueItem(db, row.id)).ok).toBe(false);
    await updateQueueEntry(db, row.id, { kind: 'expense' });
    expect((await saveQueueItem(db, row.id)).ok).toBe(false);
    expect(await countQueue(db)).toBe(1);
  });

  test('more than the balance: refused with a message, and the row stays', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp5.000.000 di Toko Besar' }));
    const [row] = await listPending(db);
    const shopping = await db.getFirstAsync<{ id: number }>("select id from categories where name = 'Shopping'");
    await updateQueueEntry(db, row.id, { categoryId: shopping?.id });
    const outcome = await saveQueueItem(db, row.id);
    expect(outcome.ok).toBe(false);
    expect(await countQueue(db)).toBe(1);
  });

  test('saved twice: the second time is refused (no double transaction)', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    await saveQueueItem(db, row.id);
    expect((await saveQueueItem(db, row.id)).ok).toBe(false);
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))?.n).toBe(1);
  });

  test('"remember" keeps the category for the merchant, and the next notification arrives with it', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp40.000 di Budi Santoso' }));
    const [row] = await listPending(db);
    expect(row.category_id).toBeNull();
    const shopping = await db.getFirstAsync<{ id: number }>("select id from categories where name = 'Shopping'");
    await updateQueueEntry(db, row.id, { categoryId: shopping?.id });
    await saveQueueItem(db, row.id, { rememberMerchant: true });
    expect(await getMerchantCategory(db, 'budi santoso')).toBe(shopping?.id);
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp45.000 di Budi Santoso', postedAt: POSTED + 20 * 60_000 }));
    expect((await listPending(db))[0].category_id).toBe(shopping?.id);
  });

  test('not asked to remember: no memory is written', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    await saveQueueItem(db, row.id);
    expect(await getMerchantCategory(db, 'kopi kenangan')).toBeNull();
  });
});

describe('reject, update and save all', () => {
  test('a rejected row leaves the queue, and the same notification does not come back', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    await rejectQueueItem(db, row.id);
    expect(await countQueue(db)).toBe(0);
    expect(await enqueueNotification(db, payment())).toBe('ignored');
    expect(await countQueue(db)).toBe(0);
  });

  test('a change by the person turns "Ditebak" off', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    const [row] = await listPending(db);
    await updateQueueEntry(db, row.id, { merchant: 'Kopi Tuku' });
    expect(await getQueueEntry(db, row.id)).toMatchObject({ merchant: 'Kopi Tuku', guessed: 0 });
  });

  test('"Simpan yang lengkap" saves the complete ones and leaves the rest', async () => {
    const { db } = await fixture();
    await enqueueNotification(db, payment());
    await enqueueNotification(db, payment({ text: 'Kamu membayar Rp30.000 di Gojek', postedAt: POSTED + 10 * 60_000 }));
    await enqueueNotification(db, payment({ title: 'Top up berhasil', text: 'Top up Rp100.000 berhasil', postedAt: POSTED + 20 * 60_000 }));
    expect(await saveAllComplete(db)).toEqual({ saved: 2, failed: 0 });
    expect(await countQueue(db)).toBe(1);
  });
});
