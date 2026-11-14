// The categories domain (CLAUDE.md rule 21). A category is NEVER deleted, only archived and
// restored; every kind keeps at least one active category; the kind is locked once something uses
// the category. Each function pre-checks for a friendly reason and then lets the database have the
// last word (migration 7 -> 8 triggers, UNIQUE (name, kind) NOCASE); a raced violation is mapped to
// the same reason. Reads that need "this month" take today's date so the month never comes from a
// stored value.
import { periodOfDate } from '@/core/date';
import type { Db } from '@/data/db/types';
import * as repo from '@/data/repo/categories';
import type { ArchivedCategoryRow, CategoryKind, CategoryListRow, CategoryRow } from '@/data/repo/categories';
import { getMonthStartDay } from '@/domain/transactionsList';

import { DEFAULT_NEW_CATEGORY_ICON, resolveCategoryIcon } from './icons';
import { checkCanArchive, checkCategoryName, isKindLocked, type CategoryError } from './rules';

export type CategoryResult<T = void> = { ok: true; value: T } | { ok: false; error: CategoryError };

const ok = <T>(value: T): CategoryResult<T> => ({ ok: true, value });
const fail = (error: CategoryError): CategoryResult<never> => ({ ok: false, error });

async function currentMonth(db: Db, todayIso: string): Promise<string> {
  return periodOfDate(todayIso.slice(0, 10), await getMonthStartDay(db));
}

// ---------------------------------------------------------------- reads

export interface CategoryOverview {
  expense: CategoryListRow[];
  income: CategoryListRow[];
  archivedCount: number;
}

// The list screen: active categories only (so the headers count only those), with whether each has
// a budget this month, and how many are archived.
export async function getCategoryOverview(db: Db, todayIso: string): Promise<CategoryOverview> {
  const month = await currentMonth(db, todayIso);
  const [expense, income, archivedCount] = await Promise.all([
    repo.listActiveWithBudgetFlag(db, 'expense', month),
    repo.listActiveWithBudgetFlag(db, 'income', month),
    repo.countArchivedCategories(db),
  ]);
  return { expense, income, archivedCount };
}

export async function listArchived(db: Db): Promise<ArchivedCategoryRow[]> {
  return repo.listArchivedWithUsage(db);
}

// Every category, archived included: the edit form checks names against all of them.
export async function listAllForNameCheck(db: Db): Promise<CategoryRow[]> {
  return repo.listCategories(db, { includeArchived: true });
}

export interface CategoryUsage {
  transactionCount: number;
  lastUsedOn: string | null;
  hasBudgetThisMonth: boolean;
  budgetCount: number;
  recurringCount: number;
  kindLocked: boolean;
}

export async function getUsage(db: Db, id: number, todayIso: string): Promise<CategoryUsage> {
  const row = await repo.getCategoryUsageRow(db, id, await currentMonth(db, todayIso));
  const usage = {
    transactionCount: row.transaction_count,
    lastUsedOn: row.last_used_on,
    hasBudgetThisMonth: row.budget_months_this_month > 0,
    budgetCount: row.budget_count,
    recurringCount: row.recurring_count,
  };
  return { ...usage, kindLocked: isKindLocked(usage) };
}

// ---------------------------------------------------------------- writes

// A violation the pre-checks missed (a race, or a check skipped) mapped to the same reasons.
async function mapDbError(db: Db, err: unknown, ctx: { id?: number; kind?: CategoryKind }): Promise<CategoryError> {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('category_kind_locked')) return { code: 'kind_locked' };
  if (message.includes('last_active_category')) return { code: 'last_active', kind: ctx.kind ?? 'expense' };
  if (message.includes('category_in_active_recurring')) {
    const name = ctx.id != null ? await repo.findActiveRecurringUsing(db, ctx.id) : null;
    return { code: 'used_by_recurring', recurringName: name ?? '' };
  }
  if (message.includes('UNIQUE constraint failed') && message.includes('categories')) return { code: 'name_taken', kind: ctx.kind ?? 'expense' };
  throw err;
}

// A new category goes at the end of its kind's order (there is no manual ordering yet).
export async function createCategory(db: Db, input: { kind: CategoryKind; name: string; icon?: string | null }): Promise<CategoryResult<{ id: number }>> {
  const check = checkCategoryName(input.name, input.kind, await repo.listCategories(db, { includeArchived: true }));
  if (!check.ok) return fail(check.error);
  try {
    const id = await repo.createCategory(db, {
      name: check.name,
      kind: input.kind,
      icon: resolveCategoryIcon(input.icon ?? DEFAULT_NEW_CATEGORY_ICON),
      sortOrder: await repo.nextSortOrder(db, input.kind),
    });
    return ok({ id });
  } catch (err) {
    return fail(await mapDbError(db, err, { kind: input.kind }));
  }
}

// Rename and/or change the icon. The kind can only change while nothing uses the category.
export async function updateCategory(
  db: Db,
  id: number,
  fields: { name: string; icon: string | null; kind?: CategoryKind },
  todayIso: string,
): Promise<CategoryResult> {
  const current = await repo.getCategory(db, id);
  if (!current) return fail({ code: 'not_found' });
  const kind = fields.kind ?? current.kind;
  if (kind !== current.kind && (await getUsage(db, id, todayIso)).kindLocked) return fail({ code: 'kind_locked' });
  const check = checkCategoryName(fields.name, kind, await repo.listCategories(db, { includeArchived: true }), id);
  if (!check.ok) return fail(check.error);
  try {
    await repo.updateCategoryRow(db, id, { name: check.name, icon: resolveCategoryIcon(fields.icon), ...(kind !== current.kind ? { kind } : {}) });
    return ok(undefined);
  } catch (err) {
    return fail(await mapDbError(db, err, { id, kind }));
  }
}

// Why this category cannot be archived right now, or null when it can (the edit screen asks before it
// shows the confirmation, so a refusal is explained up front).
export async function checkArchivable(db: Db, id: number): Promise<CategoryError | null> {
  const current = await repo.getCategory(db, id);
  if (!current) return { code: 'not_found' };
  return checkCanArchive(current.kind, await repo.countActiveOfKind(db, current.kind), await repo.findActiveRecurringUsing(db, id));
}

export async function archiveCategory(db: Db, id: number): Promise<CategoryResult> {
  const current = await repo.getCategory(db, id);
  if (!current) return fail({ code: 'not_found' });
  if (current.archived) return ok(undefined);
  const refused = await checkArchivable(db, id);
  if (refused) return fail(refused);
  try {
    await repo.setCategoryArchived(db, id, true);
    return ok(undefined);
  } catch (err) {
    return fail(await mapDbError(db, err, { id, kind: current.kind }));
  }
}

// Restoring has no precondition: the (name, kind) pair was unique while archived too.
export async function restoreCategory(db: Db, id: number): Promise<CategoryResult> {
  const current = await repo.getCategory(db, id);
  if (!current) return fail({ code: 'not_found' });
  await repo.setCategoryArchived(db, id, false);
  return ok(undefined);
}
