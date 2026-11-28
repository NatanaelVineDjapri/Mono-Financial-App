// What the streak and the achievements are worked out from (src/domain/achievements.ts). Only reads: nothing about an
// achievement is stored.
import type { Db } from '../db/types';

// Every day that has at least one record, oldest first.
export async function listRecordDays(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>('select distinct occurred_on as day from transactions order by day');
  return rows.map(r => r.day);
}

export interface AchievementCounts {
  records: number;
  accounts: number;
  backups: number;
  budgets: number;
  goalsReached: number;
  debtsSettled: number;
  netWorth: number;
}

export async function getAchievementCounts(db: Db): Promise<AchievementCounts> {
  return (await db.getFirstAsync<AchievementCounts>(
    `select (select count(*) from transactions) as records,
            (select count(*) from accounts where archived = 0) as accounts,
            (select count(*) from backup_log) as backups,
            (select count(*) from budgets) as budgets,
            (select count(*) from v_goal_progress where progress_bp >= 10000) as goalsReached,
            (select count(*) from debts d join v_account_balance v on v.id = d.account_id where v.balance = 0) as debtsSettled,
            (select net_worth from v_net_worth) as netWorth`,
  ))!;
}

export async function listPeriodFlows(db: Db, before: string): Promise<{ period: string; income: number; net: number }[]> {
  return db.getAllAsync('select period, income, net from v_period_flow where period < $before order by period', { $before: before });
}

// Finished months with at least one budget and none of them over.
export async function countMonthsWithinBudgets(db: Db, before: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'select count(*) as n from (select month from v_budget_status where month < $before group by month having sum(is_over) = 0)',
    { $before: before },
  );
  return row!.n;
}

// The finished months that stayed within their monthly limit, oldest first.
export async function listMonthsWithinLimit(db: Db, before: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ month: string }>('select month from v_month_budget where month < $before and total_spent <= monthly_limit order by month', { $before: before });
  return rows.map(r => r.month);
}

export async function listNetWorthByMonth(db: Db): Promise<number[]> {
  const rows = await db.getAllAsync<{ net_worth: number }>('select net_worth from v_net_worth_by_month order by month');
  return rows.map(r => r.net_worth);
}
