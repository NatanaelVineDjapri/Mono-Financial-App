// Transaction detail (Tx-Detail, Tx-Detail-Transfer, Tx-Detail-Valas, Tx-Delete): one
// record with everything the screen shows, and what deleting it would do. Every figure is a
// view read (v_account_activity, v_pocket_balance, v_budget_status); the only arithmetic
// is "the balance minus this record's effect" for the delete preview, in integers.
import type { Db } from '../data/db/types';
import type { AccountType } from '../data/repo/accounts';
import * as repo from '../data/repo/transactionDetail';
import type { TxKind, TxSource } from '../data/repo/transactions';

export interface TxDetailAccount {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  currency: string; // the pocket this side of the record touched
  minorFactor: number;
  balanceAfter: number; // minor units of `currency`, right after this record
}

export interface TxDetailBudget {
  month: string; // 'YYYY-MM'
  categoryName: string;
  limit: number;
  spent: number; // the month's spending in this category, this record included
  usedBp: number;
  isOver: boolean;
  overBy: number;
}

export interface TxDetail {
  id: number;
  kind: TxKind;
  description: string;
  note: string | null;
  source: TxSource;
  occurredOn: string;
  recordedAt: string; // created_at: the time shown beside the date
  amount: number; // minor units of `currency`
  currency: string;
  minorFactor: number;
  amountTo: number | null;
  toCurrency: string | null;
  toMinorFactor: number | null;
  amountIdr: number;
  category: { id: number; name: string; icon: string | null } | null;
  account: TxDetailAccount;
  toAccount: TxDetailAccount | null;
  // Foreign-currency income/expense only: the rate the rupiah value was struck at.
  rateE4: number | null;
  budget: TxDetailBudget | null; // expenses whose category has a budget that month
}

// amount_idr / amount, as rupiah per 1 major unit times 10.000 (the same unit as
// fx_rates.rate_e4), half away from zero. BigInt: the product passes 2^53 for large amounts.
export function impliedRateE4(amountIdr: number, amount: number, minorFactor: number): number {
  const n = BigInt(amountIdr) * BigInt(minorFactor) * 10000n;
  const d = BigInt(amount);
  return Number((2n * n + d) / (2n * d));
}

export async function getTransactionDetail(db: Db, id: number): Promise<TxDetail | null> {
  const row = await repo.getTxDetailRow(db, id);
  if (!row) return null;

  const balanceAfter = (await repo.getBalanceAfter(db, row.account_id, row.currency, row.id)) ?? 0;
  const account: TxDetailAccount = {
    id: row.account_id,
    name: row.account_name,
    type: row.account_type,
    icon: row.account_icon,
    currency: row.currency,
    minorFactor: row.minor_factor,
    balanceAfter,
  };

  let toAccount: TxDetailAccount | null = null;
  if (row.kind === 'transfer' && row.to_account_id != null && row.to_currency && row.to_minor_factor != null) {
    toAccount = {
      id: row.to_account_id,
      name: row.to_account_name ?? '',
      type: row.to_account_type ?? 'bank',
      icon: row.to_account_icon,
      currency: row.to_currency,
      minorFactor: row.to_minor_factor,
      balanceAfter: (await repo.getBalanceAfter(db, row.to_account_id, row.to_currency, row.id)) ?? 0,
    };
  }

  let budget: TxDetailBudget | null = null;
  if (row.kind === 'expense' && row.category_id != null) {
    const line = await repo.getBudgetLine(db, row.period, row.category_id);
    if (line) {
      budget = {
        month: line.month,
        categoryName: line.category,
        limit: line.limit_amount,
        spent: line.spent,
        usedBp: line.used_bp,
        isOver: !!line.is_over,
        overBy: Math.max(line.spent - line.limit_amount, 0),
      };
    }
  }

  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    note: row.note,
    source: row.source,
    occurredOn: row.occurred_on,
    recordedAt: row.created_at,
    amount: row.amount,
    currency: row.currency,
    minorFactor: row.minor_factor,
    amountTo: row.amount_to,
    toCurrency: row.to_currency,
    toMinorFactor: row.to_minor_factor,
    amountIdr: row.amount_idr,
    category: row.category_id != null ? { id: row.category_id, name: row.category_name ?? '', icon: row.category_icon } : null,
    account,
    toAccount,
    rateE4: row.kind !== 'transfer' && row.currency !== 'IDR' ? impliedRateE4(row.amount_idr, row.amount, row.minor_factor) : null,
    budget,
  };
}

// What the delete dialog states: each touched pocket's balance, and the budget's spending,
// once this record is gone. The current balance minus the record's own effect.
export interface DeletePreview {
  accountAfter: number; // minor units of the source pocket's currency
  toAccountAfter: number | null; // transfers only
  budgetSpentAfter: number | null; // expenses with a budget only (whole rupiah)
}

export async function getDeletePreview(db: Db, detail: TxDetail): Promise<DeletePreview> {
  const now = (await repo.getPocketBalanceNow(db, detail.account.id, detail.account.currency)) ?? 0;
  // Income added money; an expense or a transfer's source side took it out.
  const accountAfter = detail.kind === 'income' ? now - detail.amount : now + detail.amount;

  let toAccountAfter: number | null = null;
  if (detail.toAccount && detail.amountTo != null) {
    const toNow = (await repo.getPocketBalanceNow(db, detail.toAccount.id, detail.toAccount.currency)) ?? 0;
    toAccountAfter = toNow - detail.amountTo;
  }

  return {
    accountAfter,
    toAccountAfter,
    budgetSpentAfter: detail.budget ? detail.budget.spent - detail.amountIdr : null,
  };
}
