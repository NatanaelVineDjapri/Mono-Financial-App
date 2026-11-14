// Reports read model (PAGES.md H · Reports). Every figure is composed from the schema's
// views — v_period_flow, v_category_spend, v_net_worth_by_month — so the screen only
// formats. Period bucketing honours settings.month_start_day inside the views; only the
// range's own period list and date captions need the setting here.
import { calendarMonthEnd, daysBetween, periodEnd, periodOfDate, periodStart, previousPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import type { PeriodFlowRow } from '../data/repo/reports';
import * as repo from '../data/repo/reports';
import { getNetWorth, getNetWorthHistory } from './net-worth';
import { getMonthStartDay } from './transactionsList';

export type ReportRange = 'month' | '3m' | '6m' | 'year';

export const REPORT_RANGE_MONTHS: Record<ReportRange, number> = {
  month: 1,
  '3m': 3,
  '6m': 6,
  year: 12,
};

const TREND_MONTHS = 6;
const NET_WORTH_MONTHS = 6;
// "Under one month of data" (the screen's empty state). 28 days is the shortest month,
// so a full first February already counts as a month rather than being called empty.
const ONE_MONTH_DAYS = 28;

export interface ReportFlow {
  income: number;
  expense: number;
  net: number;
  savingsRateBp: number | null; // null when the range has no income
}

export interface ReportCategoryRow {
  id: number;
  label: string;
  amount: number;
  shareBp: number; // 100 = 1,00%; each rounded on its own, so they can miss 100% by a hair
}

export interface ReportTrendRow {
  period: string;
  income: number;
  expense: number;
  net: number;
  partial: boolean; // the current period, before its last day
}

export interface ReportNetWorthRow {
  month: string;
  netWorth: number;
  change: number | null; // whole rupiah vs the previous row; null on the first record
  partial: boolean; // the current calendar month, before its last day
}

export interface ReportData {
  period: string;
  range: ReportRange;
  rangePeriods: string[];
  rangeStart: string;
  rangeEnd: string; // today when the range is still open
  flow: ReportFlow;
  categories: ReportCategoryRow[];
  categoryTotal: number;
  trend: ReportTrendRow[];
  netWorthRows: ReportNetWorthRow[];
  netWorth: number; // exact current net worth (v_net_worth)
  netWorthIncomplete: boolean;
  balanceMonthEnd: string; // for the account-balances CSV
  partialTrendPeriod: string | null;
  hasData: boolean;
  today: string;
  currentPeriod: string;
}

// A category's share in basis points (two decimals), rounded half away from zero. Each
// share is rounded on its own rather than with largest-remainder, so the column can add
// to 99,98% or 100,02% — the card's footnote says so, and the board's own figures do too.
function categoryShareBp(amount: number, total: number): number {
  if (total <= 0 || amount <= 0) return 0;
  return Number((BigInt(amount) * 10_000n + BigInt(total) / 2n) / BigInt(total));
}

// Savings rate with the view's own integer arithmetic: half away from zero, basis points.
function savingsRateBp(income: number, net: number): number | null {
  if (income <= 0) return null;
  return Math.trunc((net * 20000 + (net >= 0 ? income : -income)) / (2 * income));
}

// Signed change in basis points vs `previous`, half away from zero. Uses |previous| so
// a month end below zero still gives a readable percentage.
export function reportChangeBp(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  const diff = current - previous;
  const base = Math.abs(previous);
  const bp = Math.floor((Math.abs(diff) * 20000 + base) / (2 * base));
  return diff < 0 ? -bp : bp;
}

function periodsEndingAt(period: string, count: number, startDay: number): string[] {
  const periods: string[] = [period];
  for (let i = 1; i < count; i++) periods.unshift(previousPeriod(periods[0], startDay));
  return periods;
}

export interface GetReportInput {
  period: string;
  range: ReportRange;
  todayIso: string;
}

export async function getReport(db: Db, input: GetReportInput): Promise<ReportData> {
  const today = input.todayIso.slice(0, 10);
  const startDay = await getMonthStartDay(db);
  const currentPeriod = periodOfDate(today, startDay);
  // The screen never offers a future period, but the domain keeps its own promise.
  const period = input.period > currentPeriod ? currentPeriod : input.period;

  const rangePeriods = periodsEndingAt(period, REPORT_RANGE_MONTHS[input.range], startDay);
  const first = rangePeriods[0];
  const last = rangePeriods[rangePeriods.length - 1];
  const rangeStart = periodStart(first, startDay);
  const rangeEnd = last === currentPeriod && today < periodEnd(last, startDay)
    ? today
    : periodEnd(last, startDay);

  const [flows, categoryRows, history, worth, earliest] = await Promise.all([
    repo.listPeriodFlow(db),
    repo.listCategorySpendRange(db, first, last),
    getNetWorthHistory(db),
    getNetWorth(db),
    repo.getEarliestActivityDate(db),
  ]);

  const flowByPeriod = new Map<string, PeriodFlowRow>(flows.map(row => [row.period, row]));
  const flow = rangePeriods.reduce(
    (sum, p) => {
      const row = flowByPeriod.get(p);
      if (!row) return sum;
      return { income: sum.income + row.income, expense: sum.expense + row.expense, net: sum.net + row.net };
    },
    { income: 0, expense: 0, net: 0 },
  );

  const categoryTotal = categoryRows.reduce((sum, row) => sum + row.spent, 0);
  const categories: ReportCategoryRow[] = categoryRows.map(row => ({
    id: row.category_id,
    label: row.category_name,
    amount: row.spent,
    shareBp: categoryShareBp(row.spent, categoryTotal),
  }));

  const trendPeriods = periodsEndingAt(period, TREND_MONTHS, startDay);
  const trend: ReportTrendRow[] = trendPeriods.map(p => {
    const row = flowByPeriod.get(p);
    return {
      period: p,
      income: row?.income ?? 0,
      expense: row?.expense ?? 0,
      net: row?.net ?? 0,
      partial: p === currentPeriod && today < periodEnd(p, startDay),
    };
  });
  const partialTrendPeriod = trend.find(row => row.partial)?.period ?? null;

  // Net worth history is per calendar month-end; the table ends at the selected
  // period's own month, the way the board shows Oct for an October period.
  const anchorMonth = period.slice(0, 7);
  const historySlice = history.filter(row => row.month <= anchorMonth).slice(-NET_WORTH_MONTHS);
  const netWorthRows: ReportNetWorthRow[] = historySlice.map((row, i) => ({
    month: row.month,
    netWorth: row.netWorth,
    change: i > 0 ? row.netWorth - historySlice[i - 1].netWorth : null,
    partial: row.month === today.slice(0, 7) && today < calendarMonthEnd(row.month),
  }));

  return {
    period,
    range: input.range,
    rangePeriods,
    rangeStart,
    rangeEnd,
    flow: { ...flow, savingsRateBp: savingsRateBp(flow.income, flow.net) },
    categories,
    categoryTotal,
    trend,
    netWorthRows,
    netWorth: worth.netWorth,
    netWorthIncomplete: worth.incomplete,
    balanceMonthEnd: calendarMonthEnd(anchorMonth),
    partialTrendPeriod,
    hasData: earliest != null && daysBetween(earliest, today) >= ONE_MONTH_DAYS,
    today,
    currentPeriod,
  };
}

export function getPeriodFlow(db: Db, period: string) {
  return repo.getPeriodFlow(db, period);
}

export function listPeriodFlow(db: Db) {
  return repo.listPeriodFlow(db);
}

export function getSavingsRate(db: Db, period: string) {
  return repo.getSavingsRate(db, period);
}

export function listCategorySpend(db: Db, period: string) {
  return repo.listCategorySpend(db, period);
}
