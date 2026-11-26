// The Summary page (opened from the Overview's net worth cards). "Current": a range ending today with its net total,
// expenses, income and balance corrections, the running net, where the money went (category, then sub-category) and the
// spending per day. "History": income against expenses for the last months. Balance corrections (the system category
// "Penyesuaian saldo") are kept apart from income and expenses; the net total includes them, so it matches the app's net.
import { ADJUSTMENT_CATEGORY_NAME } from '../core/cardAdjustment';
import { addDays, periodEnd, periodOfDate, periodStart, previousPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import { listPeriodCategoryRows, listSummaryRows, type SummaryRow } from '../data/repo/summary';
import { largestRemainderSharesBp } from './categoryStats';
import { getMonthStartDay } from './transactionsList';

export type SummaryRange = 'month' | '3m' | '6m' | 'year';
export const SUMMARY_RANGE_PERIODS: Record<SummaryRange, number> = { month: 1, '3m': 3, '6m': 6, year: 12 };
export type HistoryMonths = 3 | 6 | 12;

export interface SummaryTotals {
  income: number;
  expense: number;
  correction: number; // signed: money the corrections added minus money they took
  net: number; // income - expense + correction
}

export interface SummarySub {
  id: number | null; // null: records of the category without a sub-category
  name: string | null;
  amount: number;
}

export interface SummaryCategory {
  id: number;
  name: string;
  icon: string | null;
  amount: number;
  shareBp: number; // of all expenses in the range; the list adds up to 10000
  subs: SummarySub[]; // empty when no record of this category has a sub-category
}

export interface SummaryData extends SummaryTotals {
  range: SummaryRange;
  start: string;
  end: string; // today
  running: { date: string; net: number }[]; // the net so far, one point per day of the range
  categories: SummaryCategory[]; // expenses, biggest first
  spendByDay: Record<string, number>; // 'YYYY-MM-DD' -> expenses; days without spending are absent
  isEmpty: boolean;
}

export interface HistoryRow extends SummaryTotals {
  period: string;
  partial: boolean; // the running period
}

const isCorrection = (name: string) => name === ADJUSTMENT_CATEGORY_NAME;

function addTo(totals: SummaryTotals, kind: 'income' | 'expense', name: string, amount: number): void {
  if (isCorrection(name)) totals.correction += kind === 'income' ? amount : -amount;
  else totals[kind] += amount;
  totals.net += kind === 'income' ? amount : -amount;
}

const zero = (): SummaryTotals => ({ income: 0, expense: 0, correction: 0, net: 0 });

function categoriesOf(rows: SummaryRow[]): SummaryCategory[] {
  const byCategory = new Map<number, { name: string; icon: string | null; amount: number; subs: Map<number | null, SummarySub> }>();
  for (const row of rows) {
    if (row.kind !== 'expense' || isCorrection(row.category_name)) continue;
    let category = byCategory.get(row.category_id);
    if (!category) byCategory.set(row.category_id, (category = { name: row.category_name, icon: row.category_icon, amount: 0, subs: new Map() }));
    category.amount += row.amount_idr;
    const sub = category.subs.get(row.subcategory_id);
    if (sub) sub.amount += row.amount_idr;
    else category.subs.set(row.subcategory_id, { id: row.subcategory_id, name: row.subcategory_name, amount: row.amount_idr });
  }
  const list = [...byCategory.entries()].sort((a, b) => b[1].amount - a[1].amount || a[1].name.localeCompare(b[1].name));
  const total = list.reduce((sum, [, c]) => sum + c.amount, 0);
  const shares = largestRemainderSharesBp(list.map(([, c]) => c.amount), total);
  return list.map(([id, c], index) => {
    const subs = [...c.subs.values()];
    // biggest first, "no sub-category" always last
    subs.sort((a, b) => Number(a.id === null) - Number(b.id === null) || b.amount - a.amount);
    return { id, name: c.name, icon: c.icon, amount: c.amount, shareBp: shares[index], subs: subs.some(s => s.id !== null) ? subs : [] };
  });
}

export async function getSummary(db: Db, range: SummaryRange, todayIso: string): Promise<SummaryData> {
  const end = todayIso.slice(0, 10);
  const startDay = await getMonthStartDay(db);
  let period = periodOfDate(end, startDay);
  for (let i = 1; i < SUMMARY_RANGE_PERIODS[range]; i++) period = previousPeriod(period, startDay);
  const start = periodStart(period, startDay);
  const rows = await listSummaryRows(db, start, end);

  const totals = zero();
  const netByDay = new Map<string, number>();
  const spendByDay: Record<string, number> = {};
  for (const row of rows) {
    addTo(totals, row.kind, row.category_name, row.amount_idr);
    netByDay.set(row.date, (netByDay.get(row.date) ?? 0) + (row.kind === 'income' ? row.amount_idr : -row.amount_idr));
    if (row.kind === 'expense' && !isCorrection(row.category_name)) spendByDay[row.date] = (spendByDay[row.date] ?? 0) + row.amount_idr;
  }

  const running: SummaryData['running'] = [];
  let sum = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    sum += netByDay.get(date) ?? 0;
    running.push({ date, net: sum });
  }

  return { ...totals, range, start, end, running, categories: categoriesOf(rows), spendByDay, isEmpty: rows.length === 0 };
}

export async function getSummaryHistory(db: Db, months: HistoryMonths, todayIso: string, accountId: number | null): Promise<HistoryRow[]> {
  const today = todayIso.slice(0, 10);
  const startDay = await getMonthStartDay(db);
  const current = periodOfDate(today, startDay);
  const periods = [current];
  while (periods.length < months) periods.unshift(previousPeriod(periods[0], startDay));

  const rows = await listPeriodCategoryRows(db, periods[0], current, accountId);
  return periods.map(period => {
    const totals = zero();
    for (const row of rows) if (row.period === period) addTo(totals, row.kind, row.category_name, row.amount_idr);
    return { period, ...totals, partial: period === current && today < periodEnd(period, startDay) };
  });
}

// ---------------------------------------------------------------- the spending calendar

export interface HeatDay {
  date: string;
  amount: number;
  level: 0 | 1 | 2 | 3 | 4; // 0: nothing spent; 1..4: quarters of the biggest day in the range
  inRange: boolean;
}

export function heatLevel(amount: number, biggest: number): HeatDay['level'] {
  if (amount <= 0 || biggest <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((amount * 4) / biggest))) as HeatDay['level'];
}

// The weeks of one calendar month ('YYYY-MM'), Monday first; null pads the first and last week.
export function heatWeeks(month: string, data: Pick<SummaryData, 'spendByDay' | 'start' | 'end'>): (HeatDay | null)[][] {
  const biggest = Math.max(0, ...Object.values(data.spendByDay));
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (HeatDay | null)[] = Array.from({ length: lead }, () => null);
  for (let date = first; date.slice(0, 7) === month; date = addDays(date, 1)) {
    const amount = data.spendByDay[date] ?? 0;
    cells.push({ date, amount, level: heatLevel(amount, biggest), inRange: date >= data.start && date <= data.end });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

// The calendar months a range touches, oldest first.
export function calendarMonths(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = start.slice(0, 7).split('-').map(Number);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end.slice(0, 7)) return months;
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}
