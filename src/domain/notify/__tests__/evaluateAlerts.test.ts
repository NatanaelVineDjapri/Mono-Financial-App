import { evaluateAlerts } from '../evaluateAlerts';
import type { AlertState, NotifPrefs } from '../types';

const PREFS: NotifPrefs = {
  notif_enabled: '1', quiet_start: '22:00', quiet_end: '06:00',
  notif_daily: '1', notif_daily_time: '20:00',
  notif_bill_h1: '1', notif_bill_overdue: '1',
  notif_budget_near: '1', notif_budget_over: '1',
  notif_goal: '1', notif_backup: '1',
  timezone: 'Asia/Jakarta', month_start_day: '1',
};

const PERIOD = '2026-11-01';

const emptyState: AlertState = { budgets: [], goals: [], periodStart: PERIOD };

function mkBudget(id: number, usedBp: number, spent = 800000, limit = 1000000, daysLeft = 10): AlertState['budgets'][0] {
  return { budget_id: id, category_id: id, categoryName: 'Makan', usedBp, spentAmount: spent, limitAmount: limit, daysLeft, periodStart: PERIOD };
}

function mkGoal(id: number, progressBp: number, targetAmount = 10000000, currentAmount = 0): AlertState['goals'][0] {
  return { goal_id: id, goalName: 'Liburan', progressBp, targetAmount, currentAmount };
}

describe('evaluateAlerts', () => {
  test('79% -> 81%: emits budget_near', () => {
    const prev: AlertState = { budgets: [mkBudget(1, 7900)], goals: [], periodStart: PERIOD };
    const next: AlertState = { budgets: [mkBudget(1, 8100)], goals: [], periodStart: PERIOD };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('budget_near');
    expect(items[0].dedupe_key).toBe(`budget_near:1:${PERIOD}`);
  });

  test('79% -> 105%: emits only budget_over (not both near+over)', () => {
    const prev: AlertState = { budgets: [mkBudget(1, 7900)], goals: [], periodStart: PERIOD };
    const next: AlertState = { budgets: [mkBudget(1, 10500)], goals: [], periodStart: PERIOD };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items.map(i => i.kind)).toEqual(['budget_over']);
  });

  test('dedupe: existing key suppresses re-emitting', () => {
    const prev: AlertState = { budgets: [mkBudget(1, 7900)], goals: [], periodStart: PERIOD };
    const next: AlertState = { budgets: [mkBudget(1, 8100)], goals: [], periodStart: PERIOD };
    const existing = new Set([`budget_near:1:${PERIOD}`]);
    const items = evaluateAlerts(prev, next, PREFS, existing);
    expect(items).toHaveLength(0);
  });

  test('budget_over: existing key suppresses', () => {
    const prev: AlertState = { budgets: [mkBudget(1, 10000)], goals: [], periodStart: PERIOD };
    const next: AlertState = { budgets: [mkBudget(1, 10500)], goals: [], periodStart: PERIOD };
    const existing = new Set([`budget_over:1:${PERIOD}`]);
    const items = evaluateAlerts(prev, next, PREFS, existing);
    expect(items).toHaveLength(0);
  });

  test('transaction dated different period does not trigger', () => {
    const OTHER = '2026-10-01';
    const prev: AlertState = { budgets: [{ ...mkBudget(1, 7900), periodStart: OTHER }], goals: [], periodStart: PERIOD };
    const next: AlertState = { budgets: [{ ...mkBudget(1, 8100), periodStart: OTHER }], goals: [], periodStart: PERIOD };
    // next.budgets items have periodStart OTHER, next.periodStart is PERIOD — mismatch → skip
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(0);
  });

  test('goal 60% -> 85%: only highest milestone (75%=7500bp)', () => {
    const prev: AlertState = { budgets: [], goals: [mkGoal(1, 6000)], periodStart: PERIOD };
    const next: AlertState = { budgets: [], goals: [mkGoal(1, 8500)], periodStart: PERIOD };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('goal_milestone');
    const p = items[0].payload as { milestone: number };
    expect(p.milestone).toBe(7500);
  });

  test('goal 85% -> 102%: emits 100% milestone', () => {
    const prev: AlertState = { budgets: [], goals: [mkGoal(1, 8500)], periodStart: PERIOD };
    const next: AlertState = { budgets: [], goals: [mkGoal(1, 10200)], periodStart: PERIOD };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(1);
    const p = items[0].payload as { milestone: number };
    expect(p.milestone).toBe(10000);
  });

  test('goal target amount change opens new milestone key', () => {
    // User had old key goal:1:10000:10000000 (achieved 100% on old target).
    // Target is now 15M. With 10.5M saved = ~7000bp: 50% milestone not yet reached at prev (prev 6000bp -> next 7000bp: no new milestone).
    // But if we cross 75% with new target: prev 6000bp, next 7600bp -> 75% milestone with new targetAmount.
    const existing = new Set(['goal:1:10000:10000000']); // old 100% already in inbox
    const prev: AlertState = { budgets: [], goals: [mkGoal(1, 6000, 15000000, 9000000)], periodStart: PERIOD };
    const next: AlertState = { budgets: [], goals: [mkGoal(1, 7600, 15000000, 11400000)], periodStart: PERIOD };
    const items = evaluateAlerts(prev, next, PREFS, existing);
    // key is goal:1:7500:15000000, not in existing
    expect(items.some(i => i.dedupe_key === 'goal:1:7500:15000000')).toBe(true);
  });
});
