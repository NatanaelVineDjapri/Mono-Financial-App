// The sub-category rules and actions. A sub-category is an OPTIONAL label inside a category the person defines (Food & drink >
// Alone, Together); a transaction carries one or none. Like categories (CLAUDE.md rule 21) one that a transaction uses is archived,
// never deleted; one nothing uses may be deleted. Names are 1 to 30 characters and unique inside their category without regard to
// case, archived ones included. The rule that a transaction's sub-category belongs to its own category is a trigger in the schema
// (subcategory_category_mismatch, migration 12 -> 13); the checks here give the friendly sentence first.
import type { Db } from '@/data/db/types';
import { getCategory } from '@/data/repo/categories';
import * as repo from '@/data/repo/subcategories';
import type { SubcategoryRow } from '@/data/repo/subcategories';

export const SUBCATEGORY_NAME_MAX = 30;

export type SubcategoryError =
  | { code: 'name_empty' }
  | { code: 'name_too_long' }
  | { code: 'name_taken' } // another active sub-category of this category has the name
  | { code: 'name_taken_archived' } // an archived one does: restore it or use another name
  | { code: 'in_use'; count: number } // a transaction uses it: it can only be archived
  | { code: 'not_found' };

export type SubcategoryResult<T = void> = { ok: true; value: T } | { ok: false; error: SubcategoryError };

const ok = <T>(value: T): SubcategoryResult<T> => ({ ok: true, value });
const fail = (error: SubcategoryError): SubcategoryResult<never> => ({ ok: false, error });

export type NameCheck = { ok: true; name: string } | { ok: false; error: SubcategoryError };

// `existing` are the sub-categories of the SAME category (archived included); `selfId` is the one being renamed.
export function checkSubcategoryName(raw: string, existing: readonly Pick<SubcategoryRow, 'id' | 'name' | 'archived'>[], selfId?: number): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: { code: 'name_empty' } };
  if (name.length > SUBCATEGORY_NAME_MAX) return { ok: false, error: { code: 'name_too_long' } };
  const key = name.toLowerCase();
  const clash = existing.find(s => s.id !== selfId && s.name.trim().toLowerCase() === key);
  if (clash) return { ok: false, error: clash.archived ? { code: 'name_taken_archived' } : { code: 'name_taken' } };
  return { ok: true, name };
}

export interface SubcategoryListItem extends SubcategoryRow {
  uses: number; // transactions that carry it
}

// The sub-categories of one category for the management list: active first, then archived, each with how often it is used.
export async function listForCategory(db: Db, categoryId: number): Promise<SubcategoryListItem[]> {
  const [rows, uses] = await Promise.all([repo.listSubcategories(db, { categoryId, includeArchived: true }), repo.usesBySubcategory(db, categoryId)]);
  return rows.map(r => ({ ...r, uses: uses[r.id] ?? 0 })).sort((a, b) => a.archived - b.archived || a.sort_order - b.sort_order || a.id - b.id);
}

export async function createSubcategory(db: Db, categoryId: number, rawName: string): Promise<SubcategoryResult<number>> {
  if (!(await getCategory(db, categoryId))) return fail({ code: 'not_found' });
  const existing = await repo.listSubcategories(db, { categoryId, includeArchived: true });
  const checked = checkSubcategoryName(rawName, existing);
  if (!checked.ok) return checked;
  try {
    return ok(await repo.insertSubcategory(db, { categoryId, name: checked.name }));
  } catch {
    // Raced with another write: the unique index has the last word.
    return fail({ code: 'name_taken' });
  }
}

export async function renameSubcategory(db: Db, id: number, rawName: string): Promise<SubcategoryResult> {
  const sub = await repo.getSubcategory(db, id);
  if (!sub) return fail({ code: 'not_found' });
  const existing = await repo.listSubcategories(db, { categoryId: sub.category_id, includeArchived: true });
  const checked = checkSubcategoryName(rawName, existing, id);
  if (!checked.ok) return checked;
  try {
    await repo.renameSubcategory(db, id, checked.name);
    return ok(undefined);
  } catch {
    return fail({ code: 'name_taken' });
  }
}

export async function archiveSubcategory(db: Db, id: number): Promise<SubcategoryResult> {
  if (!(await repo.getSubcategory(db, id))) return fail({ code: 'not_found' });
  await repo.setSubcategoryArchived(db, id, true);
  return ok(undefined);
}

export async function restoreSubcategory(db: Db, id: number): Promise<SubcategoryResult> {
  if (!(await repo.getSubcategory(db, id))) return fail({ code: 'not_found' });
  await repo.setSubcategoryArchived(db, id, false);
  return ok(undefined);
}

// Only one nothing uses: a used one is archived instead (its transactions keep their label).
export async function deleteSubcategory(db: Db, id: number): Promise<SubcategoryResult> {
  if (!(await repo.getSubcategory(db, id))) return fail({ code: 'not_found' });
  const count = await repo.countSubcategoryUses(db, id);
  if (count > 0) return fail({ code: 'in_use', count });
  await repo.deleteSubcategory(db, id);
  return ok(undefined);
}
