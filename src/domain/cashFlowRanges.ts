// Net cash flow for the Overview's block with its Week / Month / Year switch. Income and expense are the
// consumption flow (amount_idr, transfers never count). Each range gives a running total (cumulative net) per
// bucket for the line, the totals for the In and Out tiles, and the same figures for the range before it so the
// change can be told:
//   week   the last 7 days up to today, against the 7 days before;
//   month  the running period from its first day to today, against the same days of the previous period
//          (the fair comparison while the period is still running);
//   year   the last 12 periods, one bucket each, against the 12 before.
// Pure: the reader in overview.ts hands it the daily and per-period rows from the views.
import { addDays, daysBetween, periodEnd, periodStart, previousPeriod } from '../core/date';
import { reportChangeBp } from './reports';

export type FlowRangeKey = 'week' | 'month' | 'year';

export interface DailyFlow {
  date: string; // 'YYYY-MM-DD'
  income: number;
  expense: number;
}

export interface PeriodFlowSum {
  period: string; // 'YYYY-MM'
  income: number;
  expense: number;
}

export interface FlowPoint {
  key: string; // 'YYYY-MM-DD' for a day, 'YYYY-MM' for a period
  net: number; // that bucket's own net
  cumulative: number; // running net from the start of the range to the end of this bucket
}

export interface FlowRange {
  key: FlowRangeKey;
  start: string; // first day (a period's first day for the year range)
  end: string; // last day included (today while running)
  period: string; // the period the range ends in
  previousPeriod: string;
  income: number;
  expense: number;
  net: number;
  previousIncome: number;
  previousExpense: number;
  previousNet: number;
  netChangeBp: number | null; // vs the previous range; null when that was 0
  points: FlowPoint[];
}

export interface FlowRangesInput {
  today: string;
  startDay: number; // settings.month_start_day
  period: string; // the running period
  daily: DailyFlow[]; // every day from (today - 13) and from the previous period's first day on
  periods: PeriodFlowSum[]; // v_period_flow rows
}

function sum(rows: { income: number; expense: number }[]): { income: number; expense: number } {
  return rows.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense }), { income: 0, expense: 0 });
}

function inRange(rows: DailyFlow[], from: string, to: string): DailyFlow[] {
  return rows.filter(r => r.date >= from && r.date <= to);
}

function dayPoints(rows: DailyFlow[], from: string, to: string): FlowPoint[] {
  const byDate = new Map(rows.map(r => [r.date, r]));
  const out: FlowPoint[] = [];
  let cumulative = 0;
  for (let n = 0, date = from; date <= to && n < 400; n++, date = addDays(date, 1)) {
    const row = byDate.get(date);
    const net = row ? row.income - row.expense : 0;
    cumulative += net;
    out.push({ key: date, net, cumulative });
  }
  return out;
}

function make(key: FlowRangeKey, start: string, end: string, period: string, prevPeriod: string, current: { income: number; expense: number }, previous: { income: number; expense: number }, points: FlowPoint[]): FlowRange {
  const net = current.income - current.expense;
  const previousNet = previous.income - previous.expense;
  return {
    key,
    start,
    end,
    period,
    previousPeriod: prevPeriod,
    income: current.income,
    expense: current.expense,
    net,
    previousIncome: previous.income,
    previousExpense: previous.expense,
    previousNet,
    netChangeBp: reportChangeBp(net, previousNet),
    points,
  };
}

export function buildFlowRanges(input: FlowRangesInput): Record<FlowRangeKey, FlowRange> {
  const { today, startDay, period, daily, periods } = input;
  const prevPeriod = previousPeriod(period, startDay);

  // week
  const weekStart = addDays(today, -6);
  const prevWeekStart = addDays(today, -13);
  const prevWeekEnd = addDays(today, -7);
  const week = make(
    'week',
    weekStart,
    today,
    period,
    prevPeriod,
    sum(inRange(daily, weekStart, today)),
    sum(inRange(daily, prevWeekStart, prevWeekEnd)),
    dayPoints(daily, weekStart, today),
  );

  // month: the running period so far, against the same days of the previous one
  const monthStart = periodStart(period, startDay);
  const fullEnd = periodEnd(period, startDay);
  const monthEnd = today < fullEnd ? today : fullEnd;
  const prevStart = periodStart(prevPeriod, startDay);
  const prevFullEnd = periodEnd(prevPeriod, startDay);
  const sameDaysEnd = addDays(prevStart, daysBetween(monthStart, monthEnd));
  const month = make(
    'month',
    monthStart,
    monthEnd,
    period,
    prevPeriod,
    sum(inRange(daily, monthStart, monthEnd)),
    sum(inRange(daily, prevStart, sameDaysEnd < prevFullEnd ? sameDaysEnd : prevFullEnd)),
    dayPoints(daily, monthStart, monthEnd),
  );

  // year: the last 12 periods, a bucket each
  const last12: string[] = [period];
  for (let i = 1; i < 24; i++) last12.unshift(previousPeriod(last12[0], startDay));
  const flowOf = (p: string): { income: number; expense: number } => periods.find(r => r.period === p) ?? { income: 0, expense: 0 };
  const thisYear = last12.slice(12);
  const beforeYear = last12.slice(0, 12);
  let cumulative = 0;
  const yearPoints: FlowPoint[] = thisYear.map(p => {
    const f = flowOf(p);
    const net = f.income - f.expense;
    cumulative += net;
    return { key: p, net, cumulative };
  });
  const year = make(
    'year',
    periodStart(thisYear[0], startDay),
    monthEnd,
    period,
    previousPeriod(thisYear[0], startDay),
    sum(thisYear.map(flowOf)),
    sum(beforeYear.map(flowOf)),
    yearPoints,
  );

  return { week, month, year };
}
