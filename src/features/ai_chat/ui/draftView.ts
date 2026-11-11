// What a draft card shows, as plain data (no React), so the numbers and the wording are testable.
// Every figure goes through the hidden-amounts gate (CLAUDE.md rule 12), and a figure's colour
// follows its meaning while its sign follows the arithmetic: an expense is red with "−", an income
// green with "+", a transfer is never coloured.
import { formatShortDate } from '../../../core/date';
import { rp, shown } from '../../../core/money';
import type { TxType } from '../../../core/tx/validate';
import { MonoColors } from '../../../theme/tokens';
import {
  aiDraftA11y,
  aiDraftAccountRow,
  aiDraftAmountSpoken,
  aiDraftBalanceAfterRow,
  aiDraftCategoryRow,
  aiDraftDateRow,
  aiDraftFromRow,
  aiDraftNotSet,
  aiDraftToRow,
  aiDraftUntitled,
} from '../../../i18n';
import type { Draft } from '../draft';

export interface Names {
  accounts: ReadonlyMap<number, string>;
  categories: ReadonlyMap<number, string>;
}

export interface Row {
  key: 'category' | 'account' | 'from' | 'to' | 'date' | 'balance';
  label: string;
  value: string;
}

export function draftKind(draft: Draft): TxType {
  return draft.type ?? 'expense';
}

export function draftTitle(draft: Draft): string {
  return draft.description.trim() || aiDraftUntitled(draftKind(draft));
}

export interface AmountView {
  text: string;
  color: string;
}

// The signed amount of one draft as it is shown: "−Rp25.000", "+Rp8.000.000", "Rp500.000".
export function amountView(kind: TxType, amount: number | null, hidden: boolean): AmountView {
  const value = amount ?? 0;
  if (kind === 'expense') return { text: shown(rp(-value), hidden), color: MonoColors.negative };
  if (kind === 'income') return { text: shown(rp(value, true), hidden), color: MonoColors.positive };
  return { text: shown(rp(value), hidden), color: MonoColors.text };
}

export function draftRows(draft: Draft, names: Names, hidden: boolean): Row[] {
  const kind = draftKind(draft);
  const account = (id: number | null) => (id != null ? names.accounts.get(id) : undefined) ?? aiDraftNotSet();
  const rows: Row[] = [];
  if (kind === 'transfer') {
    rows.push({ key: 'from', label: aiDraftFromRow(), value: account(draft.accountId) });
    rows.push({ key: 'to', label: aiDraftToRow(), value: account(draft.toAccountId) });
  } else {
    rows.push({ key: 'category', label: aiDraftCategoryRow(), value: (draft.categoryId != null ? names.categories.get(draft.categoryId) : undefined) ?? aiDraftNotSet() });
    rows.push({ key: 'account', label: aiDraftAccountRow(), value: account(draft.accountId) });
  }
  rows.push({ key: 'date', label: aiDraftDateRow(), value: formatShortDate(draft.date) });
  if (draft.status.kind === 'ready' && draft.balanceAfter != null && draft.accountId != null) {
    rows.push({ key: 'balance', label: aiDraftBalanceAfterRow(account(draft.accountId)), value: shown(rp(draft.balanceAfter), hidden) });
  }
  return rows;
}

// "Draf pengeluaran, Kopi, minus Rp25.000, Food & drink, GoPay, belum tersimpan"
export function draftSpokenLabel(draft: Draft, names: Names, hidden: boolean, saved: boolean): string {
  const kind = draftKind(draft);
  const details = draftRows(draft, names, hidden)
    .filter(r => r.key !== 'date' && r.key !== 'balance')
    .map(r => r.value);
  const figure = amountView(kind, draft.amount, hidden).text.replace(/^[−+]/, '');
  return aiDraftA11y(kind, draftTitle(draft), aiDraftAmountSpoken(kind, figure), details, saved);
}

export interface BatchSummary {
  count: number;
  total: AmountView; // income minus expense of the ticked drafts; only transfers: the sum moved
  balances: { accountId: number; balanceAfter: number }[]; // each touched account, after the last ticked draft
}

export function batchSummary(drafts: readonly Draft[], selected: ReadonlySet<string>, hidden: boolean): BatchSummary {
  const chosen = drafts.filter(d => selected.has(d.id) && d.status.kind === 'ready');
  let net = 0;
  let moved = 0;
  let hasFlow = false;
  const balances = new Map<number, number>();
  for (const d of chosen) {
    const amount = d.amount ?? 0;
    if (d.type === 'income') {
      net += amount;
      hasFlow = true;
    } else if (d.type === 'expense') {
      net -= amount;
      hasFlow = true;
    } else {
      moved += amount;
    }
    if (d.accountId != null && d.balanceAfter != null) balances.set(d.accountId, d.balanceAfter);
    if (d.toAccountId != null && d.toBalanceAfter != null) balances.set(d.toAccountId, d.toBalanceAfter);
  }
  const total: AmountView = hasFlow
    ? { text: shown(rp(net, true), hidden), color: net < 0 ? MonoColors.negative : net > 0 ? MonoColors.positive : MonoColors.text }
    : { text: shown(rp(moved), hidden), color: MonoColors.text };
  return { count: chosen.length, total, balances: [...balances].map(([accountId, balanceAfter]) => ({ accountId, balanceAfter })) };
}
