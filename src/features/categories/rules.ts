// The category rules that need no database (pure, tested). The same rules are guarded in SQL
// (migration 7 -> 8, the UNIQUE (name, kind) NOCASE constraint and the 1..40 CHECK); these give the
// friendly sentence first.
import type { CategoryKind } from '@/data/repo/categories';

export const CATEGORY_NAME_MAX = 40;

// Why a category change was refused. The sentence for each lives in src/i18n (categoryErrorMessage).
export type CategoryError =
  | { code: 'name_empty' }
  | { code: 'name_too_long' }
  | { code: 'name_taken'; kind: CategoryKind } // another active category of this kind has the name
  | { code: 'name_taken_archived'; kind: CategoryKind } // an archived one does: restore it or use another name
  | { code: 'last_active'; kind: CategoryKind } // the last active category of its kind
  | { code: 'used_by_recurring'; recurringName: string } // an active fixed expense uses it
  | { code: 'kind_locked' } // a transaction, budget or fixed expense uses it
  | { code: 'not_found' };

export interface NameCandidate {
  id: number;
  name: string;
  kind: CategoryKind;
  archived: number;
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: CategoryError };

// Trim, 1 to 40 characters, and unique within the kind ignoring case, archived categories included.
// `selfId` is the category being edited (its own name never counts as a clash).
export function checkCategoryName(raw: string, kind: CategoryKind, existing: readonly NameCandidate[], selfId?: number): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: { code: 'name_empty' } };
  if (name.length > CATEGORY_NAME_MAX) return { ok: false, error: { code: 'name_too_long' } };
  const key = name.toLowerCase();
  const clash = existing.find(c => c.kind === kind && c.id !== selfId && c.name.trim().toLowerCase() === key);
  if (clash) return { ok: false, error: clash.archived ? { code: 'name_taken_archived', kind } : { code: 'name_taken', kind } };
  return { ok: true, name };
}

// Archiving is refused for the last active category of a kind and for one an active fixed expense uses.
export function checkCanArchive(kind: CategoryKind, activeOfKind: number, activeRecurringName: string | null): CategoryError | null {
  if (activeOfKind <= 1) return { code: 'last_active', kind };
  if (activeRecurringName != null) return { code: 'used_by_recurring', recurringName: activeRecurringName };
  return null;
}

// The kind is locked once a transaction, a budget or a fixed expense uses the category.
export function isKindLocked(usage: { transactionCount: number; budgetCount: number; recurringCount: number }): boolean {
  return usage.transactionCount + usage.budgetCount + usage.recurringCount > 0;
}
