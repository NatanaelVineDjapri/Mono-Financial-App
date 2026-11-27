// Deleting a category for good (CLAUDE.md rule 21, changed by the owner): only an archived one. What was recorded under it
// moves to another active category of the same kind first, so no money changes; its budgets and sub-categories go with it.
import * as repo from '@/data/repo/categories';
import type { Db } from '@/data/db/types';

export type CategoryRemovalError = 'not_found' | 'not_archived' | 'needs_replacement' | 'bad_replacement' | 'failed';
export type CategoryRemovalResult = { ok: true } | { ok: false; error: CategoryRemovalError };

export interface CategoryRemoval {
  links: repo.CategoryLinks;
  needsReplacement: boolean; // records or fixed expenses must move before it can go
  replacements: { id: number; name: string }[];
}

export async function getCategoryRemoval(db: Db, id: number): Promise<CategoryRemoval | null> {
  const links = await repo.getCategoryLinks(db, id);
  if (!links) return null;
  const active = await db.getAllAsync<{ id: number; name: string }>(
    'select id, name from categories where kind = $kind and archived = 0 and id <> $id order by sort_order, id',
    { $kind: links.kind, $id: id },
  );
  return { links, needsReplacement: links.records > 0 || links.fixedExpenses > 0, replacements: active };
}

export async function deleteArchivedCategory(db: Db, id: number, replacementId: number | null, now: string): Promise<CategoryRemovalResult> {
  const refuse = (error: CategoryRemovalError): CategoryRemovalResult => ({ ok: false, error });
  const removal = await getCategoryRemoval(db, id);
  if (!removal) return refuse('not_found');
  if (removal.links.archived !== 1) return refuse('not_archived');
  if (replacementId == null && removal.needsReplacement) return refuse('needs_replacement');
  if (replacementId != null && !removal.replacements.some(c => c.id === replacementId)) return refuse('bad_replacement');
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      if (replacementId != null) await repo.moveCategory(txn, id, replacementId, now);
      await repo.deleteCategoryRow(txn, id);
      if ((await txn.getAllAsync('PRAGMA foreign_key_check')).length > 0) throw new Error('CATEGORY_DELETE_INTEGRITY_CHECK_FAILED');
    });
  } catch {
    return refuse('failed');
  }
  return { ok: true };
}
