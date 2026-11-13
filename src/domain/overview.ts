// Overview tab read model (DESIGN.md "A. Overview"). Composes figures the views already
// produce — v_period_flow, v_category_spend, v_net_worth_by_month — into the one shape
// the screen draws. No new SQL and no stored numbers (CLAUDE.md rule 2): the only
// arithmetic here is month-over-month change, in integer basis points through
// pctChangeBp (half away from zero).
import { addDays, periodOfDate, previousPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import { pctChangeBp } from './budget';
import { getCategoryStats, largestRemainderSharesBp, type CategoryStatsResult } from './categoryStats';
import { getNetWorth, getNetWorthHistory, type NetWorthMonth } from './net-worth';
import { listPeriodFlow } from './reports';
import { getMonthStartDay } from './transactionsList';

export const CASH_FLOW_MONTHS = 12;

export interface OverviewFlow {
  income: number;
  expense: number;
  net: number;
}

export interface OverviewMonthFlow extends OverviewFlow {
  period: string;
}

// One slice of a share chart: whole rupiah plus its share, largest-remainder rounded so
// the shares of one chart add up exactly.
export interface ShareRow {
  id: number; // -1 for the "Others" bucket
  label: string;
  amount: number;
  sharePermille: number; // one decimal: 335 = 33,5%
}

export interface OverviewData {
  period: string;
  previousPeriod: string;
  month: OverviewFlow;
  previous: OverviewFlow;
  // null when last month's figure is 0 (the change is undefined, so the card shows no %).
  expenseChangeBp: number | null;
  incomeChangeBp: number | null;
  netWorth: number;
  netWorthIncomplete: boolean;
  // vs the end of the previous calendar month; null when there is no earlier month yet.
  netWorthChange: number | null;
  netWorthChangeBp: number | null;
  netWorthVsDate: string | null; // 'YYYY-MM-DD', last day of the previous month
  // Year to date: vs the last month end before this calendar year (31 Dec last year); null
  // when the records start this year, so there is no earlier month end to compare with.
  netWorthYtdChange: number | null;
  netWorthYtdBp: number | null;
  netWorthYtdVsDate: string | null; // 'YYYY-MM-DD'
  netWorthHistory: NetWorthMonth[];
  cashFlow: OverviewMonthFlow[]; // CASH_FLOW_MONTHS periods, oldest first, this period last
  topCategories: CategoryStatsResult;
  // The same buckets with one-decimal shares (Top categories ring and legend).
  topShares: ShareRow[];
}

// "Where your money is": every account's share of the money held, largest first, one row
// per account (nothing is folded into "Others", so each account can be read on its own).
// An account at zero is listed with a 0,00% share; one below zero is not part of a share
// of money held. Basis points (two decimals), summing to exactly 10000.
export interface AccountShareInput {
  id: number;
  name: string;
  balance: number;
}

export interface AccountShareRow {
  id: number;
  label: string;
  amount: number;
  shareBp: number;
}

export function accountShares(accounts: AccountShareInput[]): AccountShareRow[] {
  const held = accounts.filter(a => a.balance >= 0).sort((a, b) => b.balance - a.balance);
  const total = held.reduce((sum, a) => sum + a.balance, 0);
  if (total <= 0) return [];
  const shares = largestRemainderSharesBp(held.map(a => a.balance), total);
  return held.map((a, i) => ({ id: a.id, label: a.name, amount: a.balance, shareBp: shares[i] }));
}

const ZERO_FLOW: OverviewFlow = { income: 0, expense: 0, net: 0 };

export async function getOverviewData(db: Db, todayIso: string): Promise<OverviewData> {
  const today = todayIso.slice(0, 10);
  const startDay = await getMonthStartDay(db);
  const period = periodOfDate(today, startDay);
  const previous = previousPeriod(period, startDay);

  const [flows, history, worth, topCategories] = await Promise.all([
    listPeriodFlow(db),
    getNetWorthHistory(db),
    getNetWorth(db),
    getCategoryStats(db, period, 'expense', false),
  ]);

  const flowOf = (p: string): OverviewFlow => {
    const row = flows.find(f => f.period === p);
    return row ? { income: row.income, expense: row.expense, net: row.net } : ZERO_FLOW;
  };

  const topPermille = largestRemainderSharesBp(
    topCategories.categories.map(c => c.amountIdr),
    topCategories.total,
    1000,
  );
  const topShares: ShareRow[] = topCategories.categories.map((c, i) => ({
    id: c.id,
    label: c.label,
    amount: c.amountIdr,
    sharePermille: topPermille[i],
  }));

  const periods: string[] = [period];
  for (let i = 1; i < CASH_FLOW_MONTHS; i++) periods.unshift(previousPeriod(periods[0], startDay));

  const month = flowOf(period);
  const prev = flowOf(previous);

  // History is per calendar month, month-end valued, the current month valued to date.
  const currentMonth = today.slice(0, 7);
  const last = history[history.length - 1];
  const before = history.length >= 2 ? history[history.length - 2] : null;
  const hasChange = !!last && last.month === currentMonth && !!before;
  const netWorthChange = hasChange ? worth.netWorth - before.netWorth : null;

  // Year to date: the newest month end before this year (history is oldest first).
  const yearStart = `${currentMonth.slice(0, 4)}-01`;
  const yearBaseline = [...history].reverse().find(m => m.month < yearStart) ?? null;
  const hasYtd = !!last && last.month === currentMonth && !!yearBaseline;

  return {
    period,
    previousPeriod: previous,
    month,
    previous: prev,
    expenseChangeBp: pctChangeBp(month.expense, prev.expense),
    incomeChangeBp: pctChangeBp(month.income, prev.income),
    netWorth: worth.netWorth,
    netWorthIncomplete: worth.incomplete,
    netWorthChange,
    netWorthChangeBp: hasChange ? pctChangeBp(worth.netWorth, before.netWorth) : null,
    netWorthVsDate: hasChange ? addDays(`${currentMonth}-01`, -1) : null,
    netWorthYtdChange: hasYtd ? worth.netWorth - yearBaseline.netWorth : null,
    netWorthYtdBp: hasYtd ? pctChangeBp(worth.netWorth, yearBaseline.netWorth) : null,
    netWorthYtdVsDate: hasYtd ? addDays(`${yearStart}-01`, -1) : null,
    netWorthHistory: history,
    cashFlow: periods.map(p => ({ period: p, ...flowOf(p) })),
    topCategories,
    topShares,
  };
}
