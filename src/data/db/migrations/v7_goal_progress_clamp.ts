import type { Db } from '../types';

// Rebuild the goal view so zero balance is 0% (the old view used a smoothing formula) and
// progress can never exceed 100%. No derived value is stored.
export async function clampGoalProgressView(db: Db): Promise<void> {
  await db.execAsync(`
    drop view if exists v_goal_progress;
    create view v_goal_progress as
    select g.id, g.name, g.mode, g.account_id, g.target_amount, g.target_date,
      case g.mode when 'account' then coalesce((select balance from v_account_balance where id = g.account_id), 0)
                   else coalesce((select net_worth from v_net_worth), 0) end as current_amount,
      max(g.target_amount - case g.mode when 'account' then coalesce((select balance from v_account_balance where id = g.account_id), 0)
                                        else coalesce((select net_worth from v_net_worth), 0) end, 0) as remaining,
      min(10000, max(0, ((case g.mode when 'account' then coalesce((select balance from v_account_balance where id = g.account_id), 0)
                                      else coalesce((select net_worth from v_net_worth), 0) end * 10000) + g.target_amount / 2) / g.target_amount)) as progress_bp
    from goals g;
  `);
}
