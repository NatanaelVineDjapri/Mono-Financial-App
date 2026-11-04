import * as repo from '../data/repo/budgets';
import type { BudgetStatusRow, MonthBudgetRow, MonthlyLimitRow } from '../data/repo/budgets';
import type { Db } from '../data/db/types';
import { DomainError, throwDomainError } from './errors';

export function getBudgetStatus(db: Db, month: string): Promise<BudgetStatusRow[]> {
  return repo.listBudgetStatus(db, month);
}

export function getMonthBudget(db: Db, month: string): Promise<MonthBudgetRow | null> {
  return repo.getMonthBudget(db, month);
}

export async function setMonthlyLimit(db: Db, month: string, amount: number, repeat = true): Promise<void> {
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
// this is the only mechanism "repeat" has.
export async function ensureMonth(db: Db, month: string): Promise<void> {
  const existing: MonthlyLimitRow | null = await repo.getMonthlyLimit(db, month);
  if (existing) return;

  const prevMonth = previousMonth(month);
  const prevLimit = await repo.getMonthlyLimit(db, prevMonth);
  if (!prevLimit || !prevLimit.repeat) return;

  await repo.setMonthlyLimit(db, month, prevLimit.amount, true);

  const prevBudgets = await repo.listBudgets(db, prevMonth);
  for (const budget of prevBudgets.filter(b => b.repeat)) {
    await repo.createBudget(db, { categoryId: budget.category_id, month, limitAmount: budget.limit_amount, repeat: true });
  }
}
