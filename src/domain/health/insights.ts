// What the Analysis screen says besides the score: what could raise it, what to watch, what is already good.
// Pure and structured: this file decides WHICH facts to show and computes their numbers (the gain in points of
// each suggestion is simulated with the same computeHealth, so it is the real difference); the sentences are
// written elsewhere, from templates (src/features/analysis/copy.ts). No language model is involved.
import { computeHealth, emergencyExpenseBase, mulDivRound } from './score';
import {
  BASE_WEIGHTS,
  COMPONENT_IDS,
  EMERGENCY_FULL_MONTHS,
  FIXED_FULL_BP,
  SAVINGS_FULL_BP,
  type BudgetLine,
  type ComponentId,
  type HealthInput,
  type HealthResult,
} from './types';

export interface NamedBudget extends BudgetLine {
  categoryId: number;
  name: string;
}

export interface InsightInput extends HealthInput {
  budgets: NamedBudget[];
  daysLeft: number | null; // days left in the period; null when the period is over
}

type Scored = Extract<HealthResult, { eligible: true }>;

export const MAX_IMPROVEMENTS = 3;
export const MAX_GOOD = 3;
export const GOOD_FROM_BP = 8000; // a component at 80% or more counts as "already good"
export const WATCH_FROM_BP = 9000; // a budget at 90% or more of its limit (and not over) is worth a warning
export const EMERGENCY_STEP_MONTHS = 3; // the first goal of the emergency fund

export type Improvement =
  | {
      kind: 'budget_over';
      points: number;
      categoryId: number;
      name: string;
      spent: number;
      limit: number;
      overBy: number;
      usedBp: number;
      overCount: number; // how many budgets are over, this one included
      daysLeft: number | null;
    }
  | { kind: 'emergency'; points: number; monthsX100: number; targetMonths: number; addAmount: number }
  | { kind: 'savings'; points: number; savingsBp: number; cutAmount: number }
  | { kind: 'fixed'; points: 0; fixedBp: number };

export interface Watch {
  categoryId: number;
  name: string;
  spent: number;
  limit: number;
  remaining: number;
  usedBp: number;
  daysLeft: number;
  other: { name: string; usedBp: number } | null; // the next budget that is also close to its limit
}

export type Good =
  | { id: 'savings'; savingsBp: number }
  | { id: 'budget'; within: number; total: number }
  | { id: 'emergency'; monthsX100: number }
  | { id: 'fixed'; amount: number; bp: number }
  | { id: 'wealth'; rose: boolean; netWorth: number; change: number; changeBp: number | null; rises: number; comparisons: number };

export interface Insights {
  improvements: Improvement[];
  watch: Watch | null;
  good: Good[];
  strongestId: ComponentId | null; // highest ratio among the counted parts
  weakestId: ComponentId | null; // lowest ratio among the counted parts; null when all are full ("Terendah" tag)
  weakIds: ComponentId[]; // parts that are not full (bar the strongest, when it is good), lowest first, at most 2
}

const KIND_ORDER: Improvement['kind'][] = ['budget_over', 'emergency', 'savings', 'fixed'];

function usedBp(spent: number, limit: number): number {
  return limit > 0 ? mulDivRound(spent, 10000, limit) : 0;
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function gain(input: InsightInput, scored: Scored, patch: Partial<HealthInput>): number {
  const simulated = computeHealth({ ...input, ...patch });
  return simulated.eligible ? simulated.score - scored.score : 0;
}

function budgetImprovement(input: InsightInput, scored: Scored): Improvement | null {
  const over = input.budgets.filter(b => b.spent > b.limit);
  if (over.length === 0) return null;
  const points = gain(input, scored, { budgets: input.budgets.map(b => (b.spent > b.limit ? { ...b, spent: b.limit } : b)) });
  if (points <= 0) return null;
  const worst = [...over].sort((a, b) => b.spent - b.limit - (a.spent - a.limit) || a.categoryId - b.categoryId)[0];
  return {
    kind: 'budget_over',
    points,
    categoryId: worst.categoryId,
    name: worst.name,
    spent: worst.spent,
    limit: worst.limit,
    overBy: worst.spent - worst.limit,
    usedBp: usedBp(worst.spent, worst.limit),
    overCount: over.length,
    daysLeft: input.daysLeft,
  };
}

function emergencyImprovement(input: InsightInput, scored: Scored): Improvement | null {
  const part = scored.components.find(c => c.id === 'emergency');
  const base = emergencyExpenseBase(input);
  if (!part || part.metric === null || base <= 0 || part.metric >= EMERGENCY_FULL_MONTHS * 100) return null;
  const targetMonths = part.metric >= EMERGENCY_STEP_MONTHS * 100 ? EMERGENCY_FULL_MONTHS : EMERGENCY_STEP_MONTHS;
  const targetBalance = targetMonths * base;
  const points = gain(input, scored, { balance: targetBalance });
  if (points <= 0) return null;
  return { kind: 'emergency', points, monthsX100: part.metric, targetMonths, addAmount: targetBalance - input.balance };
}

function savingsImprovement(input: InsightInput, scored: Scored): Improvement | null {
  const part = scored.components.find(c => c.id === 'savings');
  if (!part || part.metric === null || input.income <= 0 || part.metric >= SAVINGS_FULL_BP) return null;
  // expenses that leave exactly 20% of the income (rounded up in favour of the person)
  const targetExpense = input.income - ceilDiv(input.income * SAVINGS_FULL_BP, 10000);
  const cutAmount = input.expense - targetExpense;
  if (cutAmount <= 0) return null;
  // Lower expenses also stretch the emergency fund, so this is the real difference in the whole score.
  const points = gain(input, scored, { expense: targetExpense });
  if (points <= 0) return null;
  return { kind: 'savings', points, savingsBp: part.metric, cutAmount };
}

function fixedImprovement(scored: Scored): Improvement | null {
  const part = scored.components.find(c => c.id === 'fixed');
  if (!part || part.skipped || part.metric === null || part.metric <= FIXED_FULL_BP) return null;
  return { kind: 'fixed', points: 0, fixedBp: part.metric };
}

function improvements(input: InsightInput, scored: Scored): Improvement[] {
  const all = [budgetImprovement(input, scored), emergencyImprovement(input, scored), savingsImprovement(input, scored), fixedImprovement(scored)]
    .filter((x): x is Improvement => x !== null);
  all.sort((a, b) => b.points - a.points || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return all.slice(0, MAX_IMPROVEMENTS);
}

function watch(input: InsightInput): Watch | null {
  if (input.daysLeft === null) return null;
  const near = input.budgets
    .filter(b => b.limit > 0 && b.spent <= b.limit && b.spent * 10000 >= b.limit * WATCH_FROM_BP)
    .map(b => ({ b, remaining: b.limit - b.spent, used: usedBp(b.spent, b.limit) }))
    .sort((x, y) => x.remaining - y.remaining || y.used - x.used || x.b.categoryId - y.b.categoryId);
  if (near.length === 0) return null;
  const first = near[0];
  // "the other" is the one closest to its limit by share, not by what is left
  const others = near.slice(1).sort((x, y) => y.used - x.used || x.b.categoryId - y.b.categoryId);
  return {
    categoryId: first.b.categoryId,
    name: first.b.name,
    spent: first.b.spent,
    limit: first.b.limit,
    remaining: first.remaining,
    usedBp: first.used,
    daysLeft: input.daysLeft,
    other: others[0] ? { name: others[0].b.name, usedBp: others[0].used } : null,
  };
}

function goodList(input: InsightInput, scored: Scored): Good[] {
  const ranked = scored.components
    .filter(c => !c.skipped && c.ratioBp >= GOOD_FROM_BP)
    .sort((a, b) => b.ratioBp - a.ratioBp || COMPONENT_IDS.indexOf(a.id) - COMPONENT_IDS.indexOf(b.id))
    .slice(0, MAX_GOOD);
  const out: Good[] = [];
  for (const c of ranked) {
    const metric = c.metric ?? 0;
    switch (c.id) {
      case 'savings':
        out.push({ id: 'savings', savingsBp: metric });
        break;
      case 'budget':
        out.push({ id: 'budget', within: metric, total: input.budgets.length });
        break;
      case 'emergency':
        out.push({ id: 'emergency', monthsX100: c.metric ?? EMERGENCY_FULL_MONTHS * 100 });
        break;
      case 'fixed':
        out.push({ id: 'fixed', amount: input.fixedMonthly, bp: metric });
        break;
      case 'wealth': {
        const series = input.netWorthSeries.slice(-6);
        const last = series[series.length - 1];
        const prev = series[series.length - 2];
        const change = last - prev;
        out.push({
          id: 'wealth',
          rose: change > 0,
          netWorth: last,
          change,
          // like Reports: the base is |previous|, so a month end below zero still reads
          changeBp: prev === 0 ? null : mulDivRound(Math.abs(change), 10000, Math.abs(prev)) * (change < 0 ? -1 : 1),
          rises: metric,
          comparisons: series.length - 1,
        });
        break;
      }
    }
  }
  return out;
}

function extremes(scored: Scored): { strongestId: ComponentId | null; weakestId: ComponentId | null; weakIds: ComponentId[] } {
  const counted = scored.components.filter(c => !c.skipped);
  if (counted.length === 0) return { strongestId: null, weakestId: null, weakIds: [] };
  const strongest = [...counted].sort((a, b) => b.ratioBp - a.ratioBp || COMPONENT_IDS.indexOf(a.id) - COMPONENT_IDS.indexOf(b.id))[0];
  // the part furthest from full, in points it leaves on the table; ties go to the heavier part
  const weakest = [...counted].sort(
    (a, b) => a.ratioBp - b.ratioBp || BASE_WEIGHTS[b.id] - BASE_WEIGHTS[a.id] || COMPONENT_IDS.indexOf(a.id) - COMPONENT_IDS.indexOf(b.id),
  )[0];
  // What the summary sentence says "but" about: every part that is not full, apart from the one it praised, lowest first.
  const praised = strongest.ratioBp >= GOOD_FROM_BP ? strongest.id : null;
  const weakIds = counted
    .filter(c => c.ratioBp < 10000 && c.id !== praised)
    .sort((a, b) => a.ratioBp - b.ratioBp || BASE_WEIGHTS[b.id] - BASE_WEIGHTS[a.id] || COMPONENT_IDS.indexOf(a.id) - COMPONENT_IDS.indexOf(b.id))
    .slice(0, 2)
    .map(c => c.id);
  return { strongestId: strongest.id, weakestId: weakest.ratioBp < 10000 ? weakest.id : null, weakIds };
}

export function buildInsights(input: InsightInput, scored: Scored): Insights {
  return {
    improvements: improvements(input, scored),
    watch: watch(input),
    good: goodList(input, scored),
    ...extremes(scored),
  };
}
