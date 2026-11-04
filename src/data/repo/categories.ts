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
