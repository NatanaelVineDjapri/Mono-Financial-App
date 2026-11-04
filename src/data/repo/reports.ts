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
