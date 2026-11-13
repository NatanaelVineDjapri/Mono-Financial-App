// Saving, editing and undoing a transaction from the form. Each write is one exclusive SQLite
// transaction through the domain functions that already pre-check and map the schema's guards;
// nothing here stores a balance, and the numbers the snackbar quotes are read back from the
// views after the commit. Undo of a new record deletes that very row (same id); undo of an
// edit puts the old values back.
//
// The form checks everything first (validate.ts); the schema's guards are a backstop, and a
// code that still gets through is worded by mapDbError. Nothing disables a trigger.
import { DomainError, UnexpectedDbError } from '../../domain/errors';
import { addExpense, addIncome, addTransfer, deleteTransaction, updateTransaction } from '../../domain/transactions';
import type { Db } from '../../data/db/types';
import { getLatestRate } from '../../data/repo/fx';
import { getPocketBalanceNow } from '../../data/repo/transactionDetail';
import { getTransaction, type TransactionRow, type TxSource } from '../../data/repo/transactions';
import { txDbErrorMessage } from '../../i18n';
import { formatShortDate } from '../date';
import { toIdr } from '../money';
import type { TxFormValues, TxType } from './validate';

export type SaveOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

// The database's own error code as a message (DESIGN.md section 14). Unknown codes, and any
// error that is not one of ours, say "Couldn't save. Nothing was changed." and nothing technical.
export function mapDbError(code: string | undefined, ctx: { shortfallFormatted?: string; currency?: string; today?: string } = {}): string {
  return txDbErrorMessage(code, {
    shortfallFormatted: ctx.shortfallFormatted,
    currency: ctx.currency,
    todayFormatted: ctx.today ? formatShortDate(ctx.today) : undefined,
  });
}

// A thrown error as a message (exported for the chat's batch save, which owns its own transaction).
export function failure(error: unknown, today: string): { ok: false; message: string } {
  if (error instanceof DomainError) {
    const ctx = error.context as { shortfallFormatted?: string; currency?: string };
    return { ok: false, message: mapDbError(error.code, { ...ctx, today }) };
  }
  if (error instanceof UnexpectedDbError) return { ok: false, message: mapDbError(undefined) };
  return { ok: false, message: mapDbError(undefined) };
}

export interface SavedTransaction {
  id: number;
  type: TxType;
  accountId: number;
  currency: string; // the pocket the account side used ('IDR' for a rupiah account)
  accountBalanceAfter: number; // read from the view after the commit, in `currency`
  toAccountId: number | null;
  toCurrency: string | null;
  toAccountBalanceAfter: number | null;
}

const IDR = 'IDR';

// The pocket currency a form's values mean: a rupiah account is always IDR, a Valas pocket is the chosen one.
function sideCurrencies(values: TxFormValues): { currency: string; toCurrency: string; amountTo: number } {
  const currency = values.currency ?? IDR;
  const toCurrency = values.type === 'transfer' ? (values.toCurrency ?? IDR) : currency;
  // Same currency: what arrives is what left. Different currencies (an exchange): what was typed.
  const amountTo = currency === toCurrency ? values.amount : (values.amountTo ?? 0);
  return { currency, toCurrency, amountTo };
}

function cleanText(text: string): string {
  return text.trim();
}

// One new row, written inside a transaction the caller owns. Throws the domain's errors
// (nothing is caught here), so a batch can roll back as a whole. `source` says where the record
// came from: the form ('manual'), the chat ('ai') or a scanned receipt ('scan').
export async function writeNewTransaction(txn: Db, values: TxFormValues, now: string, source: TxSource = 'manual'): Promise<number> {
  const accountId = values.accountId as number;
  const { currency, toCurrency, amountTo } = sideCurrencies(values);
  if (values.type === 'transfer') {
    return (
      await addTransfer(
        txn,
        {
          accountId,
          currency,
          toAccountId: values.toAccountId as number,
          toCurrency,
          amountTo,
          amount: values.amount,
          occurredOn: values.date,
          description: cleanText(values.description),
          source,
        },
        now,
      )
    ).id;
  }
  const input = {
    accountId,
    currency,
    categoryId: values.categoryId as number,
    amount: values.amount,
    occurredOn: values.date,
    description: cleanText(values.description),
    note: cleanText(values.note) || null,
    source,
  };
  return (values.type === 'income' ? await addIncome(txn, input, now) : await addExpense(txn, input, now)).id;
}

// A new record. `values` has passed validateTx; `now` is an ISO instant with offset. `source` is where
// it came from: the form (the default), or a scanned receipt ('scan').
export async function saveNewTransaction(db: Db, values: TxFormValues, now: string, source: TxSource = 'manual'): Promise<SaveOutcome<SavedTransaction>> {
  const accountId = values.accountId as number;
  let id = 0;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      id = await writeNewTransaction(txn, values, now, source);
    });
  } catch (error) {
    return failure(error, now.slice(0, 10));
  }

  const toAccountId = values.type === 'transfer' ? values.toAccountId : null;
  const { currency, toCurrency } = sideCurrencies(values);
  const [accountBalanceAfter, toAccountBalanceAfter] = await Promise.all([
    getPocketBalanceNow(db, accountId, currency),
    toAccountId != null ? getPocketBalanceNow(db, toAccountId, toCurrency) : Promise.resolve(null),
  ]);
  return {
    ok: true,
    value: {
      id,
      type: values.type,
      accountId,
      currency,
      accountBalanceAfter: accountBalanceAfter ?? 0,
      toAccountId,
      toCurrency: toAccountId != null ? toCurrency : null,
      toAccountBalanceAfter,
    },
  };
}

// Undo of a new record: that row goes again, and the balances it moved go back.
export async function undoNewTransaction(db: Db, id: number): Promise<SaveOutcome<null>> {
  try {
    await deleteTransaction(db, id);
    return { ok: true, value: null };
  } catch (error) {
    return failure(error, '');
  }
}

type UpdatePatch = Parameters<typeof updateTransaction>[2];

// `amountIdr` is the rupiah value frozen on the record. It is left out (kept) when the record's own
// amount, currency and account did not change, so editing a note never re-values an old record at today's
// rate; when they did change it is frozen again from the latest rate (rupiah is its own value).
function patchFromValues(values: TxFormValues, amountIdr: number | undefined): UpdatePatch {
  const transfer = values.type === 'transfer';
  const { currency, toCurrency, amountTo } = sideCurrencies(values);
  return {
    ...(transfer ? {} : { kind: values.type as 'income' | 'expense' }),
    accountId: values.accountId as number,
    currency,
    toAccountId: transfer ? (values.toAccountId as number) : null,
    toCurrency: transfer ? toCurrency : null,
    categoryId: transfer ? null : (values.categoryId as number),
    amount: values.amount,
    amountTo: transfer ? amountTo : null,
    ...(amountIdr === undefined ? {} : { amountIdr }),
    occurredOn: values.date,
    description: cleanText(values.description),
    note: transfer ? null : cleanText(values.note) || null,
  };
}

// The same row, changed. The record's id, its created_at and its source stay as they were.
export async function saveTransactionChanges(db: Db, id: number, values: TxFormValues, now: string): Promise<SaveOutcome<null>> {
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const { currency } = sideCurrencies(values);
      let amountIdr: number | undefined = values.amount; // rupiah
      if (currency !== IDR) {
        const before = await getTransaction(txn, id);
        const unchanged = before != null && before.currency === currency && before.amount === values.amount && before.account_id === values.accountId;
        if (unchanged) amountIdr = undefined;
        else {
          const rate = await getLatestRate(txn, currency);
          if (!rate) throw new DomainError('missing_fx_rate', { currency });
          const factor = await txn.getFirstAsync<{ minor_factor: number }>('select minor_factor from currencies where code = $code', { $code: currency });
          amountIdr = toIdr(values.amount, rate.rate_e4, factor?.minor_factor ?? 100);
        }
      }
      await updateTransaction(txn, id, patchFromValues(values, amountIdr), now);
    });
    return { ok: true, value: null };
  } catch (error) {
    return failure(error, now.slice(0, 10));
  }
}

// Undo of an edit: the values the row had before, written back.
export async function undoTransactionChanges(db: Db, before: TransactionRow, now: string): Promise<SaveOutcome<null>> {
  const patch: UpdatePatch = {
    ...(before.kind === 'transfer' ? {} : { kind: before.kind }),
    accountId: before.account_id,
    currency: before.currency,
    toAccountId: before.to_account_id,
    toCurrency: before.to_currency,
    categoryId: before.category_id,
    amount: before.amount,
    amountTo: before.amount_to,
    amountIdr: before.amount_idr,
    occurredOn: before.occurred_on,
    description: before.description,
    note: before.note,
  };
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      await updateTransaction(txn, before.id, patch, now);
    });
    return { ok: true, value: null };
  } catch (error) {
    return failure(error, now.slice(0, 10));
  }
}
