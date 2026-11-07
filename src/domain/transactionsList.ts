// Read-only Transactions tab data. SQL supplies every displayed row, aggregate and count;
// this domain module resolves the user-selected date preset and period paging metadata.
import { monthLabel as formatMonthLabel, periodEnd, periodOfDate, periodStart, previousPeriod as prevPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import { getSetting } from '../data/repo/settings';
import type { DailyTotalRow, PeriodSummary, TxListFilter, TxListRow } from '../data/repo/transactions';
import * as repo from '../data/repo/transactions';
import {
    isCurrentFullMonthRange,
    resolveTransactionDateRange,
    type TransactionDateRange,
    type TransactionFilters,
} from './transactionFilters';

export type { DailyTotalRow, PeriodSummary, TxListFilter, TxListRow };

export async function getMonthStartDay(db: Db): Promise<number> {
  const raw = await getSetting(db, 'month_start_day');
  const parsed = raw ? Number(raw) : 1;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 31 ? parsed : 1;
}

export async function getCurrentPeriod(db: Db, todayIso: string): Promise<string> {
  const startDay = await getMonthStartDay(db);
  return periodOfDate(todayIso.slice(0, 10), startDay);
}

export interface TransactionsQueryFilter extends TransactionFilters {
  search: string;
}

export interface TransactionFilterContext {
  range: TransactionDateRange;
  repoFilter: TxListFilter;
  currentPeriod: string;
  firstPeriod: string;
  lastPeriod: string;
  isLimitMode: boolean;
}

// This is the single translation from persisted UI state into the parameters used by
// the list, summary, count, daily totals, and category ring. SQL never sees a filter
// reconstructed independently by an individual screen component.
export async function getTransactionFilterContext(
  db: Db,
  filters: TransactionsQueryFilter,
  todayIso: string,
): Promise<TransactionFilterContext> {
  const monthStartDay = await getMonthStartDay(db);
  const range = resolveTransactionDateRange(filters, todayIso, monthStartDay);
  const currentPeriod = periodOfDate(todayIso.slice(0, 10), monthStartDay);
  const repoFilter: TxListFilter = {
    kind: filters.type === 'all' ? undefined : filters.type,
    search: filters.search.trim() || undefined,
    categoryIds: filters.categoryIds,
    accountIds: filters.accountIds,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    startDate: range.startDate,
    endDate: range.endDate,
  };
  return {
    range,
    repoFilter,
    currentPeriod,
    firstPeriod: periodOfDate(range.startDate, monthStartDay),
    lastPeriod: periodOfDate(range.endDate, monthStartDay),
    isLimitMode: isCurrentFullMonthRange(range, todayIso, monthStartDay) &&
      filters.accountIds.length === 0 &&
      filters.categoryIds.length === 0 &&
      filters.minAmount == null &&
      filters.maxAmount == null,
  };
}

export interface TransactionsPage {
  period: string;
  monthLabel: string; // "October 2026"
  rows: TxListRow[];
  daily: DailyTotalRow[];
  summary: PeriodSummary;
  rangeStart: string;
  rangeEnd: string; // the period's own end date, or today when this is the open (current) period
  previousPeriod: string;
  isCurrent: boolean;
  isEmpty: boolean;
}

export async function getTransactionsPage(db: Db, period: string, filter: TxListFilter, todayIso: string): Promise<TransactionsPage> {
  const startDay = await getMonthStartDay(db);
  const [rows, daily, summary] = await Promise.all([
    repo.listTransactionsForPeriod(db, period, filter),
    repo.listDailyTotals(db, period, filter),
    repo.getPeriodSummary(db, period, filter),
  ]);

  const today = todayIso.slice(0, 10);
  const currentPeriod = periodOfDate(today, startDay);
  const isCurrent = period === currentPeriod;
  const end = periodEnd(period, startDay);

  return {
    period,
    monthLabel: formatMonthLabel(period),
    rows,
    daily,
    summary,
    rangeStart: periodStart(period, startDay),
    rangeEnd: isCurrent && today < end ? today : end,
    previousPeriod: prevPeriod(period, startDay),
    isCurrent,
    isEmpty: rows.length === 0,
  };
}

export interface TransactionsFilterSummary extends TransactionFilterContext {
  count: number;
  summary: PeriodSummary;
}

export async function getTransactionsFilterSummary(
  db: Db,
  filters: TransactionsQueryFilter,
  todayIso: string,
): Promise<TransactionsFilterSummary> {
  const context = await getTransactionFilterContext(db, filters, todayIso);
  const [count, summary] = await Promise.all([
    repo.countTransactionsForFilter(db, context.repoFilter),
    repo.getTransactionSummary(db, context.repoFilter),
  ]);
  return { ...context, count, summary };
}

export function getEarliestPeriod(db: Db): Promise<string | null> {
  return repo.getEarliestPeriod(db);
}
