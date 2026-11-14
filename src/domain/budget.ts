import { daysBetween, nextPeriod, periodEnd, periodOfDate, periodStart, previousPeriod } from '../core/date';
import type { Db } from '../data/db/types';
import type {
  BudgetOverviewData,
  BudgetStatusRow,
  BudgetWithCategoryRow,
  CategoryBudgetDetailData,
  MonthBudgetRow,
  MonthlyLimitRow,
} from '../data/repo/budgets';
import * as repo from '../data/repo/budgets';
import { listCategories } from '../data/repo/categories';
import { DomainError, throwDomainError } from './errors';
import { getMonthStartDay } from './transactionsList';

export type { BudgetCategoryRow, BudgetMonthRow, BudgetWithCategoryRow } from '../data/repo/budgets';

export function getBudgetStatus(db: Db, month: string): Promise<BudgetStatusRow[]> {
  return repo.listBudgetStatus(db, month);
}

export function getMonthBudget(db: Db, month: string): Promise<MonthBudgetRow | null> {
  return repo.getMonthBudget(db, month);
}

// Friendly pre-check before SQL (trg_limit_upd stays the real guard): a limit may not
// drop below what the month's category budgets already allocate.
export async function setMonthlyLimit(db: Db, month: string, amount: number, repeat = true): Promise<void> {
  const allocated = (await repo.listBudgets(db, month)).reduce((sum, b) => sum + b.limit_amount, 0);
  const check = checkAllocation(amount, allocated, 0);
  if (check.status === 'over') {
    throw new DomainError('over_monthly_limit', { overBy: check.overBy });
  }
  try {
    await repo.setMonthlyLimit(db, month, amount, repeat);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function deleteMonthlyLimit(db: Db, month: string): Promise<void> {
  try {
    await repo.deleteMonthlyLimit(db, month);
  } catch (err) {
    throwDomainError(err);
  }
}

export interface CreateBudgetInput {
  categoryId: number;
  month: string;
  limitAmount: number;
  repeat?: boolean;
}

// Friendly pre-check (allocated + this budget vs. the monthly limit, which is 0/absent
// before any limit is set) before SQL, which stays the real guard.
export async function createBudget(db: Db, input: CreateBudgetInput): Promise<number> {
  const monthBudget = await repo.getMonthBudget(db, input.month);
  const allocated = monthBudget?.allocated ?? 0;
  const limit = monthBudget?.monthly_limit ?? 0;
  if (allocated + input.limitAmount > limit) {
    throw new DomainError('over_monthly_limit');
  }
  try {
    return await repo.createBudget(db, input);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function updateBudget(db: Db, id: number, patch: Parameters<typeof repo.updateBudget>[2]): Promise<void> {
  try {
    await repo.updateBudget(db, id, patch);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function deleteBudget(db: Db, id: number): Promise<void> {
  try {
    await repo.deleteBudget(db, id);
  } catch (err) {
    throwDomainError(err);
  }
}

function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Idempotent: call whenever a month is first opened in the UI. If `month` already has a
// monthly limit, this is a no-op. Otherwise, if the previous month's limit has
// repeat = 1, copies the limit and every repeat = 1 budget forward. No scheduled task —
// this is the only mechanism "repeat" has. Resolves true when it copied something, so a
// caller can refresh other cached reads that depend on the month's limit.
export async function ensureMonth(db: Db, month: string): Promise<boolean> {
  const existing: MonthlyLimitRow | null = await repo.getMonthlyLimit(db, month);
  if (existing) return false;

  const prevMonth = previousMonth(month);
  const prevLimit = await repo.getMonthlyLimit(db, prevMonth);
  if (!prevLimit || !prevLimit.repeat) return false;

  await repo.setMonthlyLimit(db, month, prevLimit.amount, true);

  // A category that has been archived keeps this month's data but is not carried into the next one.
  const activeCategoryIds = new Set((await listCategories(db, { kind: 'expense' })).map(c => c.id));
  const prevBudgets = await repo.listBudgets(db, prevMonth);
  for (const budget of prevBudgets.filter(b => b.repeat && activeCategoryIds.has(b.category_id))) {
    await repo.createBudget(db, { categoryId: budget.category_id, month, limitAmount: budget.limit_amount, repeat: true });
  }
  return true;
}

// ---------------------------------------------------------------- Budgets screens (Fase 4.4)

export type AllocationStatus = 'under' | 'exact' | 'over';

export interface AllocationCheck {
  monthlyLimit: number;
  allocated: number; // what other category budgets already take
  adding: number; // this budget (0 when only the limit is edited)
  total: number;
  status: AllocationStatus;
  unallocated: number; // >= 0
  overBy: number; // >= 0
}

// DESIGN.md section 12 rule 5: the monthly limit must cover the sum of category budgets.
// Pure integer arithmetic; the SQL triggers enforce the same rule on write.
export function checkAllocation(monthlyLimit: number, allocated: number, adding: number): AllocationCheck {
  const total = allocated + adding;
  const diff = monthlyLimit - total;
  return {
    monthlyLimit,
    allocated,
    adding,
    total,
    status: diff > 0 ? 'under' : diff === 0 ? 'exact' : 'over',
    unallocated: Math.max(diff, 0),
    overBy: Math.max(-diff, 0),
  };
}

// Signed basis-point change of `current` vs `previous`, half away from zero — same
// rounding convention as v_budget_status's own used_bp (SQL side). Null when `previous`
// is 0 and `current` isn't: the change is undefined, not an infinite or a zero percent,
// so the caller shows the amount alone then.
export function pctChangeBp(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  const diff = current - previous;
  const abs = Math.abs(diff);
  const bp = Math.floor((abs * 20000 + previous) / (2 * previous));
  return diff < 0 ? -bp : bp;
}

// Remaining spread over the days after today, rounded half away from zero (remaining is
// never negative here). Null when no day is left; 0 when nothing is left to spend.
export function availablePerDay(remaining: number, daysLeft: number): number | null {
  if (daysLeft <= 0) return null;
  if (remaining <= 0) return 0;
  return Math.floor((2 * remaining + daysLeft) / (2 * daysLeft));
}

export interface BudgetOverview extends BudgetOverviewData {
  currentMonth: string;
  isCurrent: boolean;
  previousMonth: string | null; // null: nothing older to show
  nextMonth: string | null; // null: already at the current month
  months: string[]; // every month the picker offers, current first, back to the oldest data
  daysLeft: number | null; // current month only: days after today until the period ends
  availablePerDay: number | null;
  isEmpty: boolean; // no monthly limit and no category budget
  monthCreated: boolean; // ensureMonth copied a repeating limit into the current month
}

// Newest first, from `newest` back to `oldest` inclusive. 'YYYY-MM' strings compare in
// calendar order, so the walk stops exactly at `oldest`.
function monthsBetween(oldest: string, newest: string, startDay: number): string[] {
  const months: string[] = [];
  for (let m = newest; m >= oldest; m = previousPeriod(m, startDay)) months.push(m);
  return months;
}

// Budgets tab. `month` null = the current period. Opening the current period runs
// ensureMonth first (the documented "repeat" mechanism); older months are only read.
export async function getBudgetOverview(db: Db, month: string | null, todayIso: string): Promise<BudgetOverview> {
  const startDay = await getMonthStartDay(db);
  const today = todayIso.slice(0, 10);
  const currentMonth = periodOfDate(today, startDay);
  const target = month ?? currentMonth;
  const isCurrent = target === currentMonth;
  const monthCreated = isCurrent ? await ensureMonth(db, target) : false;

  const [data, earliest] = await Promise.all([repo.getBudgetOverview(db, target), repo.getEarliestBudgetMonth(db)]);
  const floor = earliest !== null && earliest < currentMonth ? earliest : currentMonth;
  const daysLeft = isCurrent ? Math.max(daysBetween(today, periodEnd(target, startDay)), 0) : null;

  return {
    ...data,
    currentMonth,
    isCurrent,
    previousMonth: target > floor ? previousPeriod(target, startDay) : null,
    nextMonth: target < currentMonth ? nextPeriod(target, startDay) : null,
    months: monthsBetween(floor, currentMonth, startDay),
    daysLeft,
    availablePerDay: daysLeft !== null && data.limit ? availablePerDay(data.limit.remaining, daysLeft) : null,
    isEmpty: data.limit === null && data.categories.length === 0,
    monthCreated,
  };
}

export interface CategoryMonthSpend {
  period: string;
  spent: number;
}

export interface CategoryBudgetDetail extends CategoryBudgetDetailData {
  // Only when the budget is over: raising it by the overage would bring the month's
  // allocation to `total`; `exceedsLimit` says whether the monthly limit must rise too.
  raise: { by: number; total: number; monthlyLimit: number; exceedsLimit: boolean } | null;
  // The four-month bar chart (Budget-Category): `month` and the three periods before
  // it, oldest first, each against v_category_spend (0 for a period with no expense
  // rows in the category).
  history: CategoryMonthSpend[];
  // `month`'s own date bounds (honouring settings.month_start_day), for "Open in
  // Transactions" to filter the ledger to exactly this period.
  range: { startDate: string; endDate: string };
  priorPeriod: string; // the period right before `month`
  priorSpent: number; // that period's spend in this category (0 if none)
  changeBp: number | null; // `spent` vs `priorSpent`, signed; null when priorSpent is 0 and spent isn't
}

// Oldest first, `month` last.
function lastPeriods(month: string, count: number, startDay: number): string[] {
  const periods = [month];
  for (let i = 1; i < count; i++) periods.unshift(previousPeriod(periods[0], startDay));
  return periods;
}

export async function getCategoryBudgetDetail(db: Db, categoryId: number, month: string): Promise<CategoryBudgetDetail> {
  const startDay = await getMonthStartDay(db);
  const periods = lastPeriods(month, 4, startDay);
  const [data, spentByPeriod] = await Promise.all([
    repo.getCategoryBudgetDetail(db, categoryId, month),
    repo.getCategorySpendForPeriods(db, categoryId, periods),
  ]);

  let raise: CategoryBudgetDetail['raise'] = null;
  if (data.budget && data.budget.over_by > 0 && data.monthlyLimit !== null) {
    const check = checkAllocation(data.monthlyLimit, data.allocated, data.budget.over_by);
    raise = { by: data.budget.over_by, total: check.total, monthlyLimit: data.monthlyLimit, exceedsLimit: check.status === 'over' };
  }

  const priorPeriod = periods[periods.length - 2];
  const priorSpent = spentByPeriod[priorPeriod] ?? 0;

  return {
    ...data,
    raise,
    history: periods.map(period => ({ period, spent: spentByPeriod[period] ?? 0 })),
    range: { startDate: periodStart(month, startDay), endDate: periodEnd(month, startDay) },
    priorPeriod,
    priorSpent,
    changeBp: pctChangeBp(data.spent, priorSpent),
  };
}

export interface BudgetFormContext {
  month: string;
  monthlyLimit: { amount: number; repeat: boolean } | null;
  budgets: BudgetWithCategoryRow[];
  availableCategories: { id: number; name: string }[];
  editing: BudgetWithCategoryRow | null; // the category's budget this month, when it exists
}

export async function getBudgetFormContext(db: Db, month: string, categoryId?: number): Promise<BudgetFormContext> {
  const [limit, budgets, availableCategories] = await Promise.all([
    repo.getMonthlyLimit(db, month),
    repo.listBudgetsWithCategory(db, month),
    repo.listCategoriesWithoutBudget(db, month),
  ]);
  return {
    month,
    monthlyLimit: limit ? { amount: limit.amount, repeat: limit.repeat === 1 } : null,
    budgets,
    availableCategories,
    editing: categoryId === undefined ? null : budgets.find(b => b.category_id === categoryId) ?? null,
  };
}

export interface SaveBudgetInput {
  month: string;
  categoryId: number;
  limitAmount: number;
  repeat: boolean;
  // Set (or raise) the month's limit in the same transaction, e.g. after "Raise monthly
  // limit to …" or for the month's first budget. Omit to keep the stored limit.
  monthlyLimit?: number;
}

// Creates or updates one category budget, plus the month's limit when given, in one
// exclusive transaction. The pre-check names the overage; the triggers stay the guard.
export async function saveBudget(db: Db, input: SaveBudgetInput): Promise<number> {
  if (!Number.isInteger(input.limitAmount) || input.limitAmount <= 0) {
    throw new RangeError('A budget needs an amount above 0.');
  }
  let budgetId = 0;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const [current, budgets] = await Promise.all([repo.getMonthlyLimit(txn, input.month), repo.listBudgets(txn, input.month)]);
      const existing = budgets.find(b => b.category_id === input.categoryId) ?? null;
      const allocatedOthers = budgets.filter(b => b !== existing).reduce((sum, b) => sum + b.limit_amount, 0);
      const limit = input.monthlyLimit ?? current?.amount ?? 0;
      const check = checkAllocation(limit, allocatedOthers, input.limitAmount);
      if (check.status === 'over') {
        throw new DomainError('over_monthly_limit', { overBy: check.overBy });
      }

      const limitChanges = input.monthlyLimit !== undefined && (current === null || current.amount !== input.monthlyLimit);
      const raising = limitChanges && (current === null || input.monthlyLimit! > current.amount);
      const writeLimit = () => repo.setMonthlyLimit(txn, input.month, input.monthlyLimit!, current ? current.repeat === 1 : true);
      // Order matters for the AFTER triggers: raise the limit before the budget grows,
      // lower it only after the budget has shrunk.
      if (raising) await writeLimit();
      if (existing) {
        await repo.updateBudget(txn, existing.id, { limitAmount: input.limitAmount, repeat: input.repeat });
        budgetId = existing.id;
      } else {
        budgetId = await repo.createBudget(txn, { categoryId: input.categoryId, month: input.month, limitAmount: input.limitAmount, repeat: input.repeat });
      }
      if (limitChanges && !raising) await writeLimit();
    });
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throwDomainError(err);
  }
  return budgetId;
}
