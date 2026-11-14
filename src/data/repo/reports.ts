// v_period_flow, v_savings_rate, v_category_spend — period bucketing already honours
// settings.month_start_day inside the view (v_tx), so nothing here needs to know about
// that setting itself.
import type { Db } from '../db/types';

export interface PeriodFlowRow {
  period: string;
  income: number;
  expense: number;
  net: number;
  transfer_count: number;
  transfer_total: number;
}

export async function getPeriodFlow(db: Db, period: string): Promise<PeriodFlowRow | null> {
  return db.getFirstAsync<PeriodFlowRow>('select * from v_period_flow where period = $period', { $period: period });
}

export async function listPeriodFlow(db: Db): Promise<PeriodFlowRow[]> {
  return db.getAllAsync<PeriodFlowRow>('select * from v_period_flow order by period');
}

export interface SavingsRateRow {
  period: string;
  income: number;
  expense: number;
  net: number;
  savings_rate_bp: number | null; // null when income is 0
}

export async function getSavingsRate(db: Db, period: string): Promise<SavingsRateRow | null> {
  return db.getFirstAsync<SavingsRateRow>('select * from v_savings_rate where period = $period', { $period: period });
}

export interface CategorySpendRow {
  period: string;
  category_id: number;
  spent: number;
}

export async function listCategorySpend(db: Db, period: string): Promise<CategorySpendRow[]> {
  return db.getAllAsync<CategorySpendRow>('select * from v_category_spend where period = $period order by spent desc', { $period: period });
}

// The Reports range folds several periods into one category total. Period keys are
// 'YYYY-MM', so a between comparison is the same as the period list the range built.
export interface CategorySpendNamedRow {
  category_id: number;
  category_name: string;
  spent: number;
}

export async function listCategorySpendRange(db: Db, fromPeriod: string, toPeriod: string): Promise<CategorySpendNamedRow[]> {
  return db.getAllAsync<CategorySpendNamedRow>(
    `select s.category_id, c.name as category_name, sum(s.spent) as spent
     from v_category_spend s
     join categories c on c.id = s.category_id
     where s.period between $from and $to
     group by s.category_id, c.name
     order by spent desc, c.name`,
    { $from: fromPeriod, $to: toPeriod },
  );
}

// The CSV export reads the same rows the Transactions screen does, but without pagination
// or filters: every record inside the selected date range, oldest first.
export interface ReportTransactionRow {
  id: number;
  kind: string;
  occurred_on: string;
  description: string;
  note: string | null;
  amount: number;
  amount_idr: number;
  currency: string;
  category_name: string | null;
  account_name: string;
  to_account_name: string | null;
  amount_to: number | null;
  to_currency: string | null;
}

export async function listTransactionsForRange(db: Db, fromDate: string, toDate: string): Promise<ReportTransactionRow[]> {
  return db.getAllAsync<ReportTransactionRow>(
    `select t.id, t.kind, t.occurred_on, t.description, t.note, t.amount, t.amount_idr, t.currency,
            c.name as category_name, a.name as account_name, ta.name as to_account_name,
            t.amount_to, t.to_currency
     from transactions t
     left join categories c on c.id = t.category_id
     join accounts a on a.id = t.account_id
     left join accounts ta on ta.id = t.to_account_id
     where t.occurred_on between $from and $to
     order by t.occurred_on, t.created_at, t.id`,
    { $from: fromDate, $to: toDate },
  );
}

// Per-account balance valued in rupiah at one calendar month end, mirroring
// v_net_worth_by_month's pricing: the newest rate recorded on or before that month end,
// or the oldest rate if none is that old. value_idr is null when a foreign pocket has no
// rate yet, never a silent zero.
export interface AccountBalanceAtMonthEndRow {
  account_id: number;
  account_name: string;
  account_type: string;
  currency: string;
  minor_factor: number;
  balance: number;
  rate_e4: number | null;
  value_idr: number | null;
}

export async function listAccountBalancesAtMonthEnd(db: Db, monthEnd: string): Promise<AccountBalanceAtMonthEndRow[]> {
  return db.getAllAsync<AccountBalanceAtMonthEndRow>(
    `with priced as (
       select p.account_id, a.name as account_name, a.type as account_type, p.currency, c.minor_factor,
              case when p.opening_date <= $end then p.opening_balance else 0 end
              + coalesce((select sum(case kind when 'income' then amount else -amount end)
                          from transactions t
                          where t.account_id = p.account_id and t.currency = p.currency
                            and t.occurred_on <= $end), 0)
              + coalesce((select sum(amount_to)
                          from transactions t
                          where t.to_account_id = p.account_id and t.to_currency = p.currency
                            and t.occurred_on <= $end), 0) as balance,
              coalesce((select f.rate_e4 from fx_rates f
                        where f.currency = p.currency and substr(f.fetched_at, 1, 10) <= $end
                        order by f.fetched_at desc, f.id desc limit 1),
                       (select f.rate_e4 from fx_rates f
                        where f.currency = p.currency order by f.fetched_at, f.id limit 1)) as rate_e4
       from v_pocket p
       join accounts a on a.id = p.account_id
       join currencies c on c.code = p.currency
     )
     select account_id, account_name, account_type, currency, minor_factor, balance, rate_e4,
            case when currency = 'IDR' then balance
                 when rate_e4 is null then null
                 else (2 * balance * rate_e4 + case when balance >= 0 then 1 else -1 end * minor_factor * 10000)
                      / (2 * minor_factor * 10000) end as value_idr
     from priced
     order by account_id, currency`,
    { $end: monthEnd },
  );
}

// The first date the app has any record at all: the earliest transaction or opening
// balance. Reports uses it to tell "under one month of data" from a real history.
export async function getEarliestActivityDate(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    `select min(d) as earliest from (
       select min(occurred_on) as d from transactions
       union all
       select min(opening_date) as d from accounts
     )`,
  );
  return row?.earliest ?? null;
}
