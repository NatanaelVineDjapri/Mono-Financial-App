import { buildFlowRanges, type DailyFlow, type PeriodFlowSum } from '../cashFlowRanges';

// "Today" is Wed 28 Oct 2026, the period is October (start day 1).
const TODAY = '2026-10-28';

const DAILY: DailyFlow[] = [
  // the previous period, September: 1 to 28 holds 3.000.000 in and 1.000.000 out; the 29th and 30th are left out of the comparison
  { date: '2026-09-05', income: 3_000_000, expense: 0 },
  { date: '2026-09-20', income: 0, expense: 1_000_000 },
  { date: '2026-09-29', income: 500_000, expense: 0 },
  // the week before (Oct 15-21) and this week (Oct 22-28)
  { date: '2026-10-16', income: 0, expense: 200_000 },
  { date: '2026-10-22', income: 0, expense: 300_000 },
  { date: '2026-10-25', income: 7_000_000, expense: 0 },
  { date: '2026-10-26', income: 500_000, expense: 0 },
  { date: '2026-10-28', income: 0, expense: 100_000 },
  // earlier this month
  { date: '2026-10-03', income: 0, expense: 1_000_000 },
];

const PERIODS: PeriodFlowSum[] = [
  { period: '2026-09', income: 3_500_000, expense: 1_000_000 },
  { period: '2026-10', income: 7_500_000, expense: 1_600_000 },
];

const r = buildFlowRanges({ today: TODAY, startDay: 1, period: '2026-10', daily: DAILY, periods: PERIODS });

describe('week: the last 7 days', () => {
  test('Oct 22-28, with a point for every day and a running total', () => {
    expect(r.week.start).toBe('2026-10-22');
    expect(r.week.end).toBe(TODAY);
    expect(r.week.points.map(p => p.key)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    expect(r.week.points.map(p => p.cumulative)).toEqual([-300_000, -300_000, -300_000, 6_700_000, 7_200_000, 7_200_000, 7_100_000]);
    expect(r.week).toMatchObject({ income: 7_500_000, expense: 400_000, net: 7_100_000 });
  });

  test('against the 7 days before (Oct 15-21)', () => {
    expect(r.week).toMatchObject({ previousIncome: 0, previousExpense: 200_000, previousNet: -200_000 });
    expect(r.week.netChangeBp).toBe(365000); // from -200.000 to +7.100.000, against |previous|: +3.650,00%
  });
});

describe('month: the running period so far', () => {
  test('Oct 1-28 with its running total', () => {
    expect(r.month.start).toBe('2026-10-01');
    expect(r.month.end).toBe(TODAY);
    expect(r.month.points).toHaveLength(28);
    expect(r.month.points[0]).toMatchObject({ key: '2026-10-01', net: 0, cumulative: 0 });
    expect(r.month.points[2]).toMatchObject({ key: '2026-10-03', net: -1_000_000, cumulative: -1_000_000 });
    expect(r.month.points[27]).toMatchObject({ key: TODAY, cumulative: 5_900_000 });
    expect(r.month).toMatchObject({ income: 7_500_000, expense: 1_600_000, net: 5_900_000 });
  });

  test('against the same days of September (1-28), not the whole month', () => {
    expect(r.month).toMatchObject({ previousIncome: 3_000_000, previousExpense: 1_000_000, previousNet: 2_000_000 });
    expect(r.month.netChangeBp).toBe(19500); // 5.900.000 vs 2.000.000: +195,00%
  });

  test('a total that never moves has no change to show when the previous one was zero', () => {
    const empty = buildFlowRanges({ today: TODAY, startDay: 1, period: '2026-10', daily: [{ date: '2026-10-05', income: 100, expense: 0 }], periods: [] });
    expect(empty.month.previousNet).toBe(0);
    expect(empty.month.netChangeBp).toBeNull();
  });
});

describe('year: the last 12 periods', () => {
  test('one point per period with a running total, ending with the running period', () => {
    expect(r.year.points).toHaveLength(12);
    expect(r.year.points[0].key).toBe('2025-11');
    expect(r.year.points[11]).toMatchObject({ key: '2026-10', net: 5_900_000 });
    expect(r.year.points[10]).toMatchObject({ key: '2026-09', net: 2_500_000, cumulative: 2_500_000 });
    expect(r.year.points[11].cumulative).toBe(8_400_000);
    expect(r.year).toMatchObject({ income: 11_000_000, expense: 2_600_000, net: 8_400_000, previousNet: 0 });
    expect(r.year.start).toBe('2025-11-01');
    expect(r.year.end).toBe(TODAY);
    expect(r.year.netChangeBp).toBeNull(); // nothing in the 12 periods before
  });
});

describe('transfers and the period start day', () => {
  test('a period that starts on the 25th compares the right days', () => {
    const shifted = buildFlowRanges({
      today: '2026-10-28',
      startDay: 25,
      period: '2026-10',
      daily: [
        { date: '2026-09-26', income: 100, expense: 0 },
        { date: '2026-10-26', income: 300, expense: 0 },
      ],
      periods: [],
    });
    expect(shifted.month.start).toBe('2026-10-25');
    expect(shifted.month.points).toHaveLength(4);
    expect(shifted.month).toMatchObject({ income: 300, previousIncome: 100 });
    expect(shifted.month.netChangeBp).toBe(20000);
  });
});
