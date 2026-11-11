// The rules of the transaction form (Tx-Add, Tx-Add-Errors, Tx-Add-Transfer, and the edit form),
// as one pure function: values and a little context in, a list of errors out. No UI, no
// database, no strings: each error is a code plus the numbers a sentence needs, and
// src/i18n/id.ts words it. The SQL guards stay the real authority; this runs first so the
// person sees a clean message with the real numbers instead of a trigger's code.
//
// Money is a whole-rupiah integer, dates are 'YYYY-MM-DD' (CLAUDE.md rule 1).
import type { AccountType } from '../../data/repo/accounts';

export type TxType = 'income' | 'expense' | 'transfer';

export const MAX_AMOUNT_DIGITS = 12;
export const MAX_AMOUNT = 10 ** MAX_AMOUNT_DIGITS - 1;

export interface FormAccount {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  // The balance the form may spend from. When editing, it is the balance WITHOUT the record
  // being edited (so changing a record's amount is judged against what the account had before it).
  balance: number;
  openingDate: string;
}

export interface FormCategory {
  id: number;
  name: string;
  kind: 'income' | 'expense';
}

export interface TxFormValues {
  type: TxType;
  amount: number;
  categoryId: number | null;
  accountId: number | null; // the account (income, expense) or the From account (transfer)
  toAccountId: number | null; // transfer only
  date: string;
  description: string;
  note: string;
}

export interface ValidationContext {
  today: string; // 'YYYY-MM-DD', the local date
  accounts: FormAccount[];
  categories: FormCategory[];
}

export type TxFieldKey = 'amount' | 'category' | 'account' | 'toAccount' | 'date';

export type TxErrorCode =
  | 'amount_required'
  | 'category_required'
  | 'category_kind_mismatch'
  | 'account_required'
  | 'to_account_required'
  | 'forex_not_supported'
  | 'same_account'
  | 'insufficient_balance'
  | 'future_date'
  | 'before_opening_date';

export interface TxFieldError {
  field: TxFieldKey;
  code: TxErrorCode;
  // The numbers and names a sentence needs.
  accountName?: string;
  balance?: number;
  shortfall?: number;
  today?: string;
  // True for the errors that show at once, without waiting for the field to be touched or
  // Save to be tapped: a short balance appears as soon as the amount makes it so.
  immediate: boolean;
}

function isValidAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT;
}

export function validateTx(values: TxFormValues, ctx: ValidationContext): TxFieldError[] {
  const errors: TxFieldError[] = [];
  const push = (error: Omit<TxFieldError, 'immediate'> & { immediate?: boolean }) => errors.push({ immediate: false, ...error });

  const amountOk = isValidAmount(values.amount);
  if (!amountOk) push({ field: 'amount', code: 'amount_required' });

  if (values.type !== 'transfer') {
    if (values.categoryId == null) {
      push({ field: 'category', code: 'category_required' });
    } else {
      const category = ctx.categories.find(c => c.id === values.categoryId);
      if (!category) push({ field: 'category', code: 'category_required' });
      else if (category.kind !== values.type) push({ field: 'category', code: 'category_kind_mismatch' });
    }
  }

  const account = values.accountId == null ? undefined : ctx.accounts.find(a => a.id === values.accountId);
  if (!account) {
    push({ field: 'account', code: 'account_required' });
  } else if (account.type === 'forex') {
    push({ field: 'account', code: 'forex_not_supported' });
  }

  let toAccount: FormAccount | undefined;
  if (values.type === 'transfer') {
    toAccount = values.toAccountId == null ? undefined : ctx.accounts.find(a => a.id === values.toAccountId);
    if (!toAccount) {
      push({ field: 'toAccount', code: 'to_account_required' });
    } else if (toAccount.type === 'forex') {
      push({ field: 'toAccount', code: 'forex_not_supported' });
    } else if (account && toAccount.id === account.id) {
      push({ field: 'toAccount', code: 'same_account' });
    }
  }

  // An expense, and a transfer's From side, must not take the account below zero: a balance
  // exactly equal to the amount is fine, one rupiah short is not.
  if (amountOk && account && account.type !== 'forex' && values.type !== 'income' && account.balance < values.amount) {
    push({
      field: 'account',
      code: 'insufficient_balance',
      accountName: account.name,
      balance: account.balance,
      shortfall: values.amount - account.balance,
      immediate: true,
    });
  }

  if (values.date > ctx.today) {
    push({ field: 'date', code: 'future_date', today: ctx.today });
  } else {
    const early = [account, toAccount].some(a => a && values.date < a.openingDate);
    if (early) push({ field: 'date', code: 'before_opening_date' });
  }

  return errors;
}

// The error to show on a field, if any (the first one: fields can carry more than one rule).
export function errorFor(errors: TxFieldError[], field: TxFieldKey): TxFieldError | undefined {
  return errors.find(e => e.field === field);
}

// What the form shows right now: an error appears once its field was touched or Save was
// tapped, and an `immediate` one (short balance) appears at once. A fresh form shows none.
export function visibleErrors(errors: TxFieldError[], touched: ReadonlySet<TxFieldKey>, submitted: boolean): TxFieldError[] {
  return errors.filter(e => e.immediate || submitted || touched.has(e.field));
}

// "Balance after" for an account, live: the balance without the record being edited, plus or
// minus the amount. Reads nothing and writes nothing.
export function balanceAfter(account: FormAccount | undefined, amount: number, direction: 'in' | 'out'): number | null {
  if (!account) return null;
  const safe = Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
  return direction === 'in' ? account.balance + safe : account.balance - safe;
}
