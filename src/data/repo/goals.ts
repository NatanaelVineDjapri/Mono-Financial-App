import type { Db } from '../db/types';

export type GoalMode = 'account' | 'total_assets';

export interface NewGoal {
  name: string;
  mode: GoalMode;
  accountId?: number | null; // required when mode = 'account'
  targetAmount: number;
  targetDate?: string | null;
  sortOrder?: number;
}

export interface GoalRow {
  id: number;
  name: string;
  mode: GoalMode;
  account_id: number | null;
  target_amount: number;
  target_date: string | null;
  sort_order: number;
  created_at: string;
}

export async function createGoal(db: Db, input: NewGoal, now: string): Promise<number> {
  const result = await db.runAsync(
    'insert into goals (name, mode, account_id, target_amount, target_date, sort_order, created_at) values ($name, $mode, $accountId, $targetAmount, $targetDate, $sortOrder, $now)',
    {
      $name: input.name,
      $mode: input.mode,
      $accountId: input.accountId ?? null,
      $targetAmount: input.targetAmount,
      $targetDate: input.targetDate ?? null,
      $sortOrder: input.sortOrder ?? 0,
      $now: now,
    },
  );
  return result.lastInsertRowId;
}

export async function updateGoal(
  db: Db,
  id: number,
  patch: Partial<Pick<NewGoal, 'name' | 'targetAmount' | 'targetDate' | 'sortOrder'>>,
): Promise<void> {
  const fields: string[] = [];
  const params: Record<string, string | number | null> = { $id: id };
  if (patch.name !== undefined) { fields.push('name = $name'); params.$name = patch.name; }
  if (patch.targetAmount !== undefined) { fields.push('target_amount = $targetAmount'); params.$targetAmount = patch.targetAmount; }
  if (patch.targetDate !== undefined) { fields.push('target_date = $targetDate'); params.$targetDate = patch.targetDate; }
  if (patch.sortOrder !== undefined) { fields.push('sort_order = $sortOrder'); params.$sortOrder = patch.sortOrder; }
  if (fields.length === 0) return;
  await db.runAsync(`update goals set ${fields.join(', ')} where id = $id`, params);
}

export async function deleteGoal(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from goals where id = $id', { $id: id });
}

export interface GoalProgressRow {
  id: number;
  name: string;
  mode: GoalMode;
  account_id: number | null;
  target_amount: number;
  target_date: string | null;
  current_amount: number;
  remaining: number;
  progress_bp: number;
}

export async function listGoalProgress(db: Db): Promise<GoalProgressRow[]> {
  // v_goal_progress does not expose sort_order; it is ordered by id.
  return db.getAllAsync<GoalProgressRow>('select * from v_goal_progress order by id');
}

export async function getGoalProgress(db: Db, id: number): Promise<GoalProgressRow | null> {
  return db.getFirstAsync<GoalProgressRow>('select * from v_goal_progress where id = $id', { $id: id });
}
