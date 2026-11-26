// Reads for the Summary page. Rupiah values are the ones frozen on each record (amount_idr); transfers are never read.
import type { Db } from '../db/types';

export interface SummaryRow {
  date: string;
  kind: 'income' | 'expense';
  category_id: number;
  category_name: string;
  category_icon: string | null;
  subcategory_id: number | null;
  subcategory_name: string | null;
  amount_idr: number;
}

// One row per day, kind, category and sub-category between two dates (inclusive).
export async function listSummaryRows(db: Db, from: string, to: string): Promise<SummaryRow[]> {
  return db.getAllAsync<SummaryRow>(
    `select t.occurred_on as date, t.kind, t.category_id, c.name as category_name, c.icon as category_icon,
            t.subcategory_id, s.name as subcategory_name, sum(t.amount_idr) as amount_idr
     from transactions t
     join categories c on c.id = t.category_id
     left join subcategories s on s.id = t.subcategory_id
     where t.kind in ('income','expense') and t.occurred_on between $from and $to
     group by t.occurred_on, t.kind, t.category_id, t.subcategory_id
     order by t.occurred_on, t.category_id`,
    { $from: from, $to: to },
  );
}

export interface PeriodCategoryRow {
  period: string;
  kind: 'income' | 'expense';
  category_name: string;
  amount_idr: number;
}

// Per period, kind and category, optionally for one account only.
export async function listPeriodCategoryRows(db: Db, fromPeriod: string, toPeriod: string, accountId: number | null): Promise<PeriodCategoryRow[]> {
  return db.getAllAsync<PeriodCategoryRow>(
    `select t.period, t.kind, c.name as category_name, sum(t.amount_idr) as amount_idr
     from v_tx t
     join categories c on c.id = t.category_id
     where t.kind in ('income','expense') and t.period between $from and $to
       and ($account is null or t.account_id = $account)
     group by t.period, t.kind, c.name`,
    { $from: fromPeriod, $to: toPeriod, $account: accountId },
  );
}
