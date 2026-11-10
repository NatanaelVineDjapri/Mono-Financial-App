import { addMonths } from '../../core/date';
import { openTestDb } from '../../data/db/openTestDb';
import { listCategories } from '../../data/repo/categories';
import { createAccount } from '../accounts';
import { accountShares, getOverviewData } from '../overview';
import { addExpense, addIncome } from '../transactions';

const NOW = '2026-10-28T10:00:00+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-04-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, occurredOn: '2026-09-25' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 1000000, occurredOn: '2026-09-10' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-10-25' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 1080000, occurredOn: '2026-10-20' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Food & drink'), amount: 500000, occurredOn: '2026-10-21' }, NOW);
  return db;
}

describe('getOverviewData', () => {
  test('month flow, change vs last month in basis points, six-month series oldest first', async () => {
    const db = await fixture();
    const data = await getOverviewData(db, '2026-10-28');
    expect(data.period).toBe('2026-10');
    expect(data.previousPeriod).toBe('2026-09');
    expect(data.month).toEqual({ income: 7500000, expense: 1580000, net: 5920000 });
    expect(data.previous).toEqual({ income: 7000000, expense: 1000000, net: 6000000 });
    expect(data.expenseChangeBp).toBe(5800); // +58,00%
    expect(data.incomeChangeBp).toBe(714); // +7,14%
    expect(data.cashFlow.map(m => m.period)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(data.cashFlow[0]).toMatchObject({ income: 0, expense: 0, net: 0 }); // a month with no records is zero, not missing
    expect(data.cashFlow[5]).toMatchObject({ income: 7500000, expense: 1580000 });
  });

  test('top categories: largest first, shares sum to 100,00%', async () => {
    const db = await fixture();
    const { topCategories } = await getOverviewData(db, '2026-10-28');
    expect(topCategories.total).toBe(1580000);
    expect(topCategories.categories.map(c => c.label)).toEqual(['Bills', 'Food & drink']);
    expect(topCategories.categories.reduce((s, c) => s + c.shareBp, 0)).toBe(10000);
  });

  test('top category shares use one decimal and add up to exactly 100,0%', async () => {
    const db = await fixture();
    const { topShares } = await getOverviewData(db, '2026-10-28');
    expect(topShares.map(s => s.sharePermille)).toEqual([684, 316]); // 1.080.000 and 500.000 of 1.580.000
    expect(topShares.reduce((s, r) => s + r.sharePermille, 0)).toBe(1000);
  });

  test('a previous month with no spending has no percentage (undefined, not infinite)', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 100, openingDate: '2026-10-01' }, NOW);
    const data = await getOverviewData(db, '2026-10-28');
    expect(data.expenseChangeBp).toBe(0); // 0 vs 0
  });

  test('net worth change vs the end of last month; null when the history does not reach this month', async () => {
    const db = await fixture();
    // The view's own "this month" is the real clock; a fixed Oct 2026 "today" never matches it.
    expect((await getOverviewData(db, '2026-10-28')).netWorthChange).toBeNull();

    const real = new Date().toISOString().slice(0, 10);
    const live = openTestDb();
    const opened = addMonths(`${real.slice(0, 7)}-01`, -2);
    const acc = await createAccount(live, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: opened }, NOW);
    const cats = await listCategories(live);
    await addIncome(live, { accountId: acc, currency: 'IDR', categoryId: cats.find(c => c.name === 'Salary')!.id, amount: 500000, occurredOn: `${real.slice(0, 7)}-01` }, real);
    const data = await getOverviewData(live, real);
    expect(data.netWorth).toBe(1500000);
    expect(data.netWorthChange).toBe(500000);
    expect(data.netWorthChangeBp).toBe(5000);
    expect(data.netWorthVsDate).toBe(new Date(Date.UTC(+real.slice(0, 4), +real.slice(5, 7) - 1, 0)).toISOString().slice(0, 10));
  });
});

describe('accountShares', () => {
  test('the IDR sample: one row per account, largest first, shares add up to 100,00%', () => {
    const rows = accountShares([
      { id: 1, name: 'BCA Tabungan', balance: 6842500 },
      { id: 2, name: 'Cash wallet', balance: 450000 },
      { id: 3, name: 'GoPay', balance: 312500 },
      { id: 4, name: 'Jago Pocket', balance: 1275000 },
    ]);
    expect(rows.map(r => r.label)).toEqual(['BCA Tabungan', 'Jago Pocket', 'Cash wallet', 'GoPay']);
    expect(rows.map(r => r.amount)).toEqual([6842500, 1275000, 450000, 312500]);
    expect(rows.map(r => r.shareBp)).toEqual([7705, 1436, 507, 352]);
    expect(rows.reduce((s, r) => s + r.shareBp, 0)).toBe(10000);
  });

  test('many accounts are never folded together', () => {
    const rows = accountShares(Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `A${i + 1}`, balance: (i + 1) * 100 })));
    expect(rows).toHaveLength(7);
    expect(rows.map(r => r.label)).toEqual(['A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1']);
    expect(rows.reduce((s, r) => s + r.shareBp, 0)).toBe(10000);
  });

  test('an empty account is listed at 0,00%; a negative one is left out', () => {
    const rows = accountShares([
      { id: 1, name: 'A', balance: 500 },
      { id: 2, name: 'B', balance: 0 },
      { id: 3, name: 'C', balance: -50 },
    ]);
    expect(rows.map(r => [r.label, r.shareBp])).toEqual([['A', 10000], ['B', 0]]);
  });

  test('no money held: no rows', () => {
    expect(accountShares([{ id: 1, name: 'A', balance: 0 }])).toEqual([]);
    expect(accountShares([])).toEqual([]);
  });
});
