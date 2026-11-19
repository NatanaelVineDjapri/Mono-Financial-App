// The worked examples on "How it is calculated" are not typed in: they are the real formula run on the October
// 2026 sample (DATABASE.md section 6), so the page can never disagree with the score. Only the raw sample facts
// are written here.
import { computeHealth, type HealthComponent, type HealthInput } from '@/domain/health';

export const EXAMPLE_INPUT: HealthInput = {
  income: 7_500_000,
  expense: 4_257_000,
  budgets: [
    { limit: 700_000, spent: 812_000 },
    { limit: 1_200_000, spent: 1_150_000 },
    { limit: 600_000, spent: 540_000 },
    { limit: 1_800_000, spent: 1_425_000 },
    { limit: 400_000, spent: 210_000 },
    { limit: 300_000, spent: 120_000 },
  ],
  balance: 8_880_000,
  fixedMonthly: 1_201_990,
  netWorthSeries: [2_200_000, 3_200_000, 4_200_000, 5_000_000, 5_637_000, 8_880_000],
  dayOfPeriod: 28,
  previousExpense: null,
  transactionCount: 18,
  dataSpanDays: 180,
  accountCount: 2,
};

export function exampleComponents(): HealthComponent[] {
  const result = computeHealth(EXAMPLE_INPUT);
  if (!result.eligible) throw new Error('the how-to example must be a scorable sample');
  return result.components;
}
