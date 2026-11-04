// Thin SQL access to the transactions table and its views. The business rules (which
// fields a kind needs, computing amount_idr, the exchange shape) live in
// src/domain/transactions.ts, not here — this file only moves rows.
import type { Db } from '../db/types';

export type TxKind = 'income' | 'expense' | 'transfer';
export type TxSource = 'manual' | 'ai' | 'recurring';

export interface NewTransaction {
  kind: TxKind;
  accountId: number;
  currency: string; // 'IDR' for a normal account
  toAccountId?: number | null;
  toCurrency?: string | null;
  categoryId?: number | null;
  amount: number; // minor units of `currency`
  amountTo?: number | null; // minor units of `toCurrency`, transfers only
  amountIdr: number; // rupiah value when recorded
  occurredOn: string;
  description?: string;
  note?: string | null;
  source?: TxSource;
}

export interface TransactionRow {
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
  updated_at: string;
  period: string;
}

export async function insertTransaction(db: Db, input: NewTransaction, now: string): Promise<number> {
  const result = await db.runAsync(
    `insert into transactions
      (kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at)
     values
      ($kind, $accountId, $currency, $toAccountId, $toCurrency, $categoryId, $amount, $amountTo, $amountIdr, $occurredOn, $description, $note, $source, $now, $now)`,
    {
      $kind: input.kind,
      $accountId: input.accountId,
      $currency: input.currency,
      $toAccountId: input.toAccountId ?? null,
      $toCurrency: input.toCurrency ?? null,
      $categoryId: input.categoryId ?? null,
      $amount: input.amount,
      $amountTo: input.amountTo ?? null,
      $amountIdr: input.amountIdr,
      $occurredOn: input.occurredOn,
      $description: input.description ?? '',
      $note: input.note ?? null,
      $source: input.source ?? 'manual',
      $now: now,
    },
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  db: Db,
  id: number,
  patch: Partial<Omit<NewTransaction, 'kind'>>,
  now: string,
): Promise<void> {
  const fields: string[] = ['updated_at = $now'];
  const params: Record<string, string | number | null> = { $id: id, $now: now };
  const map: Record<string, string> = {
    accountId: 'account_id', currency: 'currency', toAccountId: 'to_account_id', toCurrency: 'to_currency',
    categoryId: 'category_id', amount: 'amount', amountTo: 'amount_to', amountIdr: 'amount_idr',
    occurredOn: 'occurred_on', description: 'description', note: 'note', source: 'source',
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, string | number | null | undefined>)[key];
    if (value !== undefined) {
      fields.push(`${column} = $${key}`);
      params[`$${key}`] = value;
    }
  }
  await db.runAsync(`update transactions set ${fields.join(', ')} where id = $id`, params);
}

export async function deleteTransaction(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from transactions where id = $id', { $id: id });
}

export async function getTransaction(db: Db, id: number): Promise<TransactionRow | null> {
  return db.getFirstAsync<TransactionRow>('select * from v_tx where id = $id', { $id: id });
}

export interface ListTransactionsFilter {
  period?: string; // 'YYYY-MM'
  accountId?: number;
  categoryId?: number;
  kind?: TxKind;
  limit?: number;
}

export async function listTransactions(db: Db, filter: ListTransactionsFilter = {}): Promise<TransactionRow[]> {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (filter.period) { where.push('period = $period'); params.$period = filter.period; }
  if (filter.accountId !== undefined) { where.push('account_id = $accountId'); params.$accountId = filter.accountId; }
  if (filter.categoryId !== undefined) { where.push('category_id = $categoryId'); params.$categoryId = filter.categoryId; }
  if (filter.kind) { where.push('kind = $kind'); params.$kind = filter.kind; }
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  const limit = filter.limit ? `limit ${Number(filter.limit)}` : '';
  return db.getAllAsync<TransactionRow>(`select * from v_tx ${clause} order by occurred_on desc, id desc ${limit}`, params);
}

export interface AccountActivityRow {
  account_id: number;
  currency: string;
  tx_id: number;
  occurred_on: string;
  kind: string;
  delta: number;
  balance_after: number;
}

export async function listAccountActivity(db: Db, accountId: number, currency: string, limit?: number): Promise<AccountActivityRow[]> {
  const limitClause = limit ? `limit ${Number(limit)}` : '';
  return db.getAllAsync<AccountActivityRow>(
    `select * from v_account_activity where account_id = $accountId and currency = $currency order by occurred_on desc, tx_id desc ${limitClause}`,
    { $accountId: accountId, $currency: currency },
  );
}
