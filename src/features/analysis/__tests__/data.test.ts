import { openTestDb } from '@/data/db/openTestDb';
import { createBudget, setMonthlyLimit } from '@/data/repo/budgets';
import { listCategories } from '@/data/repo/categories';
import { setSetting } from '@/data/repo/settings';
import { createAccount } from '@/domain/accounts';
import { createRecurring } from '@/domain/recurring';
import { addExpense, addIncome, addTransfer } from '@/domain/transactions';

import { getAnalysis } from '../data';

const NOW = '2026-10-28T10:00:00+07:00';
const TODAY = '2026-10-28';

// The October 2026 sample (income 7.500.000, expenses 4.257.000, 5 of 6 budgets in limit, all accounts
// 8.880.000, fixed expenses 1.201.990 a month, net worth up in each of the last 5 months) on top of a few
// earlier months so the net worth rises step by step: 2,2 / 3,2 / 4,2 / 5,0 / 5,637 / 8,88 million.
async function sample() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1_200_000, openingDate: '2026-05-01' }, NOW);
  const otherId = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: 0, openingDate: '2026-05-01' }, NOW);
  const categories = await listCategories(db);
  const byName = (n: string) => categories.find(c => c.name === n)!.id;
  const income = (amount: number, occurredOn: string) => addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Salary'), amount, occurredOn }, NOW);
  const expense = (name: string, amount: number, occurredOn: string) => addExpense(db, { accountId, currency: 'IDR', categoryId: byName(name), amount, occurredOn }, NOW);

  // May to September: each month ends higher than the one before
  for (const [month, inc, exp] of [['05', 1_500_000, 500_000], ['06', 1_500_000, 500_000], ['07', 1_500_000, 500_000], ['08', 1_300_000, 500_000], ['09', 1_400_000, 763_000]] as const) {
    await income(inc, `2026-${month}-05`);
    await expense('Food & drink', exp, `2026-${month}-10`);
  }
  // October
  await income(7_000_000, '2026-10-25');
  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Freelance'), amount: 500_000, occurredOn: '2026-10-26' }, NOW);
  for (const [name, amount] of [['Shopping', 812_000], ['Bills', 1_150_000], ['Transport', 540_000], ['Food & drink', 1_425_000], ['Leisure', 210_000], ['Health', 120_000]] as const) {
    await expense(name, amount, '2026-10-20');
  }

  await setMonthlyLimit(db, '2026-10', 5_000_000);
  for (const [name, limit] of [['Shopping', 700_000], ['Bills', 1_200_000], ['Transport', 600_000], ['Food & drink', 1_800_000], ['Leisure', 400_000], ['Health', 300_000]] as const) {
    await createBudget(db, { categoryId: byName(name), month: '2026-10', limitAmount: limit });
  }
  for (const [name, amount, day] of [['Gym', 200_000, 28], ['Internet', 385_000, 5], ['Music subscription', 54_990, 12], ['Electricity token', 562_000, 24]] as const) {
    await createRecurring(db, { name, amount, accountId, categoryId: byName('Bills'), dayOfMonth: day, firstDueOn: '2026-10-01' }, NOW);
  }
  return { db, accountId, otherId, byName };
}

describe('getAnalysis: the October 2026 sample', () => {
  test('builds the input from the views and scores 83, Sehat', async () => {
    const { db } = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    const { input, result } = data.analysis;
    expect(input).toMatchObject({
      income: 7_500_000, expense: 4_257_000, balance: 8_880_000, fixedMonthly: 1_201_990,
      transactionCount: 18, accountCount: 2, daysLeft: 3, dayOfPeriod: 28,
    });
    expect(input.budgets).toHaveLength(6);
    expect(input.netWorthSeries).toEqual([2_200_000, 3_200_000, 4_200_000, 5_000_000, 5_637_000, 8_880_000]);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.components.map(c => `${c.id}:${c.points}/${c.max}`)).toEqual(['savings:25/25', 'budget:21/25', 'emergency:7/20', 'fixed:15/15', 'wealth:15/15']);
    expect(result.score).toBe(83);
    expect(result.band).toBe('healthy');
    expect(data.analysis.overBudgets).toBe(1);
    expect(data.analysis.insights?.improvements.map(i => i.kind)).toEqual(['budget_over', 'emergency']);
  });

  test('period facts: running, range up to today, the first period with a record', async () => {
    const { db } = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect(data).toMatchObject({ period: '2026-10', currentPeriod: '2026-10', running: true, rangeStart: '2026-10-01', rangeEnd: TODAY, earliestPeriod: '2026-05' });
  });

  test('a period in the future is clamped to the running one', async () => {
    const { db } = await sample();
    expect((await getAnalysis(db, '2027-03', TODAY)).period).toBe('2026-10');
  });

  test('the change from the previous period appears only when that period could be scored', async () => {
    const { db } = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect(data.previousPeriod).toBe('2026-09');
    expect(data.previousScore).not.toBeNull();
    const first = await getAnalysis(db, '2026-05', TODAY);
    expect(first.previousScore).toBeNull();
  });

  test('the trend is six periods ending at the selected one, the running one marked partial', async () => {
    const { db } = await sample();
    const { trend } = await getAnalysis(db, '2026-10', TODAY);
    expect(trend.map(t => t.period)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(trend[5]).toMatchObject({ score: 83, band: 'healthy', partial: true });
    expect(trend.slice(0, 5).every(t => !t.partial)).toBe(true);
    // May has 10 records at most and under a month of data: not scored yet
    expect(trend[0].score).toBeNull();
  });

  test('a past period is scored with the data up to its own end and has no days left', async () => {
    const { db } = await sample();
    const sep = await getAnalysis(db, '2026-09', TODAY);
    expect(sep.running).toBe(false);
    expect(sep.rangeEnd).toBe('2026-09-30');
    expect(sep.analysis.input.daysLeft).toBeNull();
    expect(sep.analysis.input.balance).toBe(5_637_000);
    expect(sep.analysis.input.income).toBe(1_400_000);
    expect(sep.analysis.insights?.watch ?? null).toBeNull();
  });

  test('transfers between your own accounts change nothing', async () => {
    const { db, accountId, otherId } = await sample();
    const before = (await getAnalysis(db, '2026-10', TODAY)).analysis.input;
    await addTransfer(db, { accountId, currency: 'IDR', toAccountId: otherId, amount: 1_000_000, occurredOn: '2026-10-27' }, NOW);
    const after = (await getAnalysis(db, '2026-10', TODAY)).analysis.input;
    expect(after.income).toBe(before.income);
    expect(after.expense).toBe(before.expense);
    expect(after.balance).toBe(before.balance);
    expect(after.transactionCount).toBe(before.transactionCount + 1);
  });

  test('nothing is written: no table gained a row', async () => {
    const { db } = await sample();
    const count = async () => (await db.getFirstAsync<{ n: number }>('select (select count(*) from transactions) + (select count(*) from budgets) + (select count(*) from recurring) + (select count(*) from meta) + (select count(*) from settings) as n'))!.n;
    const before = await count();
    await getAnalysis(db, '2026-10', TODAY);
    expect(await count()).toBe(before);
  });
});

describe('getAnalysis: not enough data', () => {
  test('an empty app cannot be scored and says what is missing', async () => {
    const db = openTestDb();
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect(data.analysis.result.eligible).toBe(false);
    expect(data.analysis.insights).toBeNull();
    expect(data.earliestPeriod).toBeNull();
    if (!data.analysis.result.eligible) {
      expect(data.analysis.result.checks.filter(c => !c.met).map(c => c.id)).toEqual(['accounts', 'transactions', 'span']);
    }
  });

  test('6 records and 9 days: the checks show what is there', async () => {
    const db = openTestDb();
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 100_000, openingDate: '2026-10-01' }, NOW);
    const categories = await listCategories(db);
    for (let day = 1; day <= 6; day++) {
      await addExpense(db, { accountId, currency: 'IDR', categoryId: categories.find(c => c.name === 'Food & drink')!.id, amount: 1_000, occurredOn: `2026-10-0${day + 3}` }, NOW);
    }
    const data = await getAnalysis(db, '2026-10', '2026-10-09');
    const r = data.analysis.result;
    expect(r.eligible).toBe(false);
    if (!r.eligible) {
      expect(r.checks).toEqual([
        { id: 'accounts', met: true, have: 1, need: 1 },
        { id: 'transactions', met: false, have: 6, need: 10 },
        { id: 'span', met: false, have: 6, need: 28 },
      ]);
    }
  });
});

describe('month start day', () => {
  test('periods follow the setting', async () => {
    const { db } = await sample();
    await setSetting(db, 'month_start_day', '25');
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect(data.rangeStart).toBe('2026-10-25');
    expect(data.currentPeriod).toBe('2026-10');
  });
});
