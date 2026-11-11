// Reads for the Transaction detail screen (Tx-Detail): the record with its account,
// category and currency names joined in, the running balance after it (v_account_activity),
// a pocket's current balance (v_pocket_balance) and the budget line it counts toward
// (v_budget_status). Nothing here is written back (CLAUDE.md rule 2).
import type { Db } from '../db/types';
import type { AccountType } from './accounts';
import type { TxKind, TxSource } from './transactions';

export interface TxDetailRow {
  id: number;
  kind: TxKind;
  account_id: number;
  currency: string;
  to_account_id: number | null;
  to_currency: string | null;
  category_id: number | null;
  amount: number;
  amount_to: number | null;
  amount_idr: number;
  occurred_on: string;
  description: string;
  note: string | null;
  source: TxSource;
  created_at: string;
  period: string;
  minor_factor: number;
  to_minor_factor: number | null;
  account_name: string;
  account_type: AccountType;
  account_icon: string | null;
  to_account_name: string | null;
  to_account_type: AccountType | null;
  to_account_icon: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export async function getTxDetailRow(db: Db, id: number): Promise<TxDetailRow | null> {
  return db.getFirstAsync<TxDetailRow>(
    `select t.id, t.kind, t.account_id, t.currency, t.to_account_id, t.to_currency, t.category_id,
            t.amount, t.amount_to, t.amount_idr, t.occurred_on, t.description, t.note, t.source, t.created_at, t.period,
            c.minor_factor, tc.minor_factor as to_minor_factor,
            a.name as account_name, a.type as account_type, a.icon as account_icon,
            ta.name as to_account_name, ta.type as to_account_type, ta.icon as to_account_icon,
            cat.name as category_name, cat.icon as category_icon
     from v_tx t
     join currencies c on c.code = t.currency
     left join currencies tc on tc.code = t.to_currency
     join accounts a on a.id = t.account_id
     left join accounts ta on ta.id = t.to_account_id
     left join categories cat on cat.id = t.category_id
     where t.id = $id`,
    { $id: id },
  );
}

// The pocket's running balance right after this record (a transfer has one row per side).
export async function getBalanceAfter(db: Db, accountId: number, currency: string, txId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ balance_after: number }>(
    'select balance_after from v_account_activity where account_id = $accountId and currency = $currency and tx_id = $txId',
    { $accountId: accountId, $currency: currency, $txId: txId },
  );
  return row ? row.balance_after : null;
}

export async function getPocketBalanceNow(db: Db, accountId: number, currency: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ balance: number }>(
    'select balance from v_pocket_balance where account_id = $accountId and currency = $currency',
    { $accountId: accountId, $currency: currency },
  );
  return row ? row.balance : null;
}

export interface BudgetLineRow {
  month: string;
  category_id: number;
  category: string;
  limit_amount: number;
  spent: number;
  used_bp: number;
  is_over: number;
}

export async function getBudgetLine(db: Db, month: string, categoryId: number): Promise<BudgetLineRow | null> {
  return db.getFirstAsync<BudgetLineRow>(
    'select month, category_id, category, limit_amount, spent, used_bp, is_over from v_budget_status where month = $month and category_id = $categoryId',
    { $month: month, $categoryId: categoryId },
  );
}
