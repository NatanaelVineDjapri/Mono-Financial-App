// "Fill the category from the description": what this person filed the same words under before, or the sub-category or
// category the words name. Pure, from the person's own records; no AI, nothing stored. Never guesses between two.
import type { FormCategory, FormSubcategory } from './validate';

// How often one description was filed one way (read from the transactions by getTxFormData).
export interface DescriptionUse {
  description: string;
  kind: 'income' | 'expense';
  categoryId: number;
  subcategoryId: number | null;
  uses: number;
  lastOn: string; // YYYY-MM-DD
}

export interface CategorySuggestion {
  categoryId: number;
  subcategoryId: number | null;
}

export interface SuggestSource {
  categories: readonly FormCategory[]; // the ones a new record may use
  subcategories?: readonly FormSubcategory[];
  history?: readonly DescriptionUse[];
}

const normal = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

const saysWord = (text: string, name: string) =>
  new RegExp(`(^|[^a-z0-9])${normal(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);

export function suggestFromDescription(description: string, kind: 'income' | 'expense', source: SuggestSource): CategorySuggestion | null {
  const text = normal(description);
  if (text.length < 2) return null;
  const categories = source.categories.filter(c => c.kind === kind);
  const ids = new Set(categories.map(c => c.id));
  const subs = (source.subcategories ?? []).filter(s => ids.has(s.categoryId));

  // 1. The same words before: the way used most, and of equals the latest.
  const ways = new Map<string, { categoryId: number; subcategoryId: number | null; uses: number; lastOn: string }>();
  for (const use of source.history ?? []) {
    if (use.kind !== kind || !ids.has(use.categoryId) || normal(use.description) !== text) continue;
    const subcategoryId = subs.some(s => s.id === use.subcategoryId && s.categoryId === use.categoryId) ? use.subcategoryId : null;
    const key = `${use.categoryId}:${subcategoryId}`;
    const way = ways.get(key) ?? { categoryId: use.categoryId, subcategoryId, uses: 0, lastOn: '' };
    way.uses += use.uses;
    if (use.lastOn > way.lastOn) way.lastOn = use.lastOn;
    ways.set(key, way);
  }
  const best = [...ways.values()].sort((a, b) => b.uses - a.uses || b.lastOn.localeCompare(a.lastOn))[0];
  if (best) return { categoryId: best.categoryId, subcategoryId: best.subcategoryId };

  // 2. The words name one sub-category, or failing that one category.
  const named = subs.filter(s => saysWord(text, s.name));
  if (named.length === 1) return { categoryId: named[0].categoryId, subcategoryId: named[0].id };
  if (named.length > 1) return null;
  const category = categories.filter(c => saysWord(text, c.name));
  return category.length === 1 ? { categoryId: category[0].id, subcategoryId: null } : null;
}
