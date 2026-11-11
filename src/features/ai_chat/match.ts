// Names to ids (CLAUDE.md rule 9): never a guess. An exact name wins; then a unique alias or
// prefix ("bca", "gopay", "cash"); then, for names of five letters or more, a single candidate
// within two typos. Two or more candidates, or none, is "not mentioned" and the person is asked.
import type { FormAccount, FormCategory, TxType } from '../../core/tx/validate';

export type MatchKind = 'exact' | 'alias' | 'fuzzy' | 'ambiguous' | 'none';

export interface Match<T> {
  item: T | null;
  kind: MatchKind;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const MIN_ALIAS_LENGTH = 3;
const MIN_FUZZY_LENGTH = 5;
const MAX_TYPOS = 2;

export function matchName<T extends { name: string }>(input: string | null | undefined, items: readonly T[]): Match<T> {
  const wanted = input ? normalizeName(input) : '';
  if (!wanted) return { item: null, kind: 'none' };

  const named = items.map(item => ({ item, name: normalizeName(item.name) }));

  const exact = named.filter(n => n.name === wanted);
  if (exact.length === 1) return { item: exact[0].item, kind: 'exact' };
  if (exact.length > 1) return { item: null, kind: 'ambiguous' };

  // An alias or prefix needs three letters, so "c" never picks "Cash wallet" by luck.
  if (wanted.length >= MIN_ALIAS_LENGTH) {
    const alias = named.filter(n => n.name.startsWith(wanted) || n.name.split(' ').some(token => token.startsWith(wanted)));
    if (alias.length === 1) return { item: alias[0].item, kind: 'alias' };
    if (alias.length > 1) return { item: null, kind: 'ambiguous' };
  }

  if (wanted.length >= MIN_FUZZY_LENGTH) {
    const near = named.filter(n => {
      const targets = [n.name, ...n.name.split(' ')].filter(t => t.length >= MIN_FUZZY_LENGTH);
      return targets.some(t => levenshtein(wanted, t) <= MAX_TYPOS);
    });
    if (near.length === 1) return { item: near[0].item, kind: 'fuzzy' };
    if (near.length > 1) return { item: null, kind: 'ambiguous' };
  }
  return { item: null, kind: 'none' };
}

// An account, among the rupiah accounts only (a Valas account is not supported by the chat).
export function matchAccount(input: string | null | undefined, accounts: readonly FormAccount[]): Match<FormAccount> {
  return matchName(input, accounts.filter(a => a.type !== 'forex'));
}

// A category must be of the transaction's kind: a name that exists only under the other kind
// counts as not mentioned. A transfer has no category.
export function matchCategory(input: string | null | undefined, type: TxType | null, categories: readonly FormCategory[]): Match<FormCategory> {
  if (type == null || type === 'transfer') return { item: null, kind: 'none' };
  return matchName(input, categories.filter(c => c.kind === type));
}
