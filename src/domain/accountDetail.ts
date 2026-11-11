// Account detail (Account-Detail) and what the account form reads for an existing account.
// Every figure is a view read: the balance, what came in and went out, the running balance on
// each row. Nothing is stored: opening + in − out equals the balance by construction, and the
// tests check it.
import { periodOfDate } from '../core/date';
import type { Db } from '../data/db/types';
import type { AccountType } from '../data/repo/accounts';
import * as repo from '../data/repo/accountDetail';
import type { ActivityFilter } from '../data/repo/accountDetail';
import { getMonthStartDay } from './transactionsList';

export type { ActivityFilter };

export interface AccountDetail {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  openingBalance: number;
  openingDate: string;
  balance: number; // current balance, rupiah
  moneyIn: number; // income and transfers in, all time
  moneyOut: number; // expenses and transfers out, all time
  recordCount: number;
  period: string; // the month the activity list shows, 'YYYY-MM'
}

export type ActivityKind = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

export interface ActivityItem {
  id: number;
  date: string;
  title: string;
  kind: ActivityKind;
  delta: number; // signed: what it did to this account's balance
  balanceAfter: number;
}

export function activityKind(kind: repo.ActivityRow['activity_kind']): ActivityKind {
  if (kind === 'transfer') return 'transfer_out';
  return kind;
}

// The row's own title: its description, else who the money went to or came from, else its
// category, else the kind.
function activityTitle(row: repo.ActivityRow, kindFallback: (kind: ActivityKind) => string): string {
  const description = row.description.trim();
  if (description) return description;
  const kind = activityKind(row.activity_kind);
  if (kind === 'transfer_out') return `→ ${row.to_name ?? ''}`.trim();
  if (kind === 'transfer_in') return `← ${row.from_name}`;
  return row.category_name ?? kindFallback(kind);
}

export async function getAccountDetail(db: Db, accountId: number, todayIso: string): Promise<AccountDetail | null> {
  const [account, balance, movement, startDay] = await Promise.all([
    repo.getAccountRecord(db, accountId),
    repo.getIdrBalance(db, accountId),
    repo.getMovement(db, accountId),
    getMonthStartDay(db),
  ]);
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    openingBalance: account.opening_balance,
    openingDate: account.opening_date,
    balance: balance ?? 0,
    moneyIn: movement.money_in,
    moneyOut: movement.money_out,
    recordCount: movement.record_count,
    period: periodOfDate(todayIso.slice(0, 10), startDay),
  };
}

export async function listAccountActivity(
  db: Db,
  accountId: number,
  period: string,
  filter: ActivityFilter,
  kindFallback: (kind: ActivityKind) => string,
): Promise<ActivityItem[]> {
  const rows = await repo.listActivity(db, accountId, period, filter);
  return rows.map(row => ({
    id: row.id,
    date: row.occurred_on,
    title: activityTitle(row, kindFallback),
    kind: activityKind(row.activity_kind),
    delta: row.delta,
    balanceAfter: row.balance_after,
  }));
}

// What the account form needs to judge an edit: the account as stored, what moved it (so a lower
// opening balance cannot push the balance below zero) and its oldest record (so the opening date
// cannot move past it).
export interface AccountEditData {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  openingBalance: number;
  openingDate: string;
  movement: number; // money in − money out
  firstRecordOn: string | null;
}

export async function getAccountEditData(db: Db, accountId: number): Promise<AccountEditData | null> {
  const [account, movement] = await Promise.all([repo.getAccountRecord(db, accountId), repo.getMovement(db, accountId)]);
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    openingBalance: account.opening_balance,
    openingDate: account.opening_date,
    movement: movement.money_in - movement.money_out,
    firstRecordOn: movement.first_record_on,
  };
}

// Every account's name (with its id), so the form can refuse a duplicate: the database keeps
// names unique ignoring case.
export async function listAccountNames(db: Db): Promise<{ id: number; name: string }[]> {
  return repo.listAccountNames(db);
}
