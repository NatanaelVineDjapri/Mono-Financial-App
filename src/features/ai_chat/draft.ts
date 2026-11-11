// A draft: one transaction the model proposed, already mapped to ids and checked by the app.
// Nothing here writes anything. A draft's status is always DERIVED by evaluateDrafts (never
// trusted from the model), and only `ready` can be saved (saveDrafts.ts enforces it again).
//
// The checks are the manual form's own (validate.ts), run in order with the balance the
// earlier drafts of the same message would leave behind.
import { validateTx, type TxErrorCode, type TxFormValues, type TxType, type ValidationContext } from '../../core/tx/validate';

export type DraftField = 'type' | 'amount' | 'account' | 'category' | 'to_account';

// The model's number and the typed one disagree: Save stays locked until the person picks.
export interface AmountCheck {
  aiAmount: number;
  typedText: string | null; // as typed in the message, when it can be shown
  choices: number[]; // typed candidate(s) first, the draft's own amount last
}

export type DraftStatus =
  | { kind: 'ready' }
  | { kind: 'needs'; missing: DraftField[] }
  | { kind: 'check_amount'; check: AmountCheck }
  | { kind: 'blocked'; code: TxErrorCode; shortfall: number | null; accountName: string | null };

export interface Draft {
  id: string;
  type: TxType | null;
  amount: number | null;
  amountText: string | null;
  amountCheck: AmountCheck | null;
  description: string;
  categoryId: number | null;
  accountId: number | null;
  toAccountId: number | null;
  date: string; // always resolved: written date, computed relative date, or today
  dateStated: boolean; // false when the person did not say a date (today was assumed)
  note: string;
  unknownTarget: string | null; // a transfer's destination as typed, when it is not one of the accounts
  status: DraftStatus;
  // From the local balances, never from the model. Only for a ready draft.
  balanceAfter: number | null;
  toBalanceAfter: number | null;
}

export function missingFields(d: Draft): DraftField[] {
  const missing: DraftField[] = [];
  if (d.type == null) missing.push('type');
  if (d.amount == null) missing.push('amount');
  if (d.accountId == null) missing.push('account');
  if (d.type != null && d.type !== 'transfer' && d.categoryId == null) missing.push('category');
  if (d.type === 'transfer' && d.toAccountId == null) missing.push('to_account');
  return missing;
}

export function toFormValues(d: Draft): TxFormValues {
  return {
    type: d.type as TxType,
    amount: d.amount as number,
    categoryId: d.type === 'transfer' ? null : d.categoryId,
    accountId: d.accountId,
    toAccountId: d.type === 'transfer' ? d.toAccountId : null,
    date: d.date,
    description: d.description,
    note: d.note,
  };
}

// Recomputes every draft's status and "balance after", in order. A ready draft that is
// selected (all of them, unless `selected` says otherwise) changes the balance the next one
// is judged against, so "parkir" is checked after "makan siang".
export function evaluateDrafts(drafts: readonly Draft[], ctx: ValidationContext, selected?: ReadonlySet<string>): Draft[] {
  const balances = new Map(ctx.accounts.map(a => [a.id, a.balance]));
  return drafts.map(draft => {
    const missing = missingFields(draft);
    if (missing.length > 0) {
      return { ...draft, status: { kind: 'needs', missing }, balanceAfter: null, toBalanceAfter: null };
    }
    if (draft.amountCheck) {
      return { ...draft, status: { kind: 'check_amount', check: draft.amountCheck }, balanceAfter: null, toBalanceAfter: null };
    }

    const accounts = ctx.accounts.map(a => ({ ...a, balance: balances.get(a.id) ?? a.balance }));
    const errors = validateTx(toFormValues(draft), { ...ctx, accounts });
    if (errors.length > 0) {
      const first = errors[0];
      return {
        ...draft,
        status: { kind: 'blocked', code: first.code, shortfall: first.shortfall ?? null, accountName: first.accountName ?? null },
        balanceAfter: null,
        toBalanceAfter: null,
      };
    }

    const amount = draft.amount as number;
    const from = draft.accountId as number;
    const fromBalance = balances.get(from) ?? 0;
    const fromAfter = draft.type === 'income' ? fromBalance + amount : fromBalance - amount;
    let toAfter: number | null = null;
    if (draft.type === 'transfer') toAfter = (balances.get(draft.toAccountId as number) ?? 0) + amount;
    if (!selected || selected.has(draft.id)) {
      balances.set(from, fromAfter);
      if (draft.type === 'transfer') balances.set(draft.toAccountId as number, toAfter as number);
    }
    return { ...draft, status: { kind: 'ready' }, balanceAfter: fromAfter, toBalanceAfter: toAfter };
  });
}

// One tap on a clarification chip: the field is filled LOCALLY (no call to the model) in every
// draft that lacks it. An id that is not a rupiah account, or a category of the wrong kind,
// changes nothing.
export function fillDrafts(drafts: readonly Draft[], field: 'account' | 'category' | 'to_account', id: number, ctx: ValidationContext): Draft[] {
  const account = ctx.accounts.find(a => a.id === id && a.type !== 'forex');
  const category = ctx.categories.find(c => c.id === id);
  const filled = drafts.map(d => {
    if (field === 'account' && account && d.accountId == null) return { ...d, accountId: id };
    if (field === 'to_account' && account && d.type === 'transfer' && d.toAccountId == null) {
      return { ...d, toAccountId: id, unknownTarget: null };
    }
    if (field === 'category' && category && d.type === category.kind && d.categoryId == null) return { ...d, categoryId: id };
    return d;
  });
  return evaluateDrafts(filled, ctx);
}

// The same for one draft; the result is the draft with its status recomputed on its own.
export function fillDraft(draft: Draft, field: 'account' | 'category' | 'to_account', id: number, ctx: ValidationContext): Draft {
  return fillDrafts([draft], field, id, ctx)[0];
}

// The person picked one of the amounts offered by a `check_amount` draft.
export function chooseAmount(drafts: readonly Draft[], draftId: string, amount: number, ctx: ValidationContext): Draft[] {
  const next = drafts.map(d => {
    if (d.id !== draftId || !d.amountCheck || !d.amountCheck.choices.includes(amount)) return d;
    return { ...d, amount, amountCheck: null };
  });
  return evaluateDrafts(next, ctx);
}

// "Mau dicatat sebagai pengeluaran?": a transfer to a name that is not an account becomes an
// expense from the same account; the category is asked next.
export function convertToExpense(drafts: readonly Draft[], draftId: string, ctx: ValidationContext): Draft[] {
  const next = drafts.map(d => {
    if (d.id !== draftId || d.type !== 'transfer') return d;
    return { ...d, type: 'expense' as const, toAccountId: null, unknownTarget: null, categoryId: null };
  });
  return evaluateDrafts(next, ctx);
}
