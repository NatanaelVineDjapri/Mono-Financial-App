// Income, expense and transfer, with friendly pre-checks (balance, date) before SQL —
// the SQL guards stay the real authority; these just give a clean DomainError with real
// numbers instead of round-tripping through a trigger first. An exchange is a transfer
// with a different currency/amount on each side (CLAUDE.md rule 3): addTransfer covers
// both a plain same-currency transfer and an exchange.
import { money, rp, toIdr } from '../core/money';
import * as accountsRepo from '../data/repo/accounts';
import type { Db } from '../data/db/types';
import * as fxRepo from '../data/repo/fx';
import * as repo from '../data/repo/transactions';
import type { TxSource } from '../data/repo/transactions';
import { DomainError, throwDomainError } from './errors';

function today(now: string): string {
  return now.slice(0, 10);
}

function formatAmount(amount: number, currency: string, minorFactor: number): string {
  return currency === 'IDR' ? rp(amount) : money(amount, currency, minorFactor);
}

interface Pocket {
  balance: number;
  minorFactor: number;
}

async function resolvePocket(db: Db, accountId: number, currency: string): Promise<Pocket> {
  const pockets = await accountsRepo.listPocketBalances(db, accountId);
  const pocket = pockets.find(p => p.currency === currency);
  if (!pocket || pocket.archived) {
    throw new DomainError('currency_not_in_account', { currency });
  }
  return { balance: pocket.balance, minorFactor: pocket.minor_factor };
}

async function resolveAmountIdr(db: Db, currency: string, amount: number, minorFactor: number): Promise<number> {
  if (currency === 'IDR') return amount;
  const rate = await fxRepo.getLatestRate(db, currency);
  if (!rate) {
    throw new DomainError('missing_fx_rate', { currency });
  }
  return toIdr(amount, rate.rate_e4, minorFactor);
}

// The SQL guard requires a rate for BOTH sides of a transfer when they are not IDR
// (net worth needs to value every pocket, not just the one amount_idr is based on),
// even though amount_idr itself only ever uses the source side.
async function ensureRateExists(db: Db, currency: string): Promise<void> {
  if (currency === 'IDR') return;
  const rate = await fxRepo.getLatestRate(db, currency);
  if (!rate) {
    throw new DomainError('missing_fx_rate', { currency });
  }
}

async function checkDate(db: Db, accountId: number, currency: string, occurredOn: string, now: string): Promise<void> {
  if (occurredOn > today(now)) {
    throw new DomainError('future_date');
  }
  const pocket = await accountsRepo.getPocket(db, accountId, currency);
  if (pocket && occurredOn < pocket.opening_date) {
    throw new DomainError('before_opening_date');
  }
}

function checkSufficientBalance(available: number, needed: number, currency: string, minorFactor: number): void {
  if (available < needed) {
    const shortfall = needed - available;
    throw new DomainError('insufficient_balance', { shortfallFormatted: formatAmount(shortfall, currency, minorFactor) });
  }
}

export interface AddIncomeOrExpenseInput {
  accountId: number;
  currency: string; // 'IDR' unless the account is forex
  categoryId: number;
  amount: number; // minor units of `currency`
  occurredOn: string;
  description?: string;
  note?: string | null;
  source?: TxSource;
}

export interface AddedTransaction {
  id: number;
  amountIdr: number;
  balanceAfter: number; // the pocket's own balance after this write, in its own minor units
}

export async function addIncome(db: Db, input: AddIncomeOrExpenseInput, now: string): Promise<AddedTransaction> {
  await checkDate(db, input.accountId, input.currency, input.occurredOn, now);
  const pocket = await resolvePocket(db, input.accountId, input.currency);
  const amountIdr = await resolveAmountIdr(db, input.currency, input.amount, pocket.minorFactor);
  try {
    const id = await repo.insertTransaction(
      db,
      {
        kind: 'income',
        accountId: input.accountId,
        currency: input.currency,
        categoryId: input.categoryId,
        amount: input.amount,
        amountIdr,
        occurredOn: input.occurredOn,
        description: input.description,
        note: input.note,
        source: input.source,
      },
      now,
    );
    return { id, amountIdr, balanceAfter: pocket.balance + input.amount };
  } catch (err) {
    throwDomainError(err);
  }
}

export async function addExpense(db: Db, input: AddIncomeOrExpenseInput, now: string): Promise<AddedTransaction> {
  await checkDate(db, input.accountId, input.currency, input.occurredOn, now);
  const pocket = await resolvePocket(db, input.accountId, input.currency);
  checkSufficientBalance(pocket.balance, input.amount, input.currency, pocket.minorFactor);
  const amountIdr = await resolveAmountIdr(db, input.currency, input.amount, pocket.minorFactor);
  try {
    const id = await repo.insertTransaction(
      db,
      {
        kind: 'expense',
        accountId: input.accountId,
        currency: input.currency,
        categoryId: input.categoryId,
        amount: input.amount,
        amountIdr,
        occurredOn: input.occurredOn,
        description: input.description,
        note: input.note,
        source: input.source,
      },
      now,
    );
    return { id, amountIdr, balanceAfter: pocket.balance - input.amount };
  } catch (err) {
    throwDomainError(err);
  }
}

export interface AddTransferInput {
  accountId: number;
  currency: string;
  toAccountId: number;
  toCurrency?: string; // defaults to `currency`: a same-currency transfer
  amount: number;
  amountTo?: number; // defaults to `amount`: a same-currency transfer
  occurredOn: string;
  description?: string;
  note?: string | null;
  source?: TxSource;
}

export interface AddedTransfer {
  id: number;
  amountIdr: number;
  sourceBalanceAfter: number;
  destBalanceAfter: number;
}

// A plain transfer when toCurrency/amountTo are left out; an exchange (cross-currency,
// or between two pockets of the same Valas account) when they differ.
export async function addTransfer(db: Db, input: AddTransferInput, now: string): Promise<AddedTransfer> {
  const toCurrency = input.toCurrency ?? input.currency;
  const amountTo = input.amountTo ?? input.amount;

  await checkDate(db, input.accountId, input.currency, input.occurredOn, now);
  await checkDate(db, input.toAccountId, toCurrency, input.occurredOn, now);

  const source = await resolvePocket(db, input.accountId, input.currency);
  checkSufficientBalance(source.balance, input.amount, input.currency, source.minorFactor);
  const dest = await resolvePocket(db, input.toAccountId, toCurrency);
  await ensureRateExists(db, toCurrency);

  const amountIdr = await resolveAmountIdr(db, input.currency, input.amount, source.minorFactor);

  try {
    const id = await repo.insertTransaction(
      db,
      {
        kind: 'transfer',
        accountId: input.accountId,
        currency: input.currency,
        toAccountId: input.toAccountId,
        toCurrency,
        amount: input.amount,
        amountTo,
        amountIdr,
        occurredOn: input.occurredOn,
        description: input.description,
        note: input.note,
        source: input.source,
      },
      now,
    );
    return {
      id,
      amountIdr,
      sourceBalanceAfter: source.balance - input.amount,
      destBalanceAfter: dest.balance + amountTo,
    };
  } catch (err) {
    throwDomainError(err);
  }
}

// Thin pass-throughs: update/delete don't re-run the add* pre-checks (the patch may not
// touch amount/currency/date at all), but the SQL guards still fire and get mapped.
export async function updateTransaction(db: Db, id: number, patch: Parameters<typeof repo.updateTransaction>[2], now: string): Promise<void> {
  try {
    await repo.updateTransaction(db, id, patch, now);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function deleteTransaction(db: Db, id: number): Promise<void> {
  try {
    await repo.deleteTransaction(db, id);
  } catch (err) {
    throwDomainError(err);
  }
}

// Delete with a way back: removes the record in one statement and returns the row as it was,
// so Undo can put the very same record back (same id).
export async function deleteTransactionWithSnapshot(db: Db, id: number): Promise<repo.TransactionRow | null> {
  const snapshot = await repo.getTransaction(db, id);
  if (!snapshot) return null;
  await deleteTransaction(db, id);
  return snapshot;
}

export async function restoreTransaction(db: Db, snapshot: repo.TransactionRow): Promise<void> {
  try {
    await repo.restoreTransaction(db, snapshot);
  } catch (err) {
    throwDomainError(err);
  }
}
