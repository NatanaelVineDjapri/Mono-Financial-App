// Shared Transactions filter model. The Zustand store holds the unresolved user choice;
// this module turns its date preset into the ISO bounds used by parameterised SQL.
import { periodEnd, periodOfDate, periodStart, previousPeriod } from '@/core/date';

import type { TxKind } from '@/data/repo/transactions';

export type TxDatePreset = 'this-month' | 'last-month' | 'three-months' | 'this-year' | 'custom';
export type TxTypeFilter = 'all' | TxKind;

export interface TransactionFilters {
  datePreset: TxDatePreset;
  customStart?: string;
  customEnd?: string;
  type: TxTypeFilter;
  accountIds: number[];
  categoryIds: number[];
  minAmount?: number; // whole rupiah / amount_idr
  maxAmount?: number; // whole rupiah / amount_idr
}

export interface TransactionDateRange {
  startDate: string;
  endDate: string;
}

export function defaultTransactionFilters(): TransactionFilters {
  return {
    datePreset: 'this-month',
    type: 'all',
    accountIds: [],
    categoryIds: [],
  };
}

export function cloneTransactionFilters(filters: TransactionFilters): TransactionFilters {
  return {
    ...filters,
    accountIds: [...filters.accountIds],
    categoryIds: [...filters.categoryIds],
  };
}

export function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function periodRange(period: string, monthStartDay: number): TransactionDateRange {
  return {
    startDate: periodStart(period, monthStartDay),
    endDate: periodEnd(period, monthStartDay),
  };
}

export function resolveTransactionDateRange(
  filters: TransactionFilters,
  todayIso: string,
  monthStartDay: number,
): TransactionDateRange {
  const today = todayIso.slice(0, 10);
  const currentPeriod = periodOfDate(today, monthStartDay);

  switch (filters.datePreset) {
    case 'this-month':
      return { startDate: periodStart(currentPeriod, monthStartDay), endDate: today };
    case 'last-month':
      return periodRange(previousPeriod(currentPeriod, monthStartDay), monthStartDay);
    case 'three-months': {
      const previous = previousPeriod(currentPeriod, monthStartDay);
      const oldest = previousPeriod(previous, monthStartDay);
      return { startDate: periodStart(oldest, monthStartDay), endDate: today };
    }
    case 'this-year':
      return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
    case 'custom':
      if (!isIsoDate(filters.customStart) || !isIsoDate(filters.customEnd) || filters.customStart > filters.customEnd) {
        throw new RangeError('A custom transaction date range needs a valid start date on or before its end date.');
      }
      return { startDate: filters.customStart, endDate: filters.customEnd };
  }
}

export function isCurrentFullMonthRange(range: TransactionDateRange, todayIso: string, monthStartDay: number): boolean {
  const today = todayIso.slice(0, 10);
  return range.startDate === periodStart(periodOfDate(today, monthStartDay), monthStartDay) && range.endDate === today;
}

export function activeTransactionFilterCount(filters: TransactionFilters): number {
  return (
    (filters.datePreset === 'this-month' ? 0 : 1) +
    (filters.type === 'all' ? 0 : 1) +
    filters.accountIds.length +
    filters.categoryIds.length +
    (filters.minAmount == null ? 0 : 1) +
    (filters.maxAmount == null ? 0 : 1)
  );
}
