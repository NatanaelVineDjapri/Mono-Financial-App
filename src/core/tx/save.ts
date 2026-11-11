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
import { getPocketBalanceNow } from '../../data/repo/transactionDetail';
import type { TransactionRow, TxSource } from '../../data/repo/transactions';
import { txDbErrorMessage } from '../../i18n/id';
import { formatShortDate } from '../date';
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
  accountBalanceAfter: number; // read from the view after the commit
  toAccountId: number | null;
  toAccountBalanceAfter: number | null;
}

const IDR = 'IDR';

function cleanText(text: string): string {
  return text.trim();
}

// One new row, written inside a transaction the caller owns. Throws the domain's errors
// (nothing is caught here), so a batch can roll back as a whole. `source` says where the record
// came from: the form ('manual') or the chat ('ai').
export async function writeNewTransaction(txn: Db, values: TxFormValues, now: string, source: TxSource = 'manual'): Promise<number> {
  const accountId = values.accountId as number;
  if (values.type === 'transfer') {
    return (
      await addTransfer(
        txn,
        {
          accountId,
          currency: IDR,
          toAccountId: values.toAccountId as number,
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
    currency: IDR,
    categoryId: values.categoryId as number,
    amount: values.amount,
    occurredOn: values.date,
    description: cleanText(values.description),
    note: cleanText(values.note) || null,
    source,
  };
  return (values.type === 'income' ? await addIncome(txn, input, now) : await addExpense(txn, input, now)).id;
}

// A new record. `values` has passed validateTx; `now` is an ISO instant with offset.
export async function saveNewTransaction(db: Db, values: TxFormValues, now: string): Promise<SaveOutcome<SavedTransaction>> {
  const accountId = values.accountId as number;
  let id = 0;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      id = await writeNewTransaction(txn, values, now);
    });
  } catch (error) {
    return failure(error, now.slice(0, 10));
  }

  const toAccountId = values.type === 'transfer' ? values.toAccountId : null;
  const [accountBalanceAfter, toAccountBalanceAfter] = await Promise.all([
    getPocketBalanceNow(db, accountId, IDR),
    toAccountId != null ? getPocketBalanceNow(db, toAccountId, IDR) : Promise.resolve(null),
  ]);
  return {
    ok: true,
    value: { id, type: values.type, accountId, accountBalanceAfter: accountBalanceAfter ?? 0, toAccountId, toAccountBalanceAfter },
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

function patchFromValues(values: TxFormValues): UpdatePatch {
  const transfer = values.type === 'transfer';
  return {
    ...(transfer ? {} : { kind: values.type as 'income' | 'expense' }),
    accountId: values.accountId as number,
    currency: IDR,
    toAccountId: transfer ? (values.toAccountId as number) : null,
    toCurrency: transfer ? IDR : null,
    categoryId: transfer ? null : (values.categoryId as number),
    amount: values.amount,
    amountTo: transfer ? values.amount : null,
    amountIdr: values.amount,
    occurredOn: values.date,
    description: cleanText(values.description),
    note: transfer ? null : cleanText(values.note) || null,
  };
}

// The same row, changed. The record's id, its created_at and its source stay as they were.
export async function saveTransactionChanges(db: Db, id: number, values: TxFormValues, now: string): Promise<SaveOutcome<null>> {
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      await updateTransaction(txn, id, patchFromValues(values), now);
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
