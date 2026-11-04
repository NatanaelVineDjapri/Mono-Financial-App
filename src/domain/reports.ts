// Thin reads: period flow, savings rate and category spend. All honour
// settings.month_start_day automatically, since that is baked into the views
// (v_tx's period expression), not re-implemented here.
import * as repo from '../data/repo/reports';
import type { CategorySpendRow, PeriodFlowRow, SavingsRateRow } from '../data/repo/reports';
import type { Db } from '../data/db/types';

export function getPeriodFlow(db: Db, period: string): Promise<PeriodFlowRow | null> {
  return repo.getPeriodFlow(db, period);
}

export function listPeriodFlow(db: Db): Promise<PeriodFlowRow[]> {
  return repo.listPeriodFlow(db);
}

export function getSavingsRate(db: Db, period: string): Promise<SavingsRateRow | null> {
  return repo.getSavingsRate(db, period);
}

export function listCategorySpend(db: Db, period: string): Promise<CategorySpendRow[]> {
  return repo.listCategorySpend(db, period);
}
