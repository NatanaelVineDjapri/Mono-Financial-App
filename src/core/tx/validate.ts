// The rules of the transaction form (Tx-Add, Tx-Add-Errors, Tx-Add-Transfer, and the edit form),
// as one pure function: values and a little context in, a list of errors out. No UI, no
// database, no strings: each error is a code plus the numbers a sentence needs, and
// src/i18n/id.ts words it. The SQL guards stay the real authority; this runs first so the
// person sees a clean message with the real numbers instead of a trigger's code.
//
// Money is an integer in the minor unit of its currency (whole rupiah; cents for a foreign pocket),
// dates are 'YYYY-MM-DD' (CLAUDE.md rule 1).
//
// Valas: a form may use the Valas account only when the caller sets `allowForex` (the manual form does;
// the AI chat, the receipt scan and the import never do, so they keep refusing a Valas account). A
// Valas account is used through one of its pockets (`currency`), judged by that pocket's balance, and
// needs a rate for that currency: a missing rate blocks the record, it is never counted as 0. A
// transfer between two different currencies is an exchange and carries both amounts.
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

// One pocket of the Valas account, with the balance the form may spend from (without the record being
// edited), as the views give it.
export interface FormPocket {
  accountId: number;
  currency: string;
  minorFactor: number;
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
  // Valas only (left out means rupiah): the pocket the account side uses, the pocket a transfer goes
  // to, and what the destination receives when the two currencies differ (an exchange).
  currency?: string;
  toCurrency?: string;
  amountTo?: number | null;
  date: string;
  description: string;
  note: string;
}

export interface ValidationContext {
  today: string; // 'YYYY-MM-DD', the local date
  accounts: FormAccount[];
  categories: FormCategory[];
  allowForex?: boolean; // the Valas account may be used (through a pocket)
  pockets?: FormPocket[];
  rates?: Readonly<Record<string, number>>; // latest rate_e4 per foreign currency
}

export type TxFieldKey = 'amount' | 'amountTo' | 'category' | 'account' | 'toAccount' | 'date';

export type TxErrorCode =
  | 'amount_required'
  | 'category_required'
  | 'category_kind_mismatch'
  | 'account_required'
  | 'to_account_required'
  | 'forex_not_supported'
  | 'pocket_required' // a Valas account needs one of its currencies chosen
  | 'missing_rate' // that currency has no rate yet
  | 'amount_to_required' // an exchange needs what the other side receives
  | 'same_pocket' // an exchange inside the Valas account needs two different currencies
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
  currency?: string; // the pocket's currency, when it is not rupiah
  minorFactor?: number;
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

  const forexOk = ctx.allowForex === true;
  const pocketOf = (accountId: number, currency: string) => ctx.pockets?.find(p => p.accountId === accountId && p.currency === currency);
  const rates = ctx.rates ?? {};

  const account = values.accountId == null ? undefined : ctx.accounts.find(a => a.id === values.accountId);
  // The currency this side of the record is in: a Valas account's chosen pocket, otherwise rupiah.
  const srcCur = account?.type === 'forex' ? (values.currency ?? '') : 'IDR';
  if (!account) {
    push({ field: 'account', code: 'account_required' });
  } else if (account.type === 'forex') {
    if (!forexOk) push({ field: 'account', code: 'forex_not_supported' });
    else if (!pocketOf(account.id, srcCur)) push({ field: 'account', code: 'pocket_required' });
  }

  let toAccount: FormAccount | undefined;
  let dstCur = 'IDR';
  if (values.type === 'transfer') {
    toAccount = values.toAccountId == null ? undefined : ctx.accounts.find(a => a.id === values.toAccountId);
    dstCur = toAccount?.type === 'forex' ? (values.toCurrency ?? '') : 'IDR';
    if (!toAccount) {
      push({ field: 'toAccount', code: 'to_account_required' });
    } else if (toAccount.type === 'forex') {
      if (!forexOk) push({ field: 'toAccount', code: 'forex_not_supported' });
      else if (!pocketOf(toAccount.id, dstCur)) push({ field: 'toAccount', code: 'pocket_required' });
      else if (account && toAccount.id === account.id && srcCur === dstCur) push({ field: 'toAccount', code: 'same_pocket' });
    } else if (account && toAccount.id === account.id) {
      push({ field: 'toAccount', code: 'same_account' });
    }
  }

  // An exchange (two different currencies) is typed as the bank gave it: both amounts.
  const exchange = values.type === 'transfer' && !!account && !!toAccount && srcCur !== dstCur && srcCur !== '' && dstCur !== '';
  if (exchange) {
    const to = values.amountTo;
    if (to == null || !isValidAmount(to)) push({ field: 'amountTo', code: 'amount_to_required' });
  }

  // A foreign pocket needs a rate: without one nothing can be valued, so the record is blocked.
  if (forexOk && srcCur !== 'IDR' && srcCur !== '' && rates[srcCur] == null) {
    push({ field: 'account', code: 'missing_rate', currency: srcCur, immediate: true }); // not the person's typing: shown at once
  }
  if (forexOk && values.type === 'transfer' && dstCur !== 'IDR' && dstCur !== '' && rates[dstCur] == null) {
    push({ field: 'toAccount', code: 'missing_rate', currency: dstCur, immediate: true });
  }

  // An expense, and a transfer's From side, must not take the pocket below zero: a balance
  // exactly equal to the amount is fine, one minor unit short is not.
  if (amountOk && account && values.type !== 'income') {
    const foreign = account.type === 'forex';
    const pocket = foreign ? pocketOf(account.id, srcCur) : undefined;
    const available = foreign ? pocket?.balance : account.balance;
    if (available != null && available < values.amount) {
      push({
        field: 'account',
        code: 'insufficient_balance',
        accountName: account.name,
        balance: available,
        shortfall: values.amount - available,
        ...(foreign ? { currency: srcCur, minorFactor: pocket?.minorFactor } : {}),
        immediate: true,
      });
    }
  }

  if (values.date > ctx.today) {
    push({ field: 'date', code: 'future_date', today: ctx.today });
  } else {
    const openingOf = (a: FormAccount | undefined, currency: string) => (a?.type === 'forex' ? (pocketOf(a.id, currency)?.openingDate ?? a.openingDate) : a?.openingDate);
    const early = [openingOf(account, srcCur), openingOf(toAccount, dstCur)].some(opening => opening != null && values.date < opening);
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
