// The savings budget: one target per month, "put this much aside". What counts as saved is the period's income minus its
// expenses (v_period_flow; transfers are neither), so nothing extra is recorded. Only the target is stored (a setting,
// so it is in the backup); what was saved and how far along are read every time.
import type { Db } from '../data/db/types';
import { getPeriodFlow } from '../data/repo/reports';
import { getSetting, setSetting } from '../data/repo/settings';
import { mulDivRound } from './health/score';

export const SAVINGS_TARGET_KEY = 'savings_target';

export interface SavingsStatus {
  target: number | null; // rupiah per period; null: none set
  income: number;
  expense: number;
  saved: number; // income - expense; negative when more went out than came in
  remaining: number; // still to save to reach the target, never negative
  progressBp: number; // 0..10000 and beyond; 0 when nothing is saved or there is no target
}

export async function getSavingsTarget(db: Db): Promise<number | null> {
  const value = Number(await getSetting(db, SAVINGS_TARGET_KEY));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// null removes the target.
export async function setSavingsTarget(db: Db, amount: number | null): Promise<void> {
  if (amount !== null && !(Number.isSafeInteger(amount) && amount > 0)) throw new Error('setSavingsTarget: a whole rupiah amount above zero');
  await setSetting(db, SAVINGS_TARGET_KEY, amount === null ? '' : String(amount));
}

export async function getSavingsStatus(db: Db, period: string): Promise<SavingsStatus> {
  const [target, flow] = await Promise.all([getSavingsTarget(db), getPeriodFlow(db, period)]);
  const income = flow?.income ?? 0;
  const expense = flow?.expense ?? 0;
  const saved = income - expense;
  return {
    target,
    income,
    expense,
    saved,
    remaining: target === null ? 0 : Math.max(0, target - saved),
    progressBp: target === null || saved <= 0 ? 0 : mulDivRound(saved, 10000, target),
  };
}
