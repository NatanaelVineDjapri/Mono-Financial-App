// The Summary page's numbers, on the October sample data.
import * as fs from 'fs';
import * as path from 'path';

import { openMigratedTestDb } from '../../data/db/openTestDb';
import { getSavingsStatus, getSavingsTarget, setSavingsTarget } from '../savings';
import { calendarMonths, getSummary, getSummaryHistory, heatLevel, heatWeeks } from '../summary';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../tools/sample_data.sql'), 'utf8');
const TODAY = '2026-10-28';

async function sampleDb() {
  const db = await openMigratedTestDb();
  await db.execAsync(SAMPLE_SQL);
  return db;
}

describe('getSummary', () => {
  test('October: income, expenses, no corrections, net; the running net ends at the net', async () => {
    const data = await getSummary(await sampleDb(), 'month', TODAY);
    expect(data).toMatchObject({ start: '2026-10-01', end: TODAY, income: 7500000, expense: 4257000, correction: 0, net: 3243000, isEmpty: false });
    expect(data.running).toHaveLength(28);
    expect(data.running[27]).toEqual({ date: TODAY, net: 3243000 });
    expect(data.categories[0]).toMatchObject({ name: 'Food & drink', amount: 1425000, subs: [] });
    expect(data.categories.reduce((sum, c) => sum + c.shareBp, 0)).toBe(10000);
    expect(Object.values(data.spendByDay).reduce((sum, v) => sum + v, 0)).toBe(4257000);
  });

  test('a category branches into its sub-categories, the rest of it listed last', async () => {
    const db = await sampleDb();
    await db.runAsync("insert into subcategories (category_id, name) values (1, 'Alone')");
    const one = await db.getFirstAsync<{ id: number; amount_idr: number }>('select id, amount_idr from transactions where category_id = 1 limit 1');
    await db.runAsync('update transactions set subcategory_id = (select id from subcategories) where id = $id', { $id: one!.id });
    const food = (await getSummary(db, 'month', TODAY)).categories.find(c => c.id === 1)!;
    expect(food.subs[0]).toMatchObject({ name: 'Alone', amount: one!.amount_idr });
    expect(food.subs.reduce((sum, s) => sum + s.amount, 0)).toBe(food.amount);
    if (food.subs.length > 1) expect(food.subs[food.subs.length - 1].id).toBeNull();
  });

  test('a balance correction stays out of income and expenses, and still moves the net', async () => {
    const db = await sampleDb();
    await db.runAsync(
      `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at)
       select 'expense', 1, 'IDR', id, 50000, 50000, '2026-10-27', 'x', 'manual', 'now', 'now' from categories where name = 'Penyesuaian saldo' and kind = 'expense'`,
    );
    const data = await getSummary(db, 'month', TODAY);
    expect(data).toMatchObject({ income: 7500000, expense: 4257000, correction: -50000, net: 3193000 });
    expect(data.categories.map(c => c.name)).not.toContain('Penyesuaian saldo');
  });
});

describe('getSummaryHistory', () => {
  test('six periods, oldest first, the running one marked', async () => {
    const rows = await getSummaryHistory(await sampleDb(), 6, TODAY, null);
    expect(rows.map(r => r.period)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(rows[5]).toMatchObject({ income: 7500000, expense: 4257000, net: 3243000, partial: true });
  });

  test('one account only', async () => {
    const db = await sampleDb();
    const all = (await getSummaryHistory(db, 3, TODAY, null))[2];
    const accounts = await db.getAllAsync<{ id: number }>('select id from accounts');
    let expense = 0;
    for (const a of accounts) expense += (await getSummaryHistory(db, 3, TODAY, a.id))[2].expense;
    expect(expense).toBe(all.expense);
  });
});

describe('the spending calendar', () => {
  test('levels are quarters of the biggest day', () => {
    expect([0, 1, 25, 26, 75, 100].map(v => heatLevel(v, 100))).toEqual([0, 1, 1, 2, 3, 4]);
  });

  test('weeks start on Monday: 1 Oct 2026 is a Thursday', () => {
    const weeks = heatWeeks('2026-10', { spendByDay: {}, start: '2026-10-01', end: TODAY });
    expect(weeks[0].map(c => c?.date.slice(8) ?? null)).toEqual([null, null, null, '01', '02', '03', '04']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.flat().find(c => c?.date === '2026-10-30')!.inRange).toBe(false);
  });

  test('the months of a range', () => {
    expect(calendarMonths('2026-11-01', '2027-01-15')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('the savings budget', () => {
  test('no target at first; saved is income minus expenses', async () => {
    const status = await getSavingsStatus(await sampleDb(), '2026-10');
    expect(status).toMatchObject({ target: null, saved: 3243000, remaining: 0, progressBp: 0 });
  });

  test('a target gives what is left and how far along; null removes it', async () => {
    const db = await sampleDb();
    await setSavingsTarget(db, 5000000);
    expect(await getSavingsStatus(db, '2026-10')).toMatchObject({ target: 5000000, remaining: 1757000, progressBp: 6486 });
    await setSavingsTarget(db, null);
    expect(await getSavingsTarget(db)).toBeNull();
  });

  test('nonsense is refused', async () => {
    const db = await sampleDb();
    await expect(setSavingsTarget(db, 0)).rejects.toThrow();
    await expect(setSavingsTarget(db, 1.5)).rejects.toThrow();
  });
});
