// Pure alert evaluator — no React, no expo deps.
// Compares prev/next budget+goal state and returns new inbox items.
import type { AlertState, BudgetAlertItem, GoalAlertItem, InboxItem, NotifPrefs } from './types';

const NEAR_THRESHOLD_BP = 8000;  // 80%
const OVER_THRESHOLD_BP = 10000; // 100%
const GOAL_MILESTONES = [10000, 7500, 5000] as const; // descending

/** Returns the highest milestone crossed by progressBp, or null. */
function highestMilestone(bp: number): 5000 | 7500 | 10000 | null {
  for (const m of GOAL_MILESTONES) {
    if (bp >= m) return m;
  }
  return null;
}

export function evaluateAlerts(
  prev: AlertState,
  next: AlertState,
  prefs: NotifPrefs,
  /** Set of dedupe_keys already in the notifications table (for idempotence). */
  existingKeys: Set<string>,
): InboxItem[] {
  const now = new Date().toISOString();
  const results: InboxItem[] = [];

  // --- budget alerts ---
  const prevBudgetMap = new Map<number, BudgetAlertItem>(prev.budgets.map(b => [b.budget_id, b]));

  for (const nb of next.budgets) {
    // Only alert on current period items matching next.periodStart
    if (nb.periodStart !== next.periodStart) continue;

    const pb = prevBudgetMap.get(nb.budget_id);
    const prevBp = pb?.usedBp ?? 0;
    const nextBp = nb.usedBp;

    if (prefs.notif_budget_over === '1' && nextBp >= OVER_THRESHOLD_BP) {
      const key = `budget_over:${nb.budget_id}:${nb.periodStart}`;
      if (!existingKeys.has(key)) {
        results.push({
          kind: 'budget_over',
          dedupe_key: key,
          ref_type: 'budget',
          ref_id: nb.budget_id,
          payload: {
            kind: 'budget_over',
            budgetId: nb.budget_id,
            categoryName: nb.categoryName,
            usedBp: nextBp,
            spentAmount: nb.spentAmount,
            limitAmount: nb.limitAmount,
            periodStart: nb.periodStart,
          },
          created_at: now,
        });
      }
    } else if (
      prefs.notif_budget_near === '1' &&
      nextBp >= NEAR_THRESHOLD_BP &&
      nextBp < OVER_THRESHOLD_BP &&
      prevBp < NEAR_THRESHOLD_BP
    ) {
      const key = `budget_near:${nb.budget_id}:${nb.periodStart}`;
      if (!existingKeys.has(key)) {
        results.push({
          kind: 'budget_near',
          dedupe_key: key,
          ref_type: 'budget',
          ref_id: nb.budget_id,
          payload: {
            kind: 'budget_near',
            budgetId: nb.budget_id,
            categoryName: nb.categoryName,
            usedBp: nextBp,
            spentAmount: nb.spentAmount,
            limitAmount: nb.limitAmount,
            daysLeft: nb.daysLeft,
            periodStart: nb.periodStart,
          },
          created_at: now,
        });
      }
    }
  }

  // --- goal alerts ---
  const prevGoalMap = new Map<number, GoalAlertItem>(prev.goals.map(g => [g.goal_id, g]));

  for (const ng of next.goals) {
    const pg = prevGoalMap.get(ng.goal_id);
    const prevBp = pg?.progressBp ?? 0;
    const nextBp = ng.progressBp;

    if (prefs.notif_goal !== '1') continue;

    const prevMilestone = highestMilestone(prevBp);
    const nextMilestone = highestMilestone(nextBp);

    if (nextMilestone !== null && nextMilestone !== prevMilestone) {
      const key = `goal:${ng.goal_id}:${nextMilestone}:${ng.targetAmount}`;
      if (!existingKeys.has(key)) {
        results.push({
          kind: 'goal_milestone',
          dedupe_key: key,
          ref_type: 'goal',
          ref_id: ng.goal_id,
          payload: {
            kind: 'goal_milestone',
            goalId: ng.goal_id,
            goalName: ng.goalName,
            milestone: nextMilestone,
            targetAmount: ng.targetAmount,
            currentAmount: ng.currentAmount,
          },
          created_at: now,
        });
      }
    }
  }

  return results;
}
