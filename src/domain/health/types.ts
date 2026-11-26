// Types of the financial health score (the Analysis tab). Pure data: no database, no React.
// Money is a whole-rupiah integer, ratios are basis points (10000 = 100%).

export type ComponentId = 'savings' | 'budget' | 'emergency' | 'fixed' | 'wealth';

// The weights of the five parts when all five are counted. They add up to 100.
export const BASE_WEIGHTS: Readonly<Record<ComponentId, number>> = {
  savings: 25,
  budget: 25,
  emergency: 20,
  fixed: 15,
  wealth: 15,
};

export const COMPONENT_IDS: readonly ComponentId[] = ['savings', 'budget', 'emergency', 'fixed', 'wealth'];

// Thresholds. Named so the screens and the "how it is calculated" page read the same numbers.
export const SAVINGS_FULL_BP = 2000; // 20% of income saved: full points
export const EMERGENCY_FULL_MONTHS = 6; // 6 months of expenses in the bank: full points
export const FIXED_FULL_BP = 2000; // fixed expenses at 20% of income or less: full points
export const FIXED_ZERO_BP = 4000; // 40% or more: no points
export const WEALTH_MAX_POINTS = 6; // net worth at the end of up to 6 periods (5 comparisons)
export const YOUNG_PERIOD_DAYS = 10; // before this day the previous full period stands in for the expenses
export const MIN_TRANSACTIONS = 10;
export const MIN_SPAN_DAYS = 28;
export const MIN_ACCOUNTS = 1;
// Saving a smaller share than the period before costs points: one for every 2 points of savings rate lost, up to 15.
// Not before day YOUNG_PERIOD_DAYS of a period, when the salary may simply not be in yet.
export const SAVINGS_DROP_STEP_BP = 200;
export const SAVINGS_DROP_MAX = 15;

export interface SavingsDrop {
  points: number; // taken off the score (at least 1)
  fromBp: number; // savings rate of the period before
  toBp: number; // savings rate of this period
}

export type HealthBand = 'healthy' | 'fair' | 'weak' | 'needs_work';

// The lowest score of each band (below WEAK_FROM it is 'needs_work'). One source for bandFor and the how-to page.
export const BAND_FROM = { healthy: 80, fair: 60, weak: 40 } as const;

// The score range of each band, best first (for the how-to page).
export const BAND_RANGES: readonly { band: HealthBand; from: number; to: number }[] = [
  { band: 'healthy', from: BAND_FROM.healthy, to: 100 },
  { band: 'fair', from: BAND_FROM.fair, to: BAND_FROM.healthy - 1 },
  { band: 'weak', from: BAND_FROM.weak, to: BAND_FROM.fair - 1 },
  { band: 'needs_work', from: 0, to: BAND_FROM.weak - 1 },
];

export interface BudgetLine {
  limit: number;
  spent: number;
}

export interface HealthInput {
  income: number; // income of the period (transfers are not income)
  expense: number; // consumption expenses of the period (transfers are not expenses)
  budgets: BudgetLine[]; // this period's budgets
  balance: number; // all accounts together, the net worth value
  fixedMonthly: number; // estimated fixed expenses per month
  netWorthSeries: number[]; // net worth at the end of each period, oldest first, up to 6 points
  dayOfPeriod: number; // days into the running period (1 = first day)
  previousExpense: number | null; // expenses of the previous full period, null when there is none
  previousIncome?: number | null; // its income; without it there is no savings-drop penalty
  transactionCount: number;
  dataSpanDays: number; // days between the first record and the end of the period
  accountCount: number;
}

export interface HealthComponent {
  id: ComponentId;
  points: number; // rounded, already counted into the score
  max: number; // the weight after sharing (0 when skipped)
  ratioBp: number; // how full the component is, 0..10000
  skipped: boolean;
  // The raw figure the sentence on screen quotes (null when there is none):
  //  savings   savings rate in basis points (can be negative)
  //  budget    number of budgets inside their limit
  //  emergency months of expenses covered, in hundredths (209 = 2,09 months)
  //  fixed     fixed expenses as basis points of income
  //  wealth    number of periods in which net worth rose
  metric: number | null;
}

export interface EligibilityCheck {
  id: 'accounts' | 'transactions' | 'span';
  met: boolean;
  have: number;
  need: number;
}

export type HealthResult =
  | {
      eligible: true;
      score: number;
      band: HealthBand;
      components: HealthComponent[];
      countedOf: number; // how many of the 5 parts were counted
      drop: SavingsDrop | null; // already taken off `score`
    }
  | { eligible: false; checks: EligibilityCheck[] };
