// Every sentence on the Analysis screen is written here, from templates in src/i18n (English and Indonesian),
// with the real numbers filled in. There is no language model behind any of it (CLAUDE.md rule 9 is about the
// AI chat, which must never import this module). The domain decides WHICH facts to show (src/domain/health);
// this file only turns them into words. Amounts go through `ctx.money`, which is where Hide amounts applies.
import { monthName } from '@/core/date';
import { getNumberFormat, pct } from '@/core/money';
import type { ComponentId, Good, HealthBand, HealthComponent, Improvement, InsightInput, Insights, Watch } from '@/domain/health';
import { FIXED_FULL_BP, SAVINGS_FULL_BP } from '@/domain/health';
import * as t from '@/i18n';

export interface CopyCtx {
  money: (rupiah: number) => string;
}

// What a "Lihat ..." link opens. The screen hands it to the router.
export interface LinkTarget {
  pathname: string;
  params?: Record<string, string>;
}

export function pctWhole(bp: number): string {
  return `${Math.round(bp / 100)}%`;
}

// Months from hundredths: 209 -> "2,1" (one decimal, the Analysis rows) or "2,09" (two, the how-to page).
export function monthsText(x100: number, decimals: 1 | 2 = 1): string {
  const sep = getNumberFormat() === 'en_US' ? '.' : ',';
  if (decimals === 2) return `${Math.floor(x100 / 100)}${sep}${String(x100 % 100).padStart(2, '0')}`;
  const tenths = Math.floor((x100 + 5) / 10);
  return `${Math.floor(tenths / 10)}${sep}${tenths % 10}`;
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function join(parts: string[]): string {
  return parts.join(t.analysisAnd());
}

// ---------------------------------------------------------------- the five rows

export interface PartRow {
  id: ComponentId;
  name: string;
  points: number;
  max: number;
  ratioBp: number;
  skipped: boolean;
  detail: string;
  lowest: boolean; // gets the "Lowest" tag
  skippedLink: { label: string; target: LinkTarget | null } | null;
  a11y: string;
}

export function partDetail(c: HealthComponent, facts: Pick<InsightInput, 'budgets' | 'netWorthSeries'>): string {
  switch (c.id) {
    case 'savings':
      return c.metric === null ? t.analysisDetailSavingsNoIncome() : t.analysisDetailSavings(pct(c.metric), pctWhole(SAVINGS_FULL_BP));
    case 'budget':
      return t.analysisDetailBudget(c.metric ?? 0, facts.budgets.length);
    case 'emergency':
      return c.metric === null ? t.analysisDetailEmergencyNoExpense() : t.analysisDetailEmergency(monthsText(c.metric), 6);
    case 'fixed':
      return t.analysisDetailFixed(pct(c.metric ?? 0), (c.metric ?? 0) <= FIXED_FULL_BP, pctWhole(FIXED_FULL_BP));
    case 'wealth':
      return t.analysisDetailWealth(c.metric ?? 0, Math.max(0, Math.min(6, facts.netWorthSeries.length) - 1));
  }
}

const SKIPPED_TARGET: Record<'budget' | 'fixed' | 'wealth', LinkTarget | null> = {
  budget: { pathname: '/(tabs)/budgets' },
  fixed: { pathname: '/recurring/edit' },
  wealth: null,
};

export function partRows(components: HealthComponent[], weakestId: ComponentId | null, facts: Pick<InsightInput, 'budgets' | 'netWorthSeries'>): PartRow[] {
  return components.map(c => {
    const name = t.analysisComponentName(c.id);
    const skippedId = c.skipped && c.id !== 'savings' && c.id !== 'emergency' ? c.id : null;
    const detail = c.skipped ? t.analysisSkippedTag() : partDetail(c, facts);
    return {
      id: c.id,
      name,
      points: c.points,
      max: c.max,
      ratioBp: c.ratioBp,
      skipped: c.skipped,
      detail,
      lowest: !c.skipped && c.id === weakestId,
      skippedLink: skippedId ? { label: t.analysisSkippedLink(skippedId), target: SKIPPED_TARGET[skippedId] } : null,
      a11y: c.skipped ? `${name}: ${t.analysisSkippedTag()}` : t.analysisPartA11y(name, c.points, c.max, detail),
    };
  });
}

// ---------------------------------------------------------------- "what could raise it"

export interface ImprovementCard {
  key: string;
  kind: Improvement['kind'];
  title: string;
  body: string;
  foot: string | null;
  chip: string; // "+4 poin", or "Info"
  link: { label: string; target: LinkTarget };
  // The thin bar under the text, when the card has one: budget cards use the striped overflow pattern.
  bar: { kind: 'over' | 'fill'; fillBp: number; overAmount?: number } | null;
}

export function improvementCard(imp: Improvement, ctx: CopyCtx, period: string): ImprovementCard {
  switch (imp.kind) {
    case 'budget_over':
      return {
        key: `budget_over:${imp.categoryId}`,
        kind: imp.kind,
        title: t.analysisImpBudgetTitle(imp.name),
        body: t.analysisImpBudgetBody(ctx.money(imp.spent), ctx.money(imp.limit), ctx.money(imp.overBy), imp.overCount - 1),
        foot: t.analysisImpBudgetFoot(pct(imp.usedBp), imp.daysLeft),
        chip: t.analysisPlusPoints(imp.points),
        link: { label: t.analysisImpBudgetLink(imp.name), target: { pathname: '/budget/category/[id]', params: { id: String(imp.categoryId), month: period } } },
        bar: { kind: 'over', fillBp: imp.usedBp, overAmount: imp.overBy },
      };
    case 'emergency':
      return {
        key: 'emergency',
        kind: imp.kind,
        title: t.analysisImpEmergencyTitle(monthsText(imp.monthsX100)),
        body: t.analysisImpEmergencyBody(monthsText(imp.monthsX100), ctx.money(imp.addAmount), imp.targetMonths),
        foot: t.analysisImpEmergencyFoot(monthsText(imp.monthsX100), 6),
        chip: t.analysisPlusPoints(imp.points),
        link: { label: t.analysisImpEmergencyLink(), target: { pathname: '/goals' } },
        bar: { kind: 'fill', fillBp: Math.min(10000, Math.floor((imp.monthsX100 * 10000) / 600)) },
      };
    case 'savings':
      return {
        key: 'savings',
        kind: imp.kind,
        title: t.analysisImpSavingsTitle(pct(imp.savingsBp)),
        body: t.analysisImpSavingsBody(ctx.money(imp.cutAmount), pctWhole(SAVINGS_FULL_BP)),
        foot: null,
        chip: t.analysisPlusPoints(imp.points),
        link: { label: t.analysisImpSavingsLink(), target: { pathname: '/reports' } },
        bar: null,
      };
    case 'fixed':
      return {
        key: 'fixed',
        kind: imp.kind,
        title: t.analysisImpFixedTitle(pct(imp.fixedBp)),
        body: t.analysisImpFixedBody(pctWhole(FIXED_FULL_BP)),
        foot: null,
        chip: t.analysisInfoTag(),
        link: { label: t.analysisImpFixedLink(), target: { pathname: '/recurring' } },
        bar: null,
      };
  }
}

// ---------------------------------------------------------------- "heads up"

export interface WatchCard {
  tag: string;
  title: string;
  body: string;
  link: { label: string; target: LinkTarget };
}

export function watchCard(w: Watch, ctx: CopyCtx): WatchCard {
  const other = w.other ? t.analysisWatchOther(w.other.name, pct(w.other.usedBp)) : null;
  return {
    tag: t.analysisWatchTag(),
    title: t.analysisWatchTitle(w.name),
    body: t.analysisWatchBody(w.name, pct(w.usedBp), ctx.money(w.limit), ctx.money(w.remaining), w.remaining > 0, w.daysLeft, other),
    link: { label: t.analysisWatchLink(), target: { pathname: '/(tabs)/budgets' } },
  };
}

// ---------------------------------------------------------------- "already going well"

export function goodSentence(g: Good, ctx: CopyCtx, previousMonthLabel: string): string {
  switch (g.id) {
    case 'savings':
      return t.analysisGoodSavings(pct(g.savingsBp), pctWhole(SAVINGS_FULL_BP), g.savingsBp >= SAVINGS_FULL_BP * 1.5);
    case 'budget':
      return t.analysisGoodBudget(g.within, g.total);
    case 'emergency':
      return t.analysisGoodEmergency(monthsText(g.monthsX100));
    case 'fixed':
      return t.analysisGoodFixed(ctx.money(g.amount), pct(g.bp));
    case 'wealth':
      return g.rose
        ? t.analysisGoodWealthRose(ctx.money(g.netWorth), ctx.money(g.change), g.changeBp === null ? null : pct(g.changeBp, true), previousMonthLabel)
        : t.analysisGoodWealthMostly(g.rises, g.comparisons);
  }
}

// ---------------------------------------------------------------- the sentence on the score card

export interface SummaryFacts {
  band: HealthBand;
  running: boolean;
  period: string; // 'YYYY-MM'
  components: HealthComponent[];
  insights: Insights;
  overBudgets: number; // how many budgets are over their limit
}

// "<This month your finances are ...>  <strongest>, but <weakest>."  A calm tone for the low bands: no blame,
// one gentle observation. With parts skipped for lack of data, the nudge is to add them.
export function summarySentence(f: SummaryFacts): string {
  const lead = t.analysisSummaryLead(f.band, f.running, monthName(f.period));
  const low = f.band === 'weak' || f.band === 'needs_work';
  const weakest = f.insights.weakIds[0] ?? f.insights.weakestId;
  if (low) return weakest ? `${lead} ${t.analysisCalmPhrase(weakest)}` : lead;

  const skipped = f.components.filter(c => c.skipped && c.id !== 'wealth').map(c => c.id as 'budget' | 'fixed');
  if (skipped.length > 0 && f.insights.good.length > 0) {
    // data is missing: praise up to two good parts, then nudge to add what is missing
    const praise = f.insights.good.slice(0, 2).map(g => t.analysisStrongPhrase(g.id));
    return `${lead} ${cap(join(praise))}. ${cap(t.analysisAddMissing(join(skipped.map(id => t.analysisMissing(id)))))}`;
  }
  const strongId = f.insights.strongestId !== null && f.insights.good.some(g => g.id === f.insights.strongestId) ? f.insights.strongestId : null;
  const strong = strongId ? [t.analysisStrongPhrase(strongId)] : [];
  const weak = f.insights.weakIds.map(id => {
    const c = f.components.find(x => x.id === id);
    return t.analysisWeakPhrase(id, f.overBudgets, monthsText(c?.metric ?? 0));
  });
  if (strong.length > 0 && weak.length > 0) return `${lead} ${cap(join(strong))}, ${t.analysisBut()} ${join(weak)}.`;
  if (strong.length > 0) return `${lead} ${cap(join(strong))}.`;
  if (weak.length > 0) return `${lead} ${cap(join(weak))}.`;
  return lead;
}

export function countedNote(components: HealthComponent[], countedOf: number): string | null {
  if (countedOf >= 5) return null;
  const missing = components.filter(c => c.skipped && (c.id === 'budget' || c.id === 'fixed' || c.id === 'wealth')).map(c => t.analysisMissing(c.id as 'budget' | 'fixed' | 'wealth'));
  return t.analysisCountedNote(countedOf, join(missing));
}
