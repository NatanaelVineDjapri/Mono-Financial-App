// Small reads for the Analysis score that no other repo has. Read-only: the score is derived from the views and
// these counts; nothing is written and no table is added.
import type { Db } from '../db/types';

// The first day a transaction was recorded (transfers included: they are records too).
export async function getEarliestTransactionDate(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ d: string | null }>('select min(occurred_on) as d from transactions');
  return row?.d ?? null;
}

// How many transactions were recorded on or before `date` (the end of the period being scored).
export async function countTransactionsUpTo(db: Db, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions where occurred_on <= $date', { $date: date });
  return row?.n ?? 0;
}

// Accounts in use on `date`: opened by then and not archived.
export async function countAccountsOn(db: Db, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts where archived = 0 and opening_date <= $date', { $date: date });
  return row?.n ?? 0;
}

export interface TopExpenseRow {
  occurred_on: string;
  description: string;
  category: string | null;
  amount_idr: number;
}

// The biggest expenses (rupiah value) from `from` to `to`, for the optional AI review. Transfers are not expenses.
export async function listTopExpenses(db: Db, from: string, to: string, limit: number): Promise<TopExpenseRow[]> {
  return db.getAllAsync<TopExpenseRow>(
    `select t.occurred_on, t.description, c.name as category, t.amount_idr
     from transactions t left join categories c on c.id = t.category_id
     where t.kind = 'expense' and t.occurred_on between $from and $to
     order by t.amount_idr desc, t.id desc limit $limit`,
    { $from: from, $to: to, $limit: limit },
  );
}
