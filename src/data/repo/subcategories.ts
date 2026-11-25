// Sub-categories: optional labels inside a category (Food & drink > Alone, Together). SQL in, plain objects out; the rules (name
// length, unique per category) are src/features/categories/subcategories.ts, and the one rule that must always hold, that a
// transaction's sub-category belongs to its own category, is a trigger (migration 12 -> 13).
import type { Db } from '../db/types';

export interface SubcategoryRow {
  id: number;
  category_id: number;
  name: string;
  archived: number; // 0 or 1
  sort_order: number;
}

export async function listSubcategories(db: Db, opts: { categoryId?: number; includeArchived?: boolean } = {}): Promise<SubcategoryRow[]> {
  const where: string[] = [];
  const params: Record<string, number> = {};
  if (opts.categoryId !== undefined) {
    where.push('category_id = $categoryId');
    params.$categoryId = opts.categoryId;
  }
  if (!opts.includeArchived) where.push('archived = 0');
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  return db.getAllAsync<SubcategoryRow>(`select * from subcategories ${clause} order by category_id, sort_order, id`, params);
}

// What the transaction form offers: the active sub-categories of active categories.
export async function listFormSubcategories(db: Db): Promise<SubcategoryRow[]> {
  return db.getAllAsync<SubcategoryRow>(
    `select s.* from subcategories s join categories c on c.id = s.category_id
      where s.archived = 0 and c.archived = 0 order by s.category_id, s.sort_order, s.id`,
  );
}

export async function getSubcategory(db: Db, id: number): Promise<SubcategoryRow | null> {
  return db.getFirstAsync<SubcategoryRow>('select * from subcategories where id = $id', { $id: id });
}

export async function insertSubcategory(db: Db, input: { categoryId: number; name: string }): Promise<number> {
  const next = await db.getFirstAsync<{ n: number }>('select coalesce(max(sort_order), 0) + 1 as n from subcategories where category_id = $categoryId', { $categoryId: input.categoryId });
  const result = await db.runAsync('insert into subcategories (category_id, name, sort_order) values ($categoryId, $name, $sortOrder)', {
    $categoryId: input.categoryId,
    $name: input.name,
    $sortOrder: next?.n ?? 1,
  });
  return result.lastInsertRowId;
}

export async function renameSubcategory(db: Db, id: number, name: string): Promise<void> {
  await db.runAsync('update subcategories set name = $name where id = $id', { $id: id, $name: name });
}

export async function setSubcategoryArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.runAsync('update subcategories set archived = $archived where id = $id', { $id: id, $archived: archived ? 1 : 0 });
}

export async function deleteSubcategory(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from subcategories where id = $id', { $id: id });
}

export async function countSubcategoryUses(db: Db, id: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions where subcategory_id = $id', { $id: id });
  return row?.n ?? 0;
}

// How many transactions carry each sub-category of a category (for the management list).
export async function usesBySubcategory(db: Db, categoryId: number): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ id: number; n: number }>(
    `select s.id as id, count(t.id) as n from subcategories s left join transactions t on t.subcategory_id = s.id
      where s.category_id = $categoryId group by s.id`,
    { $categoryId: categoryId },
  );
  return Object.fromEntries(rows.map(r => [r.id, r.n]));
}
