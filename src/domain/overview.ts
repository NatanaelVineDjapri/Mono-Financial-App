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

export const CASH_FLOW_MONTHS = 6;

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
  netWorthHistory: NetWorthMonth[];
  cashFlow: OverviewMonthFlow[]; // CASH_FLOW_MONTHS periods, oldest first, this period last
  topCategories: CategoryStatsResult;
  // The same buckets with one-decimal shares (Top categories ring and legend).
  topShares: ShareRow[];
}

const ACCOUNT_SLICES = 3; // at most this many rows; beyond it, the two largest + one Others

// "Where your money is": each account's share of the positive balances, largest first;
// with more than three accounts the two largest are named and the rest fold into Others. Accounts at or below zero are not part of a share of
// money held. Basis points (two decimals), summing to exactly 10000.
export interface AccountShareInput {
  id: number;
  name: string;
  balance: number;
}

export interface AccountShareRow {
  id: number; // -1 for Others
  label: string;
  amount: number;
  shareBp: number;
}

export function accountShares(accounts: AccountShareInput[]): AccountShareRow[] {
  const positive = accounts.filter(a => a.balance > 0).sort((a, b) => b.balance - a.balance);
  const named = positive.length <= ACCOUNT_SLICES ? positive.length : ACCOUNT_SLICES - 1;
  const top = positive.slice(0, named);
  const rest = positive.slice(named);
  const buckets: { id: number; label: string; amount: number }[] = top.map(a => ({ id: a.id, label: a.name, amount: a.balance }));
  const restTotal = rest.reduce((sum, a) => sum + a.balance, 0);
  if (restTotal > 0) buckets.push({ id: -1, label: '', amount: restTotal });
  const total = buckets.reduce((sum, b) => sum + b.amount, 0);
  const shares = largestRemainderSharesBp(buckets.map(b => b.amount), total);
  return buckets.map((b, i) => ({ ...b, shareBp: shares[i] }));
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
    netWorthHistory: history,
    cashFlow: periods.map(p => ({ period: p, ...flowOf(p) })),
    topCategories,
    topShares,
  };
}
