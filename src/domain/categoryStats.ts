// Transactions tab, Fase 4.3c: the ring chart's category breakdown. Reuses the exact
// aggregation Reports already runs (SUM(amount_idr) per category off v_tx, CLAUDE.md
// rule 2 — nothing computed here that SQL hasn't already summed): see
// src/data/repo/transactions.ts's listCategoryTotals, the same grouping
// src/data/repo/reports.ts's listCategorySpend uses for the expense case, just
// parameterised by kind (income or expense) and joined with the category's own name/icon.
import { CHART_CATEGORY_COLORS } from '../theme/tokens';
import type { Db } from '../data/db/types';
import { getMonthBudget } from './budget';
import * as repo from '../data/repo/transactions';

const MAX_CATEGORIES = 4; // + one "Others" bucket

// Largest-remainder rounding (Hamilton's method): rounding each share independently to
// one decimal can land the set a tenth off 100.0% either way — this redistributes the
// leftover/deficit whole tenths to the categories whose exact share was closest to
// rounding up, so the displayed percentages always sum to exactly 100.0% (a basis-point
// integer per CLAUDE.md rule 1, 1 decimal = steps of 10bp).
export function largestRemainderSharesBp(values: number[], total: number): number[] {
  const n = values.length;
  if (n === 0 || total <= 0) return values.map(() => 0);

  const bases: number[] = [];
  const remainders: number[] = [];
  let baseSum = 0;
  for (const v of values) {
    const numerator = BigInt(v) * 10000n;
    const base = Number(numerator / BigInt(total));
    bases.push(base);
    remainders.push(Number(numerator % BigInt(total)));
    baseSum += base;
  }

  const deficit = 10000 - baseSum; // always >= 0 since each base is a floor
  const order = remainders
    .map((r, i) => i)
    .sort((a, b) => remainders[b] - remainders[a]);

  const shares = [...bases];
  for (let i = 0; i < deficit; i++) {
    shares[order[i % n]] += 1;
  }
  return shares;
}

export interface CategoryStat {
  id: number;
  label: string;
  icon: string | null;
  amountIdr: number;
  shareBp: number; // of `total`, largest-remainder rounded, sums to 10000
  color: string;
}

export interface CategoryStatsResult {
  categories: CategoryStat[]; // top 4 by amount, then "Others" if more exist (never more than 5 rows)
  total: number;
  limitIdr?: number; // the ring's own denominator, only set when the period is the real current month
}

export async function getCategoryStats(db: Db, period: string, kind: 'income' | 'expense', isCurrent: boolean): Promise<CategoryStatsResult> {
  const rows = await repo.listCategoryTotals(db, period, kind);
  const total = rows.reduce((sum, r) => sum + r.amount_idr, 0);

  const top = rows.slice(0, MAX_CATEGORIES);
  const rest = rows.slice(MAX_CATEGORIES);
  const othersTotal = rest.reduce((sum, r) => sum + r.amount_idr, 0);

  const buckets = othersTotal > 0 ? [...top, { category_id: -1, category_name: null, category_icon: null, amount_idr: othersTotal }] : top;
  const shares = largestRemainderSharesBp(
    buckets.map(b => b.amount_idr),
    total,
  );

  const categories: CategoryStat[] = buckets.map((b, i) => ({
    id: b.category_id,
    label: b.category_name ?? '', // null only for the synthetic "Others" bucket — the caller supplies its label
    icon: b.category_icon,
    amountIdr: b.amount_idr,
    shareBp: shares[i],
    color: CHART_CATEGORY_COLORS[i] ?? CHART_CATEGORY_COLORS[CHART_CATEGORY_COLORS.length - 1],
  }));

  let limitIdr: number | undefined;
  if (isCurrent && kind === 'expense') {
    const monthBudget = await getMonthBudget(db, period);
    limitIdr = monthBudget?.monthly_limit;
  }

  return { categories, total, limitIdr };
}
