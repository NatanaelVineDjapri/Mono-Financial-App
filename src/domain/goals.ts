// Progress is never typed in — always v_goal_progress, which reads the linked account's
// balance or net worth live. This file is mostly a thin pass-through with error mapping.
import * as repo from '../data/repo/goals';
import type { GoalProgressRow, NewGoal } from '../data/repo/goals';
import type { Db } from '../data/db/types';
import { throwDomainError } from './errors';

export async function createGoal(db: Db, input: NewGoal, now: string): Promise<number> {
  try {
    return await repo.createGoal(db, input, now);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function updateGoal(db: Db, id: number, patch: Parameters<typeof repo.updateGoal>[2]): Promise<void> {
  try {
    await repo.updateGoal(db, id, patch);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function deleteGoal(db: Db, id: number): Promise<void> {
  try {
    await repo.deleteGoal(db, id);
  } catch (err) {
    throwDomainError(err);
  }
}

export function listGoalProgress(db: Db): Promise<GoalProgressRow[]> {
  return repo.listGoalProgress(db);
}

export function getGoalProgress(db: Db, id: number): Promise<GoalProgressRow | null> {
  return repo.getGoalProgress(db, id);
}
