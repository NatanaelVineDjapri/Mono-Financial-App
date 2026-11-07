// Transactions tab category-ring aggregation. Every bucket comes from the same
// parameterised transaction filter as the list and summary, then SQL groups by category.
import type { Db } from '../data/db/types';
import type { TxListFilter } from '../data/repo/transactions';
import * as repo from '../data/repo/transactions';
import { CHART_CATEGORY_COLORS } from '../theme/tokens';
import { getMonthBudget } from './budget';

const MAX_CATEGORIES = 4; // + one "Others" bucket

// Largest-remainder rounding (Hamilton's method): shares always sum to exactly 100.0%.
export function largestRemainderSharesBp(values: number[], total: number): number[] {
  const n = values.length;
  if (n === 0 || total <= 0) return values.map(() => 0);

  const bases: number[] = [];
  const remainders: number[] = [];
  let baseSum = 0;
  for (const value of values) {
    const numerator = BigInt(value) * 10000n;
    const base = Number(numerator / BigInt(total));
    bases.push(base);
    remainders.push(Number(numerator % BigInt(total)));
    baseSum += base;
  }

  const deficit = 10000 - baseSum;
  const order = remainders.map((_, index) => index).sort((a, b) => remainders[b] - remainders[a]);
  const shares = [...bases];
  for (let index = 0; index < deficit; index++) shares[order[index % n]] += 1;
  return shares;
}

export interface CategoryStat {
  id: number;
  label: string;
  icon: string | null;
  amountIdr: number;
  shareBp: number;
  color: string;
}

export interface CategoryStatsResult {
  categories: CategoryStat[];
  total: number;
  // Only set for a full current-month expense range with no account/category/amount
  // narrowing. Supplying no limit makes RingChart split a complete circle by portions.
  limitIdr?: number;
}

async function fromRows(
  db: Db,
  rows: repo.CategoryTotalRow[],
  kind: 'income' | 'expense',
  limitPeriod?: string,
): Promise<CategoryStatsResult> {
  const total = rows.reduce((sum, row) => sum + row.amount_idr, 0);
  const top = rows.slice(0, MAX_CATEGORIES);
  const rest = rows.slice(MAX_CATEGORIES);
  const othersTotal = rest.reduce((sum, row) => sum + row.amount_idr, 0);
  const buckets = othersTotal > 0 ? [...top, { category_id: -1, category_name: null, category_icon: null, amount_idr: othersTotal }] : top;
  const shares = largestRemainderSharesBp(buckets.map(bucket => bucket.amount_idr), total);

  const categories: CategoryStat[] = buckets.map((bucket, index) => ({
    id: bucket.category_id,
    label: bucket.category_name ?? '',
    icon: bucket.category_icon,
    amountIdr: bucket.amount_idr,
    shareBp: shares[index],
    color: CHART_CATEGORY_COLORS[index] ?? CHART_CATEGORY_COLORS[CHART_CATEGORY_COLORS.length - 1],
  }));

  const limitIdr = limitPeriod && kind === 'expense'
    ? (await getMonthBudget(db, limitPeriod))?.monthly_limit
    : undefined;
  return { categories, total, limitIdr };
}

// Existing per-period API retained for the initial statistics tests and callers.
export async function getCategoryStats(db: Db, period: string, kind: 'income' | 'expense', isCurrent: boolean): Promise<CategoryStatsResult> {
  const rows = await repo.listCategoryTotalsForFilter(db, kind, { period });
  return fromRows(db, rows, kind, isCurrent ? period : undefined);
}

export async function getFilteredCategoryStats(
  db: Db,
  kind: 'income' | 'expense',
  filter: TxListFilter,
  limitPeriod?: string,
): Promise<CategoryStatsResult> {
  const rows = await repo.listCategoryTotalsForFilter(db, kind, filter);
  return fromRows(db, rows, kind, limitPeriod);
}
