// Pure goal presentation rules. Balances remain in v_goal_progress; these helpers only
// transform already-derived integer values into progress and an estimate for the UI.
export function clampGoalProgressBp(balance: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(10000, Math.max(0, Math.floor(((balance * 10000) + Math.floor(target / 2)) / target)));
}

export function goalIsAchieved(balance: number, target: number): boolean {
  return balance >= target;
}

export function fullMonthsUntil(today: string, targetDate: string): number {
  const [ty, tm, td] = today.split('-').map(Number);
  const [y, m, d] = targetDate.split('-').map(Number);
  const diff = (y - ty) * 12 + (m - tm);
  if (targetDate < today) return 0;
  return Math.max(1, diff - (d < td ? 1 : 0));
}

export function neededGoalPace(remaining: number, months: number | null): number | null {
  if (remaining <= 0 || months == null || months <= 0) return null;
  return Math.ceil(remaining / months);
}
