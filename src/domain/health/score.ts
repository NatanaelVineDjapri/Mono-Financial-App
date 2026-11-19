// The financial health score, from a formula (no AI, no network, nothing stored): five parts, each a ratio
// 0..100% of its weight, rounded half up to whole points; the score is the SUM of those rounded points, so the
// figures on screen always add up. A part without data is skipped and its weight is shared among the others
// (largest remainder, so the weights add up to exactly 100).
import {
  BAND_FROM,
  BASE_WEIGHTS,
  COMPONENT_IDS,
  EMERGENCY_FULL_MONTHS,
  FIXED_FULL_BP,
  FIXED_ZERO_BP,
  MIN_ACCOUNTS,
  MIN_SPAN_DAYS,
  MIN_TRANSACTIONS,
  SAVINGS_FULL_BP,
  WEALTH_MAX_POINTS,
  YOUNG_PERIOD_DAYS,
  type ComponentId,
  type EligibilityCheck,
  type HealthBand,
  type HealthComponent,
  type HealthInput,
  type HealthResult,
} from './types';

// a * b / c, rounded half away from zero, in BigInt: rupiah times basis points passes 2^53 for big amounts.
export function mulDivRound(a: number, b: number, c: number): number {
  if (c === 0) throw new Error('mulDivRound: division by zero');
  let n = BigInt(a) * BigInt(b);
  let d = BigInt(c);
  if (d < BigInt(0)) {
    n = -n;
    d = -d;
  }
  const neg = n < BigInt(0);
  const abs = neg ? -n : n;
  const r = (abs * BigInt(2) + d) / (d * BigInt(2));
  return Number(neg ? -r : r);
}

function clampBp(bp: number): number {
  return Math.max(0, Math.min(10000, bp));
}

// The screens quote every ratio as a whole percent ("2,09 months = 35%", "5 of 6 = 83%"), so the points are
// taken from that same whole percent, rounded half up: what is on screen always gives the points next to it.
export function wholePercentBp(bp: number): number {
  return Math.floor((bp + 50) / 100) * 100;
}

export function bandFor(score: number): HealthBand {
  if (score >= BAND_FROM.healthy) return 'healthy';
  if (score >= BAND_FROM.fair) return 'fair';
  if (score >= BAND_FROM.weak) return 'weak';
  return 'needs_work';
}

// Shares 100 points over the counted parts in proportion to their base weights. Floors first, then gives the
// leftover points one by one to the largest remainders (ties: the heavier base weight, then list order).
export function distributeWeights(counted: readonly ComponentId[]): Partial<Record<ComponentId, number>> {
  const total = counted.reduce((sum, id) => sum + BASE_WEIGHTS[id], 0);
  const rows = counted.map((id, order) => {
    const scaled = BASE_WEIGHTS[id] * 100;
    return { id, order, base: Math.floor(scaled / total), rem: scaled % total };
  });
  let left = 100 - rows.reduce((sum, r) => sum + r.base, 0);
  const ranked = [...rows].sort((a, b) => b.rem - a.rem || BASE_WEIGHTS[b.id] - BASE_WEIGHTS[a.id] || a.order - b.order);
  for (const row of ranked) {
    if (left <= 0) break;
    row.base += 1;
    left -= 1;
  }
  const out: Partial<Record<ComponentId, number>> = {};
  for (const row of rows) out[row.id] = row.base;
  return out;
}

interface Raw {
  skipped: boolean;
  ratioBp: number;
  metric: number | null;
}

const SKIP: Raw = { skipped: true, ratioBp: 0, metric: null };

function rawSavings(i: HealthInput): Raw {
  if (i.income <= 0) return { skipped: false, ratioBp: 0, metric: null };
  const net = i.income - i.expense;
  const savingsBp = mulDivRound(net, 10000, i.income);
  // full at SAVINGS_FULL_BP, nothing at 0 or below, straight in between, on the exact integers
  const ratioBp = clampBp(mulDivRound(net, 10000 * 10000, i.income * SAVINGS_FULL_BP));
  return { skipped: false, ratioBp, metric: savingsBp };
}

function rawBudget(i: HealthInput): Raw {
  if (i.budgets.length === 0) return SKIP;
  const within = i.budgets.filter(b => b.spent <= b.limit).length;
  return { skipped: false, ratioBp: mulDivRound(within, 10000, i.budgets.length), metric: within };
}

// The expense the emergency fund is measured against: the period's own, or, in the first days of a running
// period (when it says little), the previous full period's.
export function emergencyExpenseBase(i: HealthInput): number {
  const young = i.dayOfPeriod < YOUNG_PERIOD_DAYS && i.previousExpense !== null && i.previousExpense > 0;
  return young ? (i.previousExpense as number) : i.expense;
}

function rawEmergency(i: HealthInput): Raw {
  const expense = emergencyExpenseBase(i);
  if (expense <= 0) return { skipped: false, ratioBp: i.balance > 0 ? 10000 : 0, metric: null };
  if (i.balance <= 0) return { skipped: false, ratioBp: 0, metric: 0 };
  return {
    skipped: false,
    ratioBp: clampBp(mulDivRound(i.balance, 10000, expense * EMERGENCY_FULL_MONTHS)),
    metric: mulDivRound(i.balance, 100, expense),
  };
}

function rawFixed(i: HealthInput): Raw {
  if (i.fixedMonthly <= 0 || i.income <= 0) return SKIP;
  const bp = mulDivRound(i.fixedMonthly, 10000, i.income);
  // Straight line from full at FIXED_FULL_BP down to nothing at FIXED_ZERO_BP, on the exact integers.
  const over = i.fixedMonthly * 10000 - i.income * FIXED_FULL_BP; // > 0 when above the full line
  const span = i.income * (FIXED_ZERO_BP - FIXED_FULL_BP);
  const ratioBp = over <= 0 ? 10000 : clampBp(10000 - mulDivRound(over, 10000, span));
  return { skipped: false, ratioBp, metric: bp };
}

function rawWealth(i: HealthInput): Raw {
  const series = i.netWorthSeries.slice(-WEALTH_MAX_POINTS);
  if (series.length < 2) return SKIP;
  let rises = 0;
  for (let k = 1; k < series.length; k++) if (series[k] > series[k - 1]) rises += 1;
  return { skipped: false, ratioBp: mulDivRound(rises, 10000, series.length - 1), metric: rises };
}

const RAW: Record<ComponentId, (i: HealthInput) => Raw> = {
  savings: rawSavings,
  budget: rawBudget,
  emergency: rawEmergency,
  fixed: rawFixed,
  wealth: rawWealth,
};

export function eligibilityChecks(i: HealthInput): EligibilityCheck[] {
  return [
    { id: 'accounts', met: i.accountCount >= MIN_ACCOUNTS, have: i.accountCount, need: MIN_ACCOUNTS },
    { id: 'transactions', met: i.transactionCount >= MIN_TRANSACTIONS, have: i.transactionCount, need: MIN_TRANSACTIONS },
    { id: 'span', met: i.dataSpanDays >= MIN_SPAN_DAYS, have: i.dataSpanDays, need: MIN_SPAN_DAYS },
  ];
}

export function computeHealth(input: HealthInput): HealthResult {
  const checks = eligibilityChecks(input);
  if (checks.some(c => !c.met)) return { eligible: false, checks };

  const raws = COMPONENT_IDS.map(id => ({ id, raw: RAW[id](input) }));
  const counted = raws.filter(r => !r.raw.skipped).map(r => r.id);
  const weights = distributeWeights(counted);

  const components: HealthComponent[] = raws.map(({ id, raw }) => {
    const max = raw.skipped ? 0 : (weights[id] as number);
    // round half up of max * ratio, on integers
    const ratioBp = raw.skipped ? 0 : wholePercentBp(raw.ratioBp);
    const points = raw.skipped ? 0 : Math.floor((max * ratioBp + 5000) / 10000);
    return { id, points, max, ratioBp, skipped: raw.skipped, metric: raw.metric };
  });

  const score = components.reduce((sum, c) => sum + c.points, 0);
  return { eligible: true, score, band: bandFor(score), components, countedOf: counted.length };
}
