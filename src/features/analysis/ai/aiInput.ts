// Builds what the optional AI review is allowed to see (see src/features/ai_chat/analysisAi.ts for the full list
// of what is and is not sent). Read only: it takes the figures the score already has, adds spending per category
// and the biggest expenses of the period, and hands over a plain object. Account names, balances, goals and notes
// are never read here.
import type { Db } from '@/data/db/types';
import { listTopExpenses } from '@/data/repo/analysis';
import { listCategorySpendRange } from '@/data/repo/reports';
import { ANALYSIS_TOP_EXPENSES } from '@/features/ai_chat/config';
import type { AnalysisAiInput } from '@/features/ai_chat/analysisAi';
import { getLanguage } from '@/i18n/lang';

import type { AnalysisData } from '../data';

export async function buildAnalysisAiInput(db: Db, data: AnalysisData): Promise<AnalysisAiInput | null> {
  const { analysis } = data;
  const { result, input } = analysis;
  if (!result.eligible) return null;

  const [spend, top] = await Promise.all([
    listCategorySpendRange(db, data.period, data.period),
    listTopExpenses(db, data.rangeStart, data.rangeEnd, ANALYSIS_TOP_EXPENSES),
  ]);
  const spendTotal = spend.reduce((sum, row) => sum + row.spent, 0);
  const metric = (id: string) => result.components.find(c => c.id === id)?.metric ?? null;
  const savingsBp = metric('savings');
  const emergency = metric('emergency'); // hundredths of a month

  return {
    language: getLanguage(),
    period: data.period,
    running: data.running,
    today: data.today,
    score: result.score,
    band: result.band,
    parts: result.components.map(c => ({ id: c.id, points: c.points, max: c.max, ratioPct: Math.round(c.ratioBp / 100), counted: !c.skipped })),
    income: input.income,
    expense: input.expense,
    savingsRatePct: savingsBp === null ? null : Math.round(savingsBp / 100),
    emergencyMonths: emergency === null ? null : Math.round(emergency / 10) / 10,
    fixedMonthly: input.fixedMonthly,
    budgets: input.budgets.map(b => ({ category: b.name, limit: b.limit, spent: b.spent })),
    categories: spend
      .filter(row => row.spent > 0)
      .slice(0, 8)
      .map(row => ({ category: row.category_name, amount: row.spent, sharePct: spendTotal > 0 ? Math.round((row.spent * 100) / spendTotal) : 0 })),
    trend: data.trend.map(t => ({ period: t.period, score: t.score })),
    topExpenses: top.map(t => ({ date: t.occurred_on, description: t.description, category: t.category ?? '', amount: t.amount_idr })),
  };
}

// The review is asked again only when something it says could have changed: the period, the score or the totals.
export function analysisAiFingerprint(data: AnalysisData): string {
  const { result, input } = data.analysis;
  const spent = input.budgets.reduce((sum, b) => sum + b.spent, 0);
  return [data.period, result.eligible ? result.score : 'x', input.income, input.expense, input.fixedMonthly, spent, input.budgets.length].join('|');
}
