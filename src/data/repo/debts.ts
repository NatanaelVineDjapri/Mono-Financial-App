// Debts (migration 13 -> 14): SQL in, plain objects out. The rules are src/domain/debts.ts.
import type { Db } from '../db/types';

export type DebtDirection = 'lent' | 'borrowed';

export interface DebtRow {
  account_id: number;
  direction: DebtDirection;
  person: string;
  due_on: string | null;
  note: string | null;
  started_on: string; // the day of the loan
  total: number; // rupiah lent or borrowed
  remaining: number; // rupiah still owed, either way; read from the view, never stored
}

const SELECT = `
  select d.account_id, d.direction, d.person, d.due_on, d.note, a.opening_date as started_on,
         coalesce((select sum(t.amount) from transactions t
                    where case d.direction when 'lent' then t.to_account_id else t.account_id end = d.account_id), 0) as total,
         abs(v.balance) as remaining
    from debts d
    join accounts a on a.id = d.account_id
    join v_account_balance v on v.id = d.account_id`;

// Open ones first (the nearest due date first), then the settled, newest first.
export async function listDebtRows(db: Db): Promise<DebtRow[]> {
  return db.getAllAsync<DebtRow>(`${SELECT} order by remaining = 0, d.due_on is null, d.due_on, a.opening_date desc, d.account_id desc`);
}

export async function getDebtRow(db: Db, accountId: number): Promise<DebtRow | null> {
  return db.getFirstAsync<DebtRow>(`${SELECT} where d.account_id = $id`, { $id: accountId });
}

export interface DebtMove {
  id: number;
  amount: number;
  occurred_on: string;
  repayment: number; // 1: paying back, 0: the loan itself
  account_name: string; // the real account the money left or entered
}

export async function listDebtMoves(db: Db, accountId: number): Promise<DebtMove[]> {
  return db.getAllAsync<DebtMove>(
    `select t.id, t.amount, t.occurred_on,
            case when (d.direction = 'lent') = (t.account_id = d.account_id) then 1 else 0 end as repayment,
            a.name as account_name
       from debts d
       join transactions t on t.account_id = d.account_id or t.to_account_id = d.account_id
       join accounts a on a.id = case when t.account_id = d.account_id then t.to_account_id else t.account_id end
      where d.account_id = $id
      order by t.occurred_on, t.id`,
    { $id: accountId },
  );
}

export async function accountNameExists(db: Db, name: string): Promise<boolean> {
  return (await db.getFirstAsync('select 1 as x from accounts where name = $name', { $name: name })) != null;
}

// The hidden account of a debt: opened on the day of the loan, empty, and archived so nothing offers it.
export async function insertDebtAccount(db: Db, name: string, openingDate: string, now: string): Promise<number> {
  const result = await db.runAsync(
    "insert into accounts (name, type, opening_balance, opening_date, archived, created_at) values ($name, 'cash', 0, $date, 1, $now)",
    { $name: name, $date: openingDate, $now: now },
  );
  return result.lastInsertRowId;
}

export async function insertDebt(db: Db, debt: { accountId: number; direction: DebtDirection; person: string; dueOn: string | null; note: string | null; createdAt: string }): Promise<void> {
  await db.runAsync('insert into debts (account_id, direction, person, due_on, note, created_at) values ($id, $direction, $person, $due, $note, $now)', {
    $id: debt.accountId,
    $direction: debt.direction,
    $person: debt.person,
    $due: debt.dueOn,
    $note: debt.note,
    $now: debt.createdAt,
  });
}

// The loan, its payments and its account; run inside the caller's transaction.
export async function deleteDebtRows(db: Db, accountId: number): Promise<void> {
  const at = { $id: accountId };
  await db.runAsync('delete from transactions where account_id = $id or to_account_id = $id', at);
  await db.runAsync('delete from debts where account_id = $id', at);
  await db.runAsync('delete from accounts where id = $id', at);
}
