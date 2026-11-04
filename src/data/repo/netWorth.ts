// v_net_worth and v_net_worth_by_month are cross-account aggregates, not one of the
// per-aggregate repo files from the previous step — small enough to live on their own.
import type { Db } from '../db/types';

export interface NetWorthRow {
  net_worth: number;
  incomplete: number; // 1 when any pocket has no fx rate yet
}

export async function getNetWorth(db: Db): Promise<NetWorthRow> {
  // v_net_worth is a single-row aggregate; it always returns exactly one row.
  return (await db.getFirstAsync<NetWorthRow>('select * from v_net_worth'))!;
}

export interface NetWorthByMonthRow {
  month: string;
  net_worth: number;
}

export async function listNetWorthByMonth(db: Db): Promise<NetWorthByMonthRow[]> {
  return db.getAllAsync<NetWorthByMonthRow>('select * from v_net_worth_by_month order by month');
}
