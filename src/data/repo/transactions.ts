// Thin SQL access to the transactions table and its views. The business rules (which
// fields a kind needs, computing amount_idr, the exchange shape) live in
// src/domain/transactions.ts, not here — this file only moves rows.
import type { Db } from '../db/types';

export type TxKind = 'income' | 'expense' | 'transfer';
export type TxSource = 'manual' | 'ai' | 'recurring' | 'scan' | 'import';

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

// `kind` may change between income and expense (the edit form); the schema's own guards still
// check the category against it. A transfer never changes into or out of its kind.
export async function updateTransaction(
  db: Db,
  id: number,
  patch: Partial<Omit<NewTransaction, 'kind'>> & { kind?: 'income' | 'expense' },
  now: string,
): Promise<void> {
  const fields: string[] = ['updated_at = $now'];
  const params: Record<string, string | number | null> = { $id: id, $now: now };
  const map: Record<string, string> = {
    kind: 'kind', accountId: 'account_id', currency: 'currency', toAccountId: 'to_account_id', toCurrency: 'to_currency',
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

// Puts a deleted record back exactly as it was: same id, same created_at/updated_at (Undo
// after Delete). The SQL guards still run on the insert, like for any new record.
export async function restoreTransaction(db: Db, row: TransactionRow): Promise<void> {
  await db.runAsync(
    `insert into transactions
      (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at)
     values
      ($id, $kind, $accountId, $currency, $toAccountId, $toCurrency, $categoryId, $amount, $amountTo, $amountIdr, $occurredOn, $description, $note, $source, $createdAt, $updatedAt)`,
    {
      $id: row.id,
      $kind: row.kind,
      $accountId: row.account_id,
      $currency: row.currency,
      $toAccountId: row.to_account_id,
      $toCurrency: row.to_currency,
      $categoryId: row.category_id,
      $amount: row.amount,
      $amountTo: row.amount_to,
      $amountIdr: row.amount_idr,
      $occurredOn: row.occurred_on,
      $description: row.description,
      $note: row.note,
      $source: row.source,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at,
    },
  );
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

// Transactions tab (DESIGN.md "B. Transactions" / PAGES.md B1): every list, daily
// total, summary, count, and category-ring aggregation shares this builder. Filter values
// are always bound parameters; arrays expand to individually named bound parameters.
export interface TxListFilter {
  period?: string;
  startDate?: string;
  endDate?: string;
  kind?: TxKind;
  search?: string; // matched against description, note, category name, account name(s)
  categoryId?: number; // legacy single-category caller
  categoryIds?: number[];
  accountIds?: number[];
  minAmount?: number; // whole rupiah, compared with immutable amount_idr
  maxAmount?: number; // whole rupiah, compared with immutable amount_idr
}

const TX_JOIN = `
  from v_tx t
  join accounts a on a.id = t.account_id
  left join accounts ta on ta.id = t.to_account_id
  left join categories c on c.id = t.category_id
  join currencies cur on cur.code = t.currency
`;

function validIds(ids: number[] | undefined, legacyId?: number): number[] {
  const raw = ids ?? (legacyId == null ? [] : [legacyId]);
  return [...new Set(raw)].filter(id => Number.isInteger(id) && id > 0);
}

function addInClause(
  column: string,
  parameterPrefix: string,
  ids: number[],
  params: Record<string, string | number>,
  clauses: string[],
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map((id, index) => {
    const key = `$${parameterPrefix}${index}`;
    params[key] = id;
    return key;
  });
  clauses.push(`${column} in (${placeholders.join(', ')})`);
}

/** Builds the parameterised WHERE clause used by every Transactions filter query. */
export function buildTxFilterSql(filter: TxListFilter, params: Record<string, string | number>): string {
  if (filter.minAmount != null && filter.maxAmount != null && filter.minAmount > filter.maxAmount) {
    throw new RangeError('The minimum transaction amount cannot exceed the maximum amount.');
  }

  const clauses: string[] = [];
  if (filter.period) {
    clauses.push('t.period = $period');
    params.$period = filter.period;
  }
  if (filter.startDate) {
    clauses.push('t.occurred_on >= $startDate');
    params.$startDate = filter.startDate;
  }
  if (filter.endDate) {
    clauses.push('t.occurred_on <= $endDate');
    params.$endDate = filter.endDate;
  }
  if (filter.kind) {
    clauses.push('t.kind = $kind');
    params.$kind = filter.kind;
  }

  addInClause('t.category_id', 'categoryId', validIds(filter.categoryIds, filter.categoryId), params, clauses);

  const accountIds = validIds(filter.accountIds);
  if (accountIds.length > 0) {
    const placeholders = accountIds.map((id, index) => {
      const key = `$accountId${index}`;
      params[key] = id;
      return key;
    });
    clauses.push(`(t.account_id in (${placeholders.join(', ')}) or t.to_account_id in (${placeholders.join(', ')}))`);
  }
  if (filter.minAmount != null) {
    clauses.push('t.amount_idr >= $minAmount');
    params.$minAmount = filter.minAmount;
  }
  if (filter.maxAmount != null) {
    clauses.push('t.amount_idr <= $maxAmount');
    params.$maxAmount = filter.maxAmount;
  }
  if (filter.search) {
    clauses.push('(t.description LIKE $search OR t.note LIKE $search OR c.name LIKE $search OR a.name LIKE $search OR ta.name LIKE $search)');
    params.$search = `%${filter.search}%`;
  }
  return clauses.length ? clauses.join(' and ') : '1 = 1';
}

export interface TxListRow {
  id: number;
  kind: TxKind;
  occurred_on: string;
  description: string;
  note: string | null;
  amount: number; // minor units of `currency`
  amount_idr: number;
  currency: string;
  minor_factor: number;
  amount_to: number | null; // minor units of `to_currency`, transfers only
  to_currency: string | null;
  category_id: number | null;
  category_name: string | null;
  account_id: number;
  account_name: string;
  to_account_id: number | null;
  to_account_name: string | null;
}

async function listTransactionsWithFilter(db: Db, filter: TxListFilter): Promise<TxListRow[]> {
  const params: Record<string, string | number> = {};
  const where = buildTxFilterSql(filter, params);
  return db.getAllAsync<TxListRow>(
    `select t.id, t.kind, t.occurred_on, t.description, t.note, t.amount, t.amount_idr, t.currency,
            cur.minor_factor, t.amount_to, t.to_currency, t.category_id, c.name as category_name,
            t.account_id, a.name as account_name, t.to_account_id, ta.name as to_account_name
     ${TX_JOIN}
     where ${where}
     order by t.occurred_on desc, t.id desc`,
    params,
  );
}

export function listTransactionsForFilter(db: Db, filter: TxListFilter = {}): Promise<TxListRow[]> {
  return listTransactionsWithFilter(db, filter);
}

export function listTransactionsForPeriod(db: Db, period: string, filter: TxListFilter = {}): Promise<TxListRow[]> {
  return listTransactionsWithFilter(db, { ...filter, period });
}

export interface PeriodSummary {
  income: number;
  expense: number;
  net: number;
  transfer_count: number;
  transfer_total: number;
}

async function summaryWithFilter(db: Db, filter: TxListFilter): Promise<PeriodSummary> {
  const params: Record<string, string | number> = {};
  const where = buildTxFilterSql(filter, params);
  const row = await db.getFirstAsync<PeriodSummary>(
    `select
       coalesce(sum(case when t.kind = 'income' then t.amount_idr end), 0) as income,
       coalesce(sum(case when t.kind = 'expense' then t.amount_idr end), 0) as expense,
       coalesce(sum(case when t.kind = 'income' then t.amount_idr when t.kind = 'expense' then -t.amount_idr end), 0) as net,
       coalesce(sum(t.kind = 'transfer'), 0) as transfer_count,
       coalesce(sum(case when t.kind = 'transfer' then t.amount_idr end), 0) as transfer_total
     ${TX_JOIN}
     where ${where}`,
    params,
  );
  return row ?? { income: 0, expense: 0, net: 0, transfer_count: 0, transfer_total: 0 };
}

export function getTransactionSummary(db: Db, filter: TxListFilter = {}): Promise<PeriodSummary> {
  return summaryWithFilter(db, filter);
}

export function getPeriodSummary(db: Db, period: string, filter: TxListFilter = {}): Promise<PeriodSummary> {
  return summaryWithFilter(db, { ...filter, period });
}

export interface DailyTotalRow {
  occurred_on: string;
  income: number;
  expense: number;
  net: number;
}

async function dailyTotalsWithFilter(db: Db, filter: TxListFilter): Promise<DailyTotalRow[]> {
  const params: Record<string, string | number> = {};
  const where = buildTxFilterSql(filter, params);
  return db.getAllAsync<DailyTotalRow>(
    `select t.occurred_on,
            coalesce(sum(case when t.kind = 'income' then t.amount_idr end), 0) as income,
            coalesce(sum(case when t.kind = 'expense' then t.amount_idr end), 0) as expense,
            coalesce(sum(case when t.kind = 'income' then t.amount_idr when t.kind = 'expense' then -t.amount_idr end), 0) as net
     ${TX_JOIN}
     where ${where}
     group by t.occurred_on
     order by t.occurred_on desc`,
    params,
  );
}

export function listDailyTotalsForFilter(db: Db, filter: TxListFilter = {}): Promise<DailyTotalRow[]> {
  return dailyTotalsWithFilter(db, filter);
}

export function listDailyTotals(db: Db, period: string, filter: TxListFilter = {}): Promise<DailyTotalRow[]> {
  return dailyTotalsWithFilter(db, { ...filter, period });
}

export async function countTransactionsForFilter(db: Db, filter: TxListFilter = {}): Promise<number> {
  const params: Record<string, string | number> = {};
  const where = buildTxFilterSql(filter, params);
  const row = await db.getFirstAsync<{ count: number }>(`select count(*) as count ${TX_JOIN} where ${where}`, params);
  return row?.count ?? 0;
}

// The earliest month with any record at all — where infinite-scroll paging into the
// past should stop. Unfiltered on purpose: a search/chip filter narrowing the visible
// rows should never also narrow how far back "load more" is willing to look.
export async function getEarliestPeriod(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ period: string | null }>('select min(period) as period from v_tx');
  return row?.period ?? null;
}

// Fase 4.3c's ring chart / category list: aggregate from the exact same filter builder
// as rows and summaries, then group by category for the ring's portions.
export interface CategoryTotalRow {
  category_id: number;
  category_name: string;
  category_icon: string | null;
  amount_idr: number;
}

export async function listCategoryTotalsForFilter(
  db: Db,
  kind: 'income' | 'expense',
  filter: TxListFilter = {},
): Promise<CategoryTotalRow[]> {
  const params: Record<string, string | number> = {};
  const where = buildTxFilterSql({ ...filter, kind }, params);
  return db.getAllAsync<CategoryTotalRow>(
    `select t.category_id, c.name as category_name, c.icon as category_icon, sum(t.amount_idr) as amount_idr
     ${TX_JOIN}
     where ${where}
     group by t.category_id
     order by amount_idr desc`,
    params,
  );
}

export function listCategoryTotals(db: Db, period: string, kind: 'income' | 'expense'): Promise<CategoryTotalRow[]> {
  return listCategoryTotalsForFilter(db, kind, { period });
}

// The rupiah account the person used most recently for an income or an expense (not a transfer),
// the scan's default account. Null when there is none or when that account is archived.
export async function getLastUsedAccountId(db: Db): Promise<number | null> {
  const row = await db.getFirstAsync<{ account_id: number }>(
    `select t.account_id
       from transactions t
       join accounts a on a.id = t.account_id
      where t.kind in ('income', 'expense') and t.currency = 'IDR' and a.archived = 0 and a.type <> 'forex'
      order by t.created_at desc, t.id desc
      limit 1`,
  );
  return row?.account_id ?? null;
}

export interface QuickRecordRow {
  source: 'place' | 'category';
  label: string;
  place_name: string | null;
  kind: 'income' | 'expense';
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  amount: number;
  use_count: number;
  last_on: string;
}

export function listQuickRecordSources(db: Db, limit: number): Promise<QuickRecordRow[]> {
  return db.getAllAsync<QuickRecordRow>(
    `with txs as (
       select t.id as id,
              t.kind as kind,
              t.account_id as account_id,
              t.category_id as category_id,
              t.amount as amount,
              t.occurred_on as occurred_on,
              lower(trim(coalesce(tl.place_name, ''))) as place_key
         from transactions t
         join accounts a on a.id = t.account_id and a.archived = 0
         left join transaction_locations tl on tl.transaction_id = t.id
        where t.kind in ('income', 'expense')
          and t.currency = 'IDR'
     ),
     cat_pairs as (
       select kind,
              category_id,
              account_id,
              count(*) as pair_count,
              max(occurred_on) as pair_last_on,
              max(id) as pair_last_id
         from txs
        where category_id is not null
        group by kind, category_id, account_id
     ),
     cat_ranked as (
       select p.*,
              row_number() over (
                partition by p.kind, p.category_id
                order by p.pair_count desc, p.pair_last_on desc, p.pair_last_id desc
              ) as rank,
              sum(p.pair_count) over (partition by p.kind, p.category_id) as use_count,
              max(p.pair_last_on) over (partition by p.kind, p.category_id) as last_on
         from cat_pairs p
     ),
     place_pairs as (
       select kind,
              place_key,
              account_id,
              category_id,
              count(*) as pair_count,
              max(occurred_on) as pair_last_on,
              max(id) as pair_last_id
         from txs
        where place_key <> ''
        group by kind, place_key, account_id, category_id
     ),
     place_ranked as (
       select p.*,
              row_number() over (
                partition by p.kind, p.place_key
                order by p.pair_count desc, p.pair_last_on desc, p.pair_last_id desc
              ) as rank,
              sum(p.pair_count) over (partition by p.kind, p.place_key) as use_count,
              max(p.pair_last_on) over (partition by p.kind, p.place_key) as last_on
         from place_pairs p
     ),
     items as (
       select 'category' as source,
              c.kind as kind,
              c.account_id as account_id,
              c.category_id as category_id,
              c.use_count as use_count,
              c.last_on as last_on,
              c.pair_last_id as last_id,
              null as place_name
         from cat_ranked c
        where c.rank = 1
       union all
       select 'place' as source,
              p.kind as kind,
              p.account_id as account_id,
              p.category_id as category_id,
              p.use_count as use_count,
              p.last_on as last_on,
              p.pair_last_id as last_id,
              (select trim(tl2.place_name)
                 from transaction_locations tl2
                where tl2.transaction_id = p.pair_last_id) as place_name
         from place_ranked p
        where p.rank = 1
     ),
     labelled as (
       select i.*,
              coalesce(i.place_name, c.name, '') as label
         from items i
         left join categories c on c.id = i.category_id
     ),
     deduped as (
       select l.*,
              row_number() over (
                partition by lower(l.label)
                order by l.use_count desc, l.last_on desc,
                         case when l.source = 'place' then 0 else 1 end
              ) as label_rank
         from labelled l
     )
     select d.source as source,
            d.label as label,
            d.place_name as place_name,
            d.kind as kind,
            d.account_id as account_id,
            a.name as account_name,
            d.category_id as category_id,
            c.name as category_name,
            t.amount as amount,
            d.use_count as use_count,
            d.last_on as last_on
       from deduped d
       join transactions t on t.id = d.last_id
       join accounts a on a.id = d.account_id
       left join categories c on c.id = d.category_id
      where d.label_rank = 1
      order by d.use_count desc, d.last_on desc, d.label
      limit $limit`,
    { $limit: limit },
  );
}

export interface SimilarExpense {
  id: number;
  occurred_on: string;
  description: string;
  amount: number;
}

// An expense that looks like the one about to be saved: the same account and amount, on the same
// day or the day before or after. The nearest date (then the latest record) wins. A hint only.
export async function findSimilarExpense(
  db: Db,
  q: { accountId: number; amount: number; date: string; from: string; to: string },
): Promise<SimilarExpense | null> {
  return db.getFirstAsync<SimilarExpense>(
    `select id, occurred_on, description, amount
       from transactions
      where kind = 'expense' and currency = 'IDR' and account_id = $accountId and amount = $amount
        and occurred_on between $from and $to
      order by abs(julianday(occurred_on) - julianday($date)), id desc
      limit 1`,
    { $accountId: q.accountId, $amount: q.amount, $date: q.date, $from: q.from, $to: q.to },
  );
}
