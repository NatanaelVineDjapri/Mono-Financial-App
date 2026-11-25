// The import counts what became of every notification of an allowed app (numbers only, never the text), so the person can see
// WHY an app's notifications do not turn into transactions.
import { setClockOverride } from '../../core/clock';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { clearImportStats, getImportStats, IMPORT_STATS_KEY } from '../../data/repo/importStats';
import { getSetting } from '../../data/repo/settings';
import { explainGeneric } from '../../features/import/parsers/generic';
import { activateImportApp, recordSeenApps } from '../importApps';
import { enqueueNotification } from '../importQueue';

const NOW = '2026-11-03T10:00:00+07:00';
const POSTED = new Date('2026-11-03T09:30:00+07:00').getTime();
const PKG = 'com.example.bank';

async function fixture(): Promise<Db> {
  const db = await openMigratedTestDb();
  const bca = (await db.runAsync('insert into accounts (name, type, opening_balance, opening_date, created_at) values (?, ?, ?, ?, ?)', ['BCA Tabungan', 'bank', 1_000_000, '2026-01-01', NOW])).lastInsertRowId;
  await recordSeenApps(db, [{ package: PKG, appName: 'Example Bank', lastSeenAt: NOW }], () => 'generic');
  await activateImportApp(db, PKG, bca);
  return db;
}

const note = (title: string | null, text: string | null) => ({ package: PKG, title, text, bigText: null, postedAt: POSTED });

beforeEach(() => setClockOverride(NOW));
afterEach(() => setClockOverride(null));

describe('explainGeneric says why a notification was thrown away', () => {
  test.each([
    [null, null, 'empty'],
    ['Kode OTP', 'Kode verifikasi 123456, jangan berikan ke siapa pun', 'security'],
    ['Tagihan', 'Tagihan listrik Rp385.000 jatuh tempo besok', 'reminder'],
    ['Transfer berhasil', 'Transfer ke Budi berhasil', 'no_amount'],
    ['Info', 'Kamu punya Rp5.000 poin bonus di akunmu', 'no_money_word'],
  ])('%s / %s → %s', (title, text, reason) => {
    expect(explainGeneric(title, text)).toEqual({ parsed: null, dropped: reason });
  });

  test('a payment is read, with no drop reason', () => {
    const outcome = explainGeneric('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan');
    expect(outcome.parsed).toMatchObject({ kind: 'expense', amountIdr: 25000 });
    expect(outcome.dropped).toBeUndefined();
  });
});

describe('the counts', () => {
  test('every notification of an allowed app is counted once, by what became of it', async () => {
    const db = await fixture();
    await enqueueNotification(db, note('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan')); // queued
    await enqueueNotification(db, note('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan')); // the same payment again
    await enqueueNotification(db, note('Transfer berhasil', 'Transfer ke Budi berhasil')); // no amount
    await enqueueNotification(db, note('Promo', 'Dapatkan diskon untuk kamu')); // no amount
    expect((await getImportStats(db))[PKG]).toMatchObject({ read: 4, queued: 1, duplicate: 1, no_amount: 2 });
  });

  test('only numbers are kept: nothing of the text is in what is stored', async () => {
    const db = await fixture();
    await enqueueNotification(db, note('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan'));
    const stored = (await getSetting(db, IMPORT_STATS_KEY)) ?? '';
    expect(stored).not.toMatch(/Kopi|membayar|Pembayaran/i);
    expect(JSON.parse(stored)[PKG]).toMatchObject({ read: 1, queued: 1 });
  });

  test('an app that is not switched on is not counted: it never reached this far', async () => {
    const db = await fixture();
    await enqueueNotification(db, { ...note('x', 'Kamu membayar Rp25.000 di Kopi'), package: 'com.example.other' });
    expect(await getImportStats(db)).toEqual({});
  });

  test('they can be cleared, and a damaged value reads as empty instead of failing', async () => {
    const db = await fixture();
    await enqueueNotification(db, note('Pembayaran berhasil', 'Kamu membayar Rp25.000 di Kopi Kenangan'));
    await clearImportStats(db);
    expect(await getImportStats(db)).toEqual({});
    await db.runAsync("insert or replace into settings (key, value) values (?, ?)", [IMPORT_STATS_KEY, '{not json']);
    expect(await getImportStats(db)).toEqual({});
  });
});
