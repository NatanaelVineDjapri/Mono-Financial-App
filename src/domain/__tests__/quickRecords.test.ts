import { listCategories } from '../../data/repo/categories';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import { archiveAccount, createAccount } from '../accounts';
import { getQuickRecords, QUICK_RECORD_LIMIT } from '../quickRecords';
import { addExpense, addIncome, addTransfer } from '../transactions';
import { insertTransactionLocation } from '../../data/repo/transactionLocations';

const NOW = '2026-10-28T10:00:00+07:00';

async function fixture() {
  const db = await openMigratedTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 10_000_000, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 2_000_000, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;
  return { db, bca, cash, cat };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function expense(f: Fixture, accountId: number, categoryId: number, amount: number, occurredOn: string, description = '') {
  await addExpense(f.db, { accountId, currency: 'IDR', categoryId, amount, occurredOn, description }, NOW);
}

async function seed() {
  const f = await fixture();
  const food = f.cat('Food & drink');
  const transport = f.cat('Transport');
  const salary = f.cat('Salary');
  // The category is the most common source (three records).
  await expense(f, f.bca, food, 18_000, '2026-10-01', 'Kopi');
  await expense(f, f.bca, food, 18_000, '2026-10-02', 'Kopi');
  await expense(f, f.bca, food, 20_000, '2026-10-03', 'Kopi');
  // Transport is next (twice).
  await expense(f, f.bca, transport, 5_000, '2026-10-04', 'Parkir');
  await expense(f, f.bca, transport, 5_000, '2026-10-05', 'Parkir');
  // Salary is a category too, once.
  await addIncome(f.db, { accountId: f.bca, currency: 'IDR', categoryId: salary, amount: 7_500_000, occurredOn: '2026-10-25', description: 'Gaji' }, NOW);
  return f;
}

describe('getQuickRecords', () => {
  test('orders category shortcuts by how often they are recorded, then by recency', async () => {
    const { db } = await seed();
    const rows = await getQuickRecords(db);
    expect(rows.map(r => r.label)).toEqual(['Food & drink', 'Transport', 'Salary']);
    expect(rows.map(r => r.count)).toEqual([3, 2, 1]);
    expect(rows.map(r => r.kind)).toEqual(['expense', 'expense', 'income']);
  });

  test('carries everything the form needs to be filled in, from the newest record', async () => {
    const { db, bca, cat } = await seed();
    const [food] = await getQuickRecords(db);
    expect(food).toMatchObject({
      source: 'category',
      label: 'Food & drink',
      placeName: null,
      kind: 'expense',
      accountId: bca,
      accountName: 'BCA Tabungan',
      categoryId: cat('Food & drink'),
      categoryName: 'Food & drink',
      amount: 20_000, // the amount of the latest record, not the first
      count: 3,
      lastOn: '2026-10-03',
    });
  });

  test('offers a repeated place name as an alternative to categories', async () => {
    const f = await fixture();
    const food = f.cat('Food & drink');
    const transport = f.cat('Transport');
    const shopping = f.cat('Shopping');
    for (const [date, categoryId, amount] of [['2026-10-01', food, 18_000], ['2026-10-02', transport, 19_000], ['2026-10-03', shopping, 20_000]] as const) {
      await expense(f, f.bca, categoryId, amount, date);
      const row = await f.db.getFirstAsync<{ id: number }>('select id from transactions order by id desc limit 1');
      await insertTransactionLocation(f.db, { transactionId: row!.id, latE6: -6_200_000, lngE6: 106_800_000, accuracyM: 20, placeName: 'Kantor', capturedAt: `${date}T10:00:00+07:00` });
    }
    const rows = await getQuickRecords(f.db);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'place', label: 'Kantor', placeName: 'Kantor', count: 3, amount: 20_000 }),
      expect.objectContaining({ source: 'category', label: 'Food & drink' }),
    ]));
  });

  test('does not repeat a label when a place has the same name as a category', async () => {
    const f = await fixture();
    const food = f.cat('Food & drink');
    const other = f.cat('Other');
    await expense(f, f.bca, food, 18_000, '2026-10-01');
    const first = await f.db.getFirstAsync<{ id: number }>('select id from transactions order by id desc limit 1');
    await insertTransactionLocation(f.db, { transactionId: first!.id, latE6: -6_200_000, lngE6: 106_800_000, accuracyM: 20, placeName: 'Food & drink', capturedAt: NOW });
    await expense(f, f.bca, food, 18_000, '2026-10-02');
    const second = await f.db.getFirstAsync<{ id: number }>('select id from transactions order by id desc limit 1');
    await insertTransactionLocation(f.db, { transactionId: second!.id, latE6: -6_200_000, lngE6: 106_800_000, accuracyM: 20, placeName: 'Food & drink', capturedAt: NOW });
    await expense(f, f.cash, other, 20_000, '2026-10-03');
    const rows = await getQuickRecords(f.db);
    expect(rows).toHaveLength(2);
    expect(rows.filter(row => row.label.toLowerCase() === 'food & drink')).toHaveLength(1);
  });

  test('transfers and records without a category or place are not offered', async () => {
    const f = await fixture();
    const food = f.cat('Food & drink');
    await expense(f, f.bca, food, 18_000, '2026-10-01');
    await addTransfer(f.db, { accountId: f.bca, currency: 'IDR', toAccountId: f.cash, amount: 100_000, occurredOn: '2026-10-02', description: 'Top up' }, NOW);
    expect(await getQuickRecords(f.db)).not.toEqual([]);
  });

  test('a note whose account was archived drops out', async () => {
    const f = await seed();
    await archiveAccount(f.db, f.bca);
    expect(await getQuickRecords(f.db)).toEqual([]);
  });

  test('honours a smaller limit and never returns more than five shortcuts', async () => {
    const { db } = await seed();
    expect(await getQuickRecords(db, 2)).toHaveLength(2);
    expect(await getQuickRecords(db, 99)).toHaveLength(3);
    expect(QUICK_RECORD_LIMIT).toBe(5);
  });

  test('the limit is capped at five even with more notes available', async () => {
    const f = await fixture();
    const categories = ['Food & drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Leisure', 'Housing'].map(name => f.cat(name));
    for (const [i, categoryId] of categories.entries()) {
      await expense(f, f.bca, categoryId, 10_000 + i, '2026-10-10');
    }
    expect(await getQuickRecords(f.db, 99)).toHaveLength(5);
  });
});
