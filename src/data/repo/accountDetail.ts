// Reads for Account detail and the account form: the account row itself, what came in and went
// out (v_account_activity), the oldest record, and the month's activity with running balances.
// Nothing here is written back (CLAUDE.md rule 2): a balance is always a view.
import type { Db } from '../db/types';
import type { AccountType } from './accounts';

export interface AccountRecordRow {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  opening_balance: number;
  opening_date: string;
  archived: number;
}

export async function getAccountRecord(db: Db, id: number): Promise<AccountRecordRow | null> {
  return db.getFirstAsync<AccountRecordRow>(
    'select id, name, type, icon, opening_balance, opening_date, archived from accounts where id = $id',
    { $id: id },
  );
}

export async function listAccountNames(db: Db): Promise<{ id: number; name: string }[]> {
  return db.getAllAsync<{ id: number; name: string }>('select id, name from accounts');
}

// A rupiah account's current balance (its one implicit IDR pocket).
export async function getIdrBalance(db: Db, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ balance: number }>(
    "select balance from v_pocket_balance where account_id = $id and currency = 'IDR'",
    { $id: accountId },
  );
  return row ? row.balance : null;
}

export interface MovementRow {
  money_in: number;
  money_out: number;
  record_count: number;
  first_record_on: string | null;
}

// Everything that moved this account: money in (income and transfers in), money out (expenses
// and transfers out), how many records, and the oldest date.
export async function getMovement(db: Db, accountId: number): Promise<MovementRow> {
  const row = await db.getFirstAsync<MovementRow>(
    `select coalesce(sum(case when delta > 0 then delta else 0 end), 0) as money_in,
            coalesce(sum(case when delta < 0 then -delta else 0 end), 0) as money_out,
            count(*) as record_count,
            min(occurred_on) as first_record_on
     from v_account_activity
     where account_id = $id and currency = 'IDR'`,
    { $id: accountId },
  );
  return row ?? { money_in: 0, money_out: 0, record_count: 0, first_record_on: null };
}

export interface ActivityRow {
  id: number;
  occurred_on: string;
  activity_kind: 'income' | 'expense' | 'transfer' | 'transfer_in';
  delta: number;
  balance_after: number;
  description: string;
  category_name: string | null;
  from_name: string;
  to_name: string | null;
}

export type ActivityFilter = 'all' | 'in' | 'out';

// The month's rows for the account, newest first (the opposite of the running balance's order,
// which is date, then the time it was recorded, then id).
export async function listActivity(db: Db, accountId: number, period: string, filter: ActivityFilter): Promise<ActivityRow[]> {
  const sign = filter === 'in' ? 'and a.delta > 0' : filter === 'out' ? 'and a.delta < 0' : '';
  return db.getAllAsync<ActivityRow>(
    `select a.tx_id as id, a.occurred_on, a.kind as activity_kind, a.delta, a.balance_after,
            t.description, c.name as category_name, fa.name as from_name, ta.name as to_name
     from v_account_activity a
     join v_tx t on t.id = a.tx_id
     join accounts fa on fa.id = t.account_id
     left join accounts ta on ta.id = t.to_account_id
     left join categories c on c.id = t.category_id
     where a.account_id = $id and a.currency = 'IDR' and t.period = $period ${sign}
     order by a.occurred_on desc, t.created_at desc, a.tx_id desc`,
    { $id: accountId, $period: period },
  );
}
