// Utang-piutang (asked for by the owner): money lent or borrowed, paid back in parts. Balances move, but nothing is
// income or expense: each movement is a transfer to or from the debt's own hidden account (migration 13 -> 14), so net
// worth counts what is owed to you and subtracts what you owe.
import * as repo from '../data/repo/debts';
import { listAccountsForForm, type AccountFormRow } from '../data/repo/accounts';
import { insertTransaction } from '../data/repo/transactions';
import type { DebtDirection, DebtMove, DebtRow } from '../data/repo/debts';
import type { Db } from '../data/db/types';

export type { DebtDirection, DebtMove, DebtRow };

export type DebtError =
  | 'person_required'
  | 'amount_required'
  | 'account_required'
  | 'future_date'
  | 'before_opening_date'
  | 'insufficient_balance'
  | 'more_than_owed'
  | 'due_before_start'
  | 'not_found'
  | 'failed';
export type DebtResult<T = null> = { ok: true; value: T } | { ok: false; error: DebtError };

const refuse = (error: DebtError): { ok: false; error: DebtError } => ({ ok: false, error });

export const listDebts = (db: Db): Promise<DebtRow[]> => repo.listDebtRows(db);
export const getDebt = (db: Db, accountId: number): Promise<DebtRow | null> => repo.getDebtRow(db, accountId);
export const listDebtMoves = (db: Db, accountId: number): Promise<DebtMove[]> => repo.listDebtMoves(db, accountId);

// What is still owed to you and by you.
export function debtTotals(debts: readonly DebtRow[]): { owedToMe: number; iOwe: number } {
  const sum = (direction: DebtDirection) => debts.filter(d => d.direction === direction).reduce((total, d) => total + d.remaining, 0);
  return { owedToMe: sum('lent'), iOwe: sum('borrowed') };
}

// The rupiah accounts money can leave or enter.
export async function listDebtAccounts(db: Db): Promise<AccountFormRow[]> {
  return (await listAccountsForForm(db)).filter(a => a.type !== 'forex');
}

interface Movement {
  amount: number;
  accountId: number | null;
  date: string;
}

// The checks a loan and a payment share. `leaves` is true when the money goes out of the real account.
async function checkMovement(db: Db, move: Movement, leaves: boolean, today: string): Promise<DebtError | null> {
  if (!Number.isSafeInteger(move.amount) || move.amount <= 0) return 'amount_required';
  const account = (await listDebtAccounts(db)).find(a => a.id === move.accountId);
  if (!account) return 'account_required';
  if (move.date > today) return 'future_date';
  if (move.date < account.opening_date) return 'before_opening_date';
  if (leaves && account.balance < move.amount) return 'insufficient_balance';
  return null;
}

// One IDR transfer row, `from` one account `to` the other.
const moveMoney = (db: Db, from: number, to: number, amount: number, date: string, description: string, now: string) =>
  insertTransaction(
    db,
    { kind: 'transfer', accountId: from, currency: 'IDR', toAccountId: to, toCurrency: 'IDR', amount, amountTo: amount, amountIdr: amount, occurredOn: date, description, source: 'manual' },
    now,
  );

export interface NewDebt extends Movement {
  direction: DebtDirection;
  person: string;
  dueOn: string | null;
  note: string;
  accountName: string; // the hidden account's name as the person's language puts it ("Loan to Budi")
  description: string; // of the transfer in the transaction list
}

export async function createDebt(db: Db, input: NewDebt, today: string, now: string): Promise<DebtResult<number>> {
  const person = input.person.trim();
  if (!person || person.length > 30) return refuse('person_required');
  const problem = await checkMovement(db, input, input.direction === 'lent', today);
  if (problem) return refuse(problem);
  if (input.dueOn && input.dueOn < input.date) return refuse('due_before_start');

  const base = input.accountName.slice(0, 36);
  let name = base;
  for (let n = 2; await repo.accountNameExists(db, name); n++) name = `${base} ${n}`.slice(0, 40);

  let id = 0;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      id = await repo.insertDebtAccount(txn, name, input.date, now);
      await repo.insertDebt(txn, { accountId: id, direction: input.direction, person, dueOn: input.dueOn, note: input.note.trim() || null, createdAt: now });
      const real = input.accountId as number;
      if (input.direction === 'lent') await moveMoney(txn, real, id, input.amount, input.date, input.description, now);
      else await moveMoney(txn, id, real, input.amount, input.date, input.description, now);
    });
  } catch {
    return refuse('failed');
  }
  return { ok: true, value: id };
}

export async function payDebt(db: Db, debtId: number, payment: Movement & { description: string }, today: string, now: string): Promise<DebtResult> {
  const debt = await repo.getDebtRow(db, debtId);
  if (!debt) return refuse('not_found');
  // paying back what I owe takes money out of a real account; being paid puts it in
  const problem = await checkMovement(db, payment, debt.direction === 'borrowed', today);
  if (problem) return refuse(problem);
  if (payment.date < debt.started_on) return refuse('before_opening_date');
  if (payment.amount > debt.remaining) return refuse('more_than_owed');
  const real = payment.accountId as number;
  try {
    if (debt.direction === 'lent') await moveMoney(db, debtId, real, payment.amount, payment.date, payment.description, now);
    else await moveMoney(db, real, debtId, payment.amount, payment.date, payment.description, now);
  } catch {
    return refuse('failed');
  }
  return { ok: true, value: null };
}

// Removes a debt as if it had never been recorded: its transfers go, so the real accounts' balances return. Refused
// (nothing changed) when that would leave one of them below zero.
export async function deleteDebt(db: Db, accountId: number): Promise<DebtResult> {
  if (!(await repo.getDebtRow(db, accountId))) return refuse('not_found');
  let short = false;
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const before = (await txn.getAllAsync('select * from v_integrity_issues')).length;
      await txn.runAsync("update meta set value = '1' where key = 'guards_off'");
      await repo.deleteDebtRows(txn, accountId);
      await txn.runAsync("update meta set value = '0' where key = 'guards_off'");
      const broken = await txn.getAllAsync('PRAGMA foreign_key_check');
      short = (await txn.getAllAsync('select * from v_integrity_issues')).length > before;
      if (short || broken.length > 0) throw new Error('DEBT_DELETE_INTEGRITY_CHECK_FAILED');
    });
  } catch {
    return refuse(short ? 'insufficient_balance' : 'failed');
  }
  return { ok: true, value: null };
}
