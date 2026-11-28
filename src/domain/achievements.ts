// Streak and achievements (asked for by the owner). A streak is days in a row with at least one record (by the record's
// own date); it stays alive until the end of today. Every achievement is worked out from the data each time, so nothing
// is stored and nothing can drift: deleting the records that earned one takes it away again.
import { addDays, periodOfDate } from '../core/date';
import * as repo from '../data/repo/achievements';
import type { Db } from '../data/db/types';
import { getSavingsTarget } from './savings';
import { getMonthStartDay } from './transactionsList';

export interface Streak {
  current: number;
  longest: number;
  todayDone: boolean;
}

// `days`: the days with a record, sorted ascending, each once.
export function streakOf(days: readonly string[], today: string): Streak {
  let longest = 0;
  let run = 0;
  let previous = '';
  for (const day of days) {
    if (day > today) break;
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    previous = day;
    if (run > longest) longest = run;
  }
  const todayDone = previous === today;
  // yesterday's run still counts: today is not over
  const alive = todayDone || previous === addDays(today, -1);
  return { current: alive ? run : 0, longest, todayDone };
}

export interface AchievementFacts {
  today: string;
  days: readonly string[];
  records: number;
  accounts: number;
  backups: number;
  budgets: number;
  goalsReached: number;
  debtsSettled: number;
  netWorth: number;
  netWorthByMonth: readonly number[];
  finished: readonly { period: string; income: number; net: number }[]; // finished months with records
  savingsTarget: number | null;
  monthsWithinBudgets: number;
  monthsWithinLimit: readonly string[];
}

export interface Achievement {
  id: number; // 1..30, also the badge picture's number
  earned: boolean;
  progress: { value: number; target: number } | null; // for the countable ones, while locked
}

// a calendar month other than a running one with a record on each of its days
function hasFullMonth(days: readonly string[]): boolean {
  const perMonth = new Map<string, number>();
  for (const day of days) perMonth.set(day.slice(0, 7), (perMonth.get(day.slice(0, 7)) ?? 0) + 1);
  return [...perMonth].some(([month, count]) => count === new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate());
}

// the most months in a row, from a sorted list of 'YYYY-MM'
function longestMonthRun(months: readonly string[]): number {
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const month of months) {
    const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
    run = previous !== null && index === previous + 1 ? run + 1 : 1;
    previous = index;
    longest = Math.max(longest, run);
  }
  return longest;
}

// the most month-to-month rises in a row
function longestRise(values: readonly number[]): number {
  let longest = 0;
  let run = 0;
  for (let i = 1; i < values.length; i++) {
    run = values[i] > values[i - 1] ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export const ACHIEVEMENT_COUNT = 30;
const MASTER = 26;
const MASTER_NEEDS = 20;

export function achievementsFrom(facts: AchievementFacts): Achievement[] {
  const { longest } = streakOf(facts.days, facts.today);
  const count = (value: number, target: number) => ({ earned: value >= target, progress: { value: Math.min(value, target), target } });
  const flag = (earned: boolean) => ({ earned, progress: null });
  const rise = longestRise(facts.netWorthByMonth);
  const first = facts.days[0];
  const target = facts.savingsTarget;

  const rules: Record<number, { earned: boolean; progress: Achievement['progress'] }> = {
    1: flag(facts.records >= 1),
    2: count(facts.days.length, 50),
    3: flag(hasFullMonth(facts.days)),
    4: count(longest, 3),
    5: count(longest, 365),
    6: count(longest, 7),
    7: count(longest, 14),
    8: count(longest, 30),
    9: count(longest, 60),
    10: count(longest, 100),
    11: flag(rise >= 1),
    12: count(rise, 3),
    13: flag(facts.goalsReached > 0),
    14: flag(target != null && target > 0 && facts.finished.some(m => m.net >= target)),
    15: flag(facts.finished.some(m => m.income > 0 && m.net > 0)),
    16: count(facts.accounts, 3),
    17: count(facts.accounts, 5),
    18: flag(facts.backups > 0),
    19: flag(facts.budgets > 0),
    20: count(facts.records, 100),
    21: count(facts.records, 500),
    22: flag(facts.netWorth >= 10_000_000),
    23: flag(facts.netWorth >= 100_000_000),
    24: flag(facts.monthsWithinBudgets > 0),
    25: flag(facts.debtsSettled > 0),
    27: count(longestMonthRun(facts.monthsWithinLimit), 3),
    28: flag(!!first && first <= addDays(facts.today, -365)),
    29: count(facts.records, 1000),
    30: flag(facts.finished.some(m => m.income > 0 && m.net * 2 >= m.income)),
  };
  const others = Object.values(rules).filter(r => r.earned).length;
  rules[MASTER] = count(others, MASTER_NEEDS);
  return Array.from({ length: ACHIEVEMENT_COUNT }, (_, i) => {
    const rule = rules[i + 1];
    return { id: i + 1, earned: rule.earned, progress: rule.earned ? null : rule.progress };
  });
}

export async function getStreak(db: Db, today: string): Promise<Streak> {
  return streakOf(await repo.listRecordDays(db), today);
}

export async function getAchievements(db: Db, today: string): Promise<{ streak: Streak; days: string[]; achievements: Achievement[] }> {
  const period = periodOfDate(today, await getMonthStartDay(db));
  const [days, counts, finished, netWorthByMonth, savingsTarget, monthsWithinBudgets, monthsWithinLimit] = await Promise.all([
    repo.listRecordDays(db),
    repo.getAchievementCounts(db),
    repo.listPeriodFlows(db, period),
    repo.listNetWorthByMonth(db),
    getSavingsTarget(db),
    repo.countMonthsWithinBudgets(db, period),
    repo.listMonthsWithinLimit(db, period),
  ]);
  return {
    streak: streakOf(days, today),
    days,
    achievements: achievementsFrom({ today, days, ...counts, finished, netWorthByMonth, savingsTarget, monthsWithinBudgets, monthsWithinLimit }),
  };
}
