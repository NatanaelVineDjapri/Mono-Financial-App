// Read-only: the Transactions tab's list, daily totals and period summary, all through
// src/data/repo/transactions.ts's views/joins (CLAUDE.md rule 2 — nothing computed here
// that SQL hasn't already summed). This file only adds the period/date bookkeeping
// (current period, its calendar bounds, paging to the previous one) that the repo layer
// doesn't own.
import { monthLabel as formatMonthLabel, periodEnd, periodOfDate, periodStart, previousPeriod as prevPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import { getSetting } from '../data/repo/settings';
import * as repo from '../data/repo/transactions';
import type { DailyTotalRow, PeriodSummary, TxListFilter, TxListRow } from '../data/repo/transactions';

export type { DailyTotalRow, PeriodSummary, TxListFilter, TxListRow };

async function getMonthStartDay(db: Db): Promise<number> {
  const raw = await getSetting(db, 'month_start_day');
  const parsed = raw ? Number(raw) : 1;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 31 ? parsed : 1;
}

export async function getCurrentPeriod(db: Db, todayIso: string): Promise<string> {
  const startDay = await getMonthStartDay(db);
  return periodOfDate(todayIso.slice(0, 10), startDay);
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

export function getEarliestPeriod(db: Db): Promise<string | null> {
  return repo.getEarliestPeriod(db);
}
