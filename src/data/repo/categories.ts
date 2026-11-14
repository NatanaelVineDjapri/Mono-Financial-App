import type { Db } from '../db/types';

export type CategoryKind = 'income' | 'expense';

export interface CategoryRow {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  sort_order: number;
  archived: number;
}

export interface NewCategory {
  name: string;
  kind: CategoryKind;
  icon?: string | null;
  sortOrder?: number;
}

export async function createCategory(db: Db, input: NewCategory): Promise<number> {
  const result = await db.runAsync('insert into categories (name, kind, icon, sort_order) values ($name, $kind, $icon, $sortOrder)', {
    $name: input.name,
    $kind: input.kind,
    $icon: input.icon ?? null,
    $sortOrder: input.sortOrder ?? 0,
  });
  return result.lastInsertRowId;
}

export async function archiveCategory(db: Db, id: number): Promise<void> {
  await db.runAsync('update categories set archived = 1 where id = $id', { $id: id });
}

export async function listCategories(db: Db, opts: { kind?: CategoryKind; includeArchived?: boolean } = {}): Promise<CategoryRow[]> {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (opts.kind) { where.push('kind = $kind'); params.$kind = opts.kind; }
  if (!opts.includeArchived) where.push('archived = 0');
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  return db.getAllAsync<CategoryRow>(`select * from categories ${clause} order by sort_order, id`, params);
}

export async function getCategory(db: Db, id: number): Promise<CategoryRow | null> {
  return db.getFirstAsync<CategoryRow>('select * from categories where id = $id', { $id: id });
}

// ---------------------------------------------------------------- Categories screens
// A category is never deleted, only archived (archived = 1) and restored. The rules that must
// always hold are also triggers (migration 7 -> 8); the reads here only feed the screens.

export interface CategoryListRow {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  sort_order: number;
  has_budget: number; // 1 when it has a budget in the month asked for
}

// Active categories of a kind, in list order, with whether each has a budget in `month` ('YYYY-MM').
export async function listActiveWithBudgetFlag(db: Db, kind: CategoryKind, month: string): Promise<CategoryListRow[]> {
  return db.getAllAsync<CategoryListRow>(
    `select c.id, c.name, c.kind, c.icon, c.sort_order,
            exists (select 1 from budgets b where b.category_id = c.id and b.month = $month) as has_budget
     from categories c where c.kind = $kind and c.archived = 0 order by c.sort_order, c.id`,
    { $kind: kind, $month: month },
  );
}

export interface ArchivedCategoryRow {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  transaction_count: number;
  last_used_on: string | null;
}

export async function listArchivedWithUsage(db: Db): Promise<ArchivedCategoryRow[]> {
  return db.getAllAsync<ArchivedCategoryRow>(
    `select c.id, c.name, c.kind, c.icon,
            (select count(*) from transactions t where t.category_id = c.id) as transaction_count,
            (select max(t.occurred_on) from transactions t where t.category_id = c.id) as last_used_on
     from categories c where c.archived = 1 order by c.kind desc, c.sort_order, c.id`,
  );
}

export async function countArchivedCategories(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from categories where archived = 1');
  return row?.n ?? 0;
}

export interface CategoryUsageRow {
  transaction_count: number;
  last_used_on: string | null;
  budget_months_this_month: number; // budgets of this category in the month asked for (0 or 1)
  budget_count: number;
  recurring_count: number; // fixed expenses (active or not) that use it
}

export async function getCategoryUsageRow(db: Db, id: number, month: string): Promise<CategoryUsageRow> {
  const row = await db.getFirstAsync<CategoryUsageRow>(
    `select (select count(*) from transactions where category_id = $id) as transaction_count,
            (select max(occurred_on) from transactions where category_id = $id) as last_used_on,
            (select count(*) from budgets where category_id = $id and month = $month) as budget_months_this_month,
            (select count(*) from budgets where category_id = $id) as budget_count,
            (select count(*) from recurring where category_id = $id) as recurring_count`,
    { $id: id, $month: month },
  );
  return row ?? { transaction_count: 0, last_used_on: null, budget_months_this_month: 0, budget_count: 0, recurring_count: 0 };
}

export async function nextSortOrder(db: Db, kind: CategoryKind): Promise<number> {
  const row = await db.getFirstAsync<{ n: number | null }>('select max(sort_order) as n from categories where kind = $kind', { $kind: kind });
  return (row?.n ?? 0) + 1;
}

export async function countActiveOfKind(db: Db, kind: CategoryKind): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from categories where kind = $kind and archived = 0', { $kind: kind });
  return row?.n ?? 0;
}

export async function updateCategoryRow(db: Db, id: number, fields: { name?: string; icon?: string | null; kind?: CategoryKind }): Promise<void> {
  const sets: string[] = [];
  const params: Record<string, string | number | null> = { $id: id };
  if (fields.name !== undefined) { sets.push('name = $name'); params.$name = fields.name; }
  if (fields.icon !== undefined) { sets.push('icon = $icon'); params.$icon = fields.icon; }
  if (fields.kind !== undefined) { sets.push('kind = $kind'); params.$kind = fields.kind; }
  if (sets.length === 0) return;
  await db.runAsync(`update categories set ${sets.join(', ')} where id = $id`, params);
}

export async function setCategoryArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.runAsync('update categories set archived = $archived where id = $id', { $id: id, $archived: archived ? 1 : 0 });
}

// The name of an active fixed expense that uses the category, if any (the first by id).
export async function findActiveRecurringUsing(db: Db, categoryId: number): Promise<string | null> {
  const row = await db.getFirstAsync<{ name: string }>('select name from recurring where category_id = $id and archived = 0 order by id limit 1', { $id: categoryId });
  return row?.name ?? null;
}
