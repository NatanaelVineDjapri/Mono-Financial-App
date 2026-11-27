// Notifications from the native listener reach the queue one at a time, and one bad one never stops the next.
import { setClockOverride } from '../../../core/clock';
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { countPending } from '../../../data/repo/importQueue';
import { getImportStats } from '../../../data/repo/importStats';
import { activateImportApp, recordSeenApps } from '../../../domain/importApps';
import { createIngestor, prune } from '../ingest';

const NOW = '2026-11-03T10:00:00+07:00';
const POSTED = new Date('2026-11-03T09:30:00+07:00').getTime();

beforeEach(() => setClockOverride(NOW));
afterEach(() => setClockOverride(null));

async function fixture() {
  const db = await openMigratedTestDb();
  const bca = (await db.runAsync('insert into accounts (name, type, opening_balance, opening_date, created_at) values (?, ?, ?, ?, ?)', ['BCA', 'bank', 0, '2026-01-01', NOW])).lastInsertRowId;
  await recordSeenApps(db, [{ package: 'com.example.bank', appName: 'Example Bank', lastSeenAt: NOW }], () => 'generic');
  await activateImportApp(db, 'com.example.bank', bca);
  return db;
}

const raw = (text: string, postedAt = POSTED) => ({ package: 'com.example.bank', title: 'Pembayaran', text, bigText: null, postedAt });

test('every pushed notification is handled in order, and the screens are told when one was added', async () => {
  const db = await fixture();
  const onAdded = jest.fn();
  const ingestor = createIngestor(db, onAdded);
  void ingestor.push(raw('Kamu membayar Rp10.000 di Warung A'));
  void ingestor.push(raw('Kamu membayar Rp20.000 di Warung B', POSTED + 600_000));
  void ingestor.push(raw('Hanya promo, tanpa nominal'));
  await ingestor.idle();
  expect(await countPending(db)).toBe(2);
  expect(onAdded).toHaveBeenCalledTimes(2);
});

test('a failure while handling one notification is swallowed and the next one still goes through', async () => {
  const db = await fixture();
  const onAdded = jest.fn().mockImplementationOnce(() => {
    throw new Error('boom');
  });
  const ingestor = createIngestor(db, onAdded);
  await ingestor.push(raw('Kamu membayar Rp10.000 di Warung A'));
  await ingestor.push(raw('Kamu membayar Rp20.000 di Warung B', POSTED + 600_000));
  expect(await countPending(db)).toBe(2);
  expect(onAdded).toHaveBeenCalledTimes(2);
});

test('prune never throws', async () => {
  const db = await fixture();
  await expect(prune(db)).resolves.toBeUndefined();
});

test('read again from the shade: a new payment is queued and counted, a repeat or a drop is not counted twice', async () => {
  const db = await fixture();
  const ingestor = createIngestor(db, () => undefined);
  const stats = async () => (await getImportStats(db))['com.example.bank'];

  await ingestor.push(raw('Kamu membayar Rp10.000 di Warung A'), { seenAgain: true });
  expect(await countPending(db)).toBe(1);
  expect(await stats()).toMatchObject({ read: 1, queued: 1 });

  await ingestor.push(raw('Kamu membayar Rp10.000 di Warung A'), { seenAgain: true });
  await ingestor.push(raw('Hanya promo, tanpa nominal'), { seenAgain: true });
  expect(await countPending(db)).toBe(1);
  expect(await stats()).toMatchObject({ read: 1, queued: 1, duplicate: 0, no_amount: 0 });
});
