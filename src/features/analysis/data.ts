// Reads the facts the health score needs from the existing views and builds the pure domain input for any
// period (src/domain/health does the scoring). Nothing is stored: the score of every period, past or running,
// is derived on the spot, like a balance. Transfers never count (v_period_flow leaves them out by construction).
//
// Net worth history comes from v_net_worth_by_month, which is per calendar month end, the same as Reports; with
// a month start day other than 1 the series is therefore read at calendar month ends.
import { daysBetween, periodEnd, periodOfDate, periodStart, previousPeriod } from '@/core/date';
import type { Db } from '@/data/db/types';
import * as analysisRepo from '@/data/repo/analysis';
import { listBudgetStatus } from '@/data/repo/budgets';
import { monthlyRecurringEstimate } from '@/data/repo/recurring';
import { listPeriodFlow, type PeriodFlowRow } from '@/data/repo/reports';
import { getNetWorth, getNetWorthHistory } from '@/domain/net-worth';
import { getMonthStartDay } from '@/domain/transactionsList';
import { buildInsights, computeHealth, type HealthBand, type HealthResult, type Insights, type InsightInput } from '@/domain/health';

export const TREND_PERIODS = 6;

export interface PeriodAnalysis {
  period: string;
  input: InsightInput;
  result: HealthResult;
  insights: Insights | null; // null when the score cannot be calculated yet
  overBudgets: number;
}

export interface TrendPoint {
  period: string;
  score: number | null; // null when that period could not be scored
  band: HealthBand | null;
  partial: boolean; // the running period, scored up to today
}

export interface AnalysisData {
  period: string;
  currentPeriod: string;
  running: boolean;
  rangeStart: string;
  rangeEnd: string; // today while the period is running
  today: string;
  earliestPeriod: string | null; // the first period that has a record; the arrow back stops there
  analysis: PeriodAnalysis;
  previousPeriod: string;
  previousScore: number | null; // only when the previous period could be scored
  trend: TrendPoint[];
}

interface Shared {
  startDay: number;
  today: string;
  currentPeriod: string;
  flows: Map<string, PeriodFlowRow>;
  history: { month: string; netWorth: number }[];
  currentNetWorth: number;
  earliestTx: string | null;
}

async function analyzePeriod(db: Db, shared: Shared, period: string): Promise<PeriodAnalysis> {
  const { startDay, today, currentPeriod, flows, history, currentNetWorth, earliestTx } = shared;
  const running = period === currentPeriod;
  const start = periodStart(period, startDay);
  const fullEnd = periodEnd(period, startDay);
  const end = running && today < fullEnd ? today : fullEnd;

  const flow = flows.get(period);
  const previous = flows.get(previousPeriod(period, startDay));

  const [budgetRows, fixed, transactionCount, accountCount] = await Promise.all([
    listBudgetStatus(db, period),
    monthlyRecurringEstimate(db, start),
    analysisRepo.countTransactionsUpTo(db, end),
    analysisRepo.countAccountsOn(db, end),
  ]);

  // Net worth at the end of each of the last 6 periods; the running one is the live figure.
  const series = history.filter(row => row.month <= period).slice(-TREND_PERIODS).map(row => row.netWorth);
  if (running) {
    if (history.some(row => row.month === period) && series.length > 0) series[series.length - 1] = currentNetWorth;
    else series.push(currentNetWorth);
  }

  const input: InsightInput = {
    income: flow?.income ?? 0,
    expense: flow?.expense ?? 0,
    budgets: budgetRows.map(row => ({ categoryId: row.category_id, name: row.category, limit: row.limit_amount, spent: row.spent })),
    balance: series.length > 0 ? series[series.length - 1] : 0,
    fixedMonthly: fixed.amount,
    netWorthSeries: series.slice(-TREND_PERIODS),
    dayOfPeriod: daysBetween(start, end) + 1,
    previousExpense: previous ? previous.expense : null,
    transactionCount,
    dataSpanDays: earliestTx && earliestTx <= end ? daysBetween(earliestTx, end) + 1 : 0,
    accountCount,
    daysLeft: running ? Math.max(0, daysBetween(today, fullEnd)) : null,
  };

  const result = computeHealth(input);
  return {
    period,
    input,
    result,
    insights: result.eligible ? buildInsights(input, result) : null,
    overBudgets: input.budgets.filter(b => b.spent > b.limit).length,
  };
}

export async function getAnalysis(db: Db, requestedPeriod: string, todayIso: string): Promise<AnalysisData> {
  const today = todayIso.slice(0, 10);
  const startDay = await getMonthStartDay(db);
  const currentPeriod = periodOfDate(today, startDay);
  const period = requestedPeriod > currentPeriod ? currentPeriod : requestedPeriod;

  const [flowRows, history, worth, earliestTx] = await Promise.all([
    listPeriodFlow(db),
    getNetWorthHistory(db),
    getNetWorth(db),
    analysisRepo.getEarliestTransactionDate(db),
  ]);
  const shared: Shared = {
    startDay,
    today,
    currentPeriod,
    flows: new Map(flowRows.map(row => [row.period, row])),
    history,
    currentNetWorth: worth.netWorth,
    earliestTx,
  };

  const trendPeriods: string[] = [period];
  for (let i = 1; i < TREND_PERIODS; i++) trendPeriods.unshift(previousPeriod(trendPeriods[0], startDay));
  const prevPeriod = previousPeriod(period, startDay);

  const byPeriod = new Map<string, PeriodAnalysis>();
  for (const p of new Set([...trendPeriods, prevPeriod, period])) byPeriod.set(p, await analyzePeriod(db, shared, p));

  const analysis = byPeriod.get(period) as PeriodAnalysis;
  const previousResult = (byPeriod.get(prevPeriod) as PeriodAnalysis).result;

  return {
    period,
    currentPeriod,
    running: period === currentPeriod,
    rangeStart: periodStart(period, startDay),
    rangeEnd: period === currentPeriod && today < periodEnd(period, startDay) ? today : periodEnd(period, startDay),
    today,
    earliestPeriod: earliestTx ? periodOfDate(earliestTx, startDay) : null,
    analysis,
    previousPeriod: prevPeriod,
    previousScore: previousResult.eligible ? previousResult.score : null,
    trend: trendPeriods.map(p => {
      const r = (byPeriod.get(p) as PeriodAnalysis).result;
      return { period: p, score: r.eligible ? r.score : null, band: r.eligible ? r.band : null, partial: p === currentPeriod && today < periodEnd(p, startDay) };
    }),
  };
}
