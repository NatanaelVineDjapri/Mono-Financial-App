import { createAccount } from '../accounts';
import { addExpense, addIncome } from '../transactions';
import { listCategories } from '../../data/repo/categories';
import { setSetting } from '../../data/repo/settings';
import { openTestDb } from '../../data/db/openTestDb';
import { calendarMonthEnd } from '../../core/date';
import { getPeriodFlow, getReport, getSavingsRate, listCategorySpend, reportChangeBp } from '../reports';
import { getNetWorthHistory } from '../net-worth';

const NOW = '2026-11-03T10:00:00+07:00';

async function octoberSample() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const byName = (n: string) => categories.find(c => c.name === n)!.id;

  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Salary'), amount: 7000000, occurredOn: '2026-10-25' }, NOW);
  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Freelance'), amount: 500000, occurredOn: '2026-10-26' }, NOW);
  for (const [name, amount] of [
    ['Shopping', 812000],
    ['Bills', 1150000],
    ['Transport', 540000],
    ['Food & drink', 1425000],
    ['Leisure', 210000],
    ['Health', 120000],
  ] as const) {
    await addExpense(db, { accountId, currency: 'IDR', categoryId: byName(name), amount, occurredOn: '2026-10-20' }, NOW);
  }
  return { db, categories, byName };
}

describe('domain reports', () => {
  test('reproduces the October sample flow: income 7.500.000, expense 4.257.000, net +3.243.000', async () => {
    const { db } = await octoberSample();
    const flow = await getPeriodFlow(db, '2026-10');
    expect(flow).toMatchObject({ income: 7500000, expense: 4257000, net: 3243000 });
  });

  test('reproduces the October savings rate: 4324 bp', async () => {
    const { db } = await octoberSample();
    expect((await getSavingsRate(db, '2026-10'))?.savings_rate_bp).toBe(4324);
  });

  test('savings rate is null (not zero) when there is no income yet', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    expect(await getSavingsRate(db, '2026-10')).toBeNull();
  });

  test('category spend matches each category in the sample', async () => {
    const { db, byName } = await octoberSample();
    const spend = await listCategorySpend(db, '2026-10');
    expect(spend.find(s => s.category_id === byName('Shopping'))?.spent).toBe(812000);
    expect(spend.find(s => s.category_id === byName('Food & drink'))?.spent).toBe(1425000);
  });

  test('period bucketing follows settings.month_start_day, not just the calendar month', async () => {
    const db = openTestDb();
    await setSetting(db, 'month_start_day', '25');
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const salary = (await listCategories(db, { kind: 'income' })).find(c => c.name === 'Salary')!.id;

    // 24 Sep falls in the August period; 25 Sep starts the September period.
    await addIncome(db, { accountId, currency: 'IDR', categoryId: salary, amount: 1000, occurredOn: '2026-09-24' }, NOW);
    await addIncome(db, { accountId, currency: 'IDR', categoryId: salary, amount: 2000, occurredOn: '2026-09-25' }, NOW);

    expect((await getPeriodFlow(db, '2026-08'))?.income).toBe(1000);
    expect((await getPeriodFlow(db, '2026-09'))?.income).toBe(2000);
  });
});

const TODAY = '2026-10-28T10:00:00+07:00';

describe('getReport — the month range', () => {
  test('reproduces the October board: flow, savings rate, and shares that add to 100,00%', async () => {
    const { db, byName } = await octoberSample();
    const report = await getReport(db, { period: '2026-10', range: 'month', todayIso: TODAY });

    expect(report).toMatchObject({
      period: '2026-10',
      rangePeriods: ['2026-10'],
      rangeStart: '2026-10-01',
      rangeEnd: '2026-10-28', // the current period is still open, so it ends today
      categoryTotal: 4257000,
      currentPeriod: '2026-10',
    });
    expect(report.flow).toEqual({ income: 7500000, expense: 4257000, net: 3243000, savingsRateBp: 4324 });

    const share = (name: string) => report.categories.find(c => c.id === byName(name))!.shareBp;
    expect(share('Food & drink')).toBe(3347);
    expect(share('Bills')).toBe(2701);
    expect(share('Shopping')).toBe(1907);
    expect(share('Transport')).toBe(1268);
    expect(share('Leisure')).toBe(493);
    expect(share('Health')).toBe(282);
    // Rounded on their own, which is why the card says they may not add to exactly 100%.
    expect(report.categories.reduce((sum, row) => sum + row.shareBp, 0)).toBe(9998);
  });

  test('the six-month trend ends at the selected period, and only the open one is partial', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-10', range: 'month', todayIso: TODAY });

    expect(report.trend.map(row => row.period)).toEqual([
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    expect(report.trend.filter(row => row.partial).map(row => row.period)).toEqual(['2026-10']);
    expect(report.partialTrendPeriod).toBe('2026-10');
    expect(report.trend.find(row => row.period === '2026-10')).toMatchObject({
      income: 7500000,
      expense: 4257000,
      net: 3243000,
    });
    expect(report.trend.find(row => row.period === '2026-09')).toMatchObject({ income: 0, expense: 0, net: 0, partial: false });
  });

  test('a finished period has no partial row and a closed range end', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-09', range: 'month', todayIso: TODAY });

    expect(report.rangeEnd).toBe('2026-09-30');
    expect(report.partialTrendPeriod).toBeNull();
    expect(report.trend.every(row => !row.partial)).toBe(true);
  });
});

describe('getReport — wider ranges', () => {
  test('3 months folds three period flows into one and starts on the first period', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-10', range: '3m', todayIso: TODAY });

    expect(report.rangePeriods).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(report.rangeStart).toBe('2026-08-01');
    expect(report.rangeEnd).toBe('2026-10-28');
    // Only October has records in the sample, so the three-month sum equals October.
    expect(report.flow).toMatchObject({ income: 7500000, expense: 4257000, net: 3243000 });
    // The trend stays six months regardless of the range.
    expect(report.trend).toHaveLength(6);
  });

  test('the range end of a past period is that period’s own last day', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-03', range: '3m', todayIso: TODAY });
    expect(report.rangePeriods).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(report.rangeEnd).toBe('2026-03-31');
  });

  test('a range longer than the history still lists every period, with zeroes where nothing was recorded', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-10', range: 'year', todayIso: TODAY });
    expect(report.rangePeriods).toHaveLength(12);
    expect(report.rangePeriods[11]).toBe('2026-10');
    expect(report.flow.income).toBe(7500000);
  });

  test('settings.month_start_day moves the range’s dates without moving the selected period', async () => {
    const { db } = await octoberSample();
    await setSetting(db, 'month_start_day', '25');
    const report = await getReport(db, { period: '2026-10', range: 'month', todayIso: TODAY });

    expect(report.period).toBe('2026-10');
    expect(report.rangeStart).toBe('2026-10-25');
    expect(report.rangeEnd).toBe('2026-10-28');
  });
});

describe('getReport — net worth table', () => {
  test('ends at the selected month and carries the exact month-over-month change', async () => {
    const { db } = await octoberSample();
    const history = await getNetWorthHistory(db);
    expect(history.length).toBeGreaterThan(0);
    const anchor = history[history.length - 1].month;

    const report = await getReport(db, { period: anchor, range: 'month', todayIso: `${anchor}-15T10:00:00+07:00` });

    expect(report.netWorthRows.map(row => row.month)).toEqual(history.slice(-6).map(row => row.month));
    expect(report.netWorthRows[0].change).toBeNull();
    for (let i = 1; i < report.netWorthRows.length; i++) {
      expect(report.netWorthRows[i].change).toBe(report.netWorthRows[i].netWorth - report.netWorthRows[i - 1].netWorth);
    }
    // Opening 1.200.000 + income 7.500.000 − expenses 4.257.000.
    expect(report.netWorth).toBe(4443000);
    expect(report.balanceMonthEnd).toBe(calendarMonthEnd(anchor));
  });

  test('balanceMonthEnd is the calendar last day of the selected month', async () => {
    const { db } = await octoberSample();
    const report = await getReport(db, { period: '2026-02', range: 'month', todayIso: TODAY });
    expect(report.balanceMonthEnd).toBe('2026-02-28');
  });
});

describe('getReport — the empty state threshold', () => {
  test('less than 28 days of records is not enough; the 28th day is', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 0, openingDate: '2026-10-20' }, NOW);

    const at27 = await getReport(db, { period: '2026-11', range: 'month', todayIso: '2026-11-16T10:00:00+07:00' });
    expect(at27.hasData).toBe(false);

    const at28 = await getReport(db, { period: '2026-11', range: 'month', todayIso: '2026-11-17T10:00:00+07:00' });
    expect(at28.hasData).toBe(true);
  });

  test('a database with no accounts and no transactions has no report yet', async () => {
    const report = await getReport(openTestDb(), { period: '2026-10', range: 'month', todayIso: TODAY });
    expect(report.hasData).toBe(false);
    expect(report.flow).toEqual({ income: 0, expense: 0, net: 0, savingsRateBp: null });
    expect(report.categories).toEqual([]);
  });
});

describe('reportChangeBp', () => {
  test('is the signed basis-point change, half away from zero', () => {
    expect(reportChangeBp(8_880_000, 8_000_000)).toBe(1100);
    expect(reportChangeBp(8_000_000, 8_880_000)).toBe(-991);
    expect(reportChangeBp(0, 0)).toBe(0);
    expect(reportChangeBp(500, 0)).toBeNull();
  });

  test('a negative month end uses its magnitude as the base', () => {
    expect(reportChangeBp(-1_000_000, -2_000_000)).toBe(5000);
  });
});
