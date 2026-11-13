// Fixed expenses are templates (CLAUDE.md rule 10): nothing changes until the user
// confirms a due date. Confirming writes one expense row (source='recurring') and one
// recurring_events row ('recorded') in a single exclusive transaction; skipping writes
// only the event row ('skipped'). Due dates are always read from v_recurring_due, never
// stored. IDR only — a forex account is rejected at template creation already
// (recurring_needs_idr_account), so confirmRecurring does not need to re-check that.
import * as accountsRepo from '../data/repo/accounts';
import type { Db } from '../data/db/types';
import * as repo from '../data/repo/recurring';
import type { NewRecurring, RecurringDueRow } from '../data/repo/recurring';
import { addExpense } from './transactions';
import { DomainError, throwDomainError } from './errors';

export async function createRecurring(db: Db, input: NewRecurring, now: string): Promise<number> {
  try {
    return await repo.createRecurring(db, input, now);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function updateRecurring(db: Db, id: number, patch: Parameters<typeof repo.updateRecurring>[2]): Promise<void> {
  try {
    await repo.updateRecurring(db, id, patch);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function archiveRecurring(db: Db, id: number): Promise<void> {
  try {
    await repo.archiveRecurring(db, id);
  } catch (err) {
    throwDomainError(err);
  }
}

export function listRecurringDue(db: Db): Promise<RecurringDueRow[]> {
  return repo.listRecurringDue(db);
}

// Single source for every due-count surface: today plus undecided overdue months.
export const listDue = listRecurringDue;

export { listRecurring, monthlyRecurringEstimate } from '../data/repo/recurring';

export interface RecurringSchedule {
  dayOfMonth: number;
  firstDueOn: string;
  endOn?: string | null;
}

// Mirrors v_recurring_due's calendar clamp. `decidedDueOns` keeps this pure and lets callers
// ask for the first undecided occurrence without duplicating date arithmetic in UI code.
export function nextDue(template: RecurringSchedule, today: string, decidedDueOns: readonly string[] = []): string | null {
  const decided = new Set(decidedDueOns);
  const start = template.firstDueOn.slice(0, 7);
  const end = template.endOn;
  for (let month = start; ; ) {
    const [year, mon] = month.split('-').map(Number);
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const due = `${month}-${String(Math.min(template.dayOfMonth, last)).padStart(2, '0')}`;
    if (end && due > end) return null;
    if (due >= template.firstDueOn && due >= today && !decided.has(due)) return due;
    const nextMon = mon === 12 ? 1 : mon + 1;
    month = `${mon === 12 ? year + 1 : year}-${String(nextMon).padStart(2, '0')}`;
  }
}

export interface ConfirmRecurringInput {
  recurringId: number;
  dueOn: string;
  accountId: number;
  categoryId: number;
  amount: number; // the real amount; may differ from the template's estimate (amount_varies)
  date?: string;
  description?: string;
}

export interface ConfirmedRecurring {
  transactionId: number;
  balanceAfter: number;
}

export async function confirmRecurring(db: Db, input: ConfirmRecurringInput, now: string): Promise<ConfirmedRecurring> {
  const result: ConfirmedRecurring = { transactionId: 0, balanceAfter: 0 };
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const account = await accountsRepo.getAccount(txn, input.accountId);
      if (!account || account.type === 'forex') throw new DomainError('recurring_needs_idr_account');
      const saved = await addExpense(txn, {
        accountId: input.accountId, currency: 'IDR', categoryId: input.categoryId, amount: input.amount,
        occurredOn: input.date ?? input.dueOn, description: input.description, source: 'recurring',
      }, now);
      result.transactionId = saved.id;
      result.balanceAfter = saved.balanceAfter;

      await repo.recordRecurringEvent(txn, input.recurringId, input.dueOn, 'recorded', result.transactionId, now);
    });
  } catch (err) {
    throwDomainError(err);
  }
  return result;
}

// Records nothing financial — just marks this due date decided, so it stops showing as
// due. The next month's due date is unaffected.
export async function skipRecurring(db: Db, recurringId: number, dueOn: string, now: string): Promise<void> {
  try {
    await repo.recordRecurringEvent(db, recurringId, dueOn, 'skipped', null, now);
  } catch (err) {
    throwDomainError(err);
  }
}
