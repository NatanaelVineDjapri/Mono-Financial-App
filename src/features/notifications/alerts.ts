// Evaluates budget/goal state after any write and inserts new inbox items.
// Called from transaction save, recurring confirm, budget/goal change, restore.
// No system notifications for budget/goal — inbox + snackbar only.
import type { Db } from '../../data/db/types';
import { getAllSettings } from '../../data/repo/settings';
import { getDedupeKeys, insertInboxItems } from '../../data/repo/notifications';
import { evaluateAlerts } from '../../domain/notify/evaluateAlerts';
import type { AlertState, BudgetAlertItem, GoalAlertItem, InboxItem, NotifPrefs } from '../../domain/notify/types';
import { addDays, daysBetween, periodEnd, periodOfDate, periodStart } from '../../core/date';

export async function runEvaluateAlerts(
  db: Db,
  prev: AlertState,
  next: AlertState,
): Promise<InboxItem[]> {
  const settings = await getAllSettings(db);
  const prefs: NotifPrefs = {
    notif_enabled: settings.notif_enabled ?? '0',
    quiet_start: settings.quiet_start ?? '22:00',
    quiet_end: settings.quiet_end ?? '06:00',
    notif_daily: settings.notif_daily ?? '1',
    notif_daily_time: settings.notif_daily_time ?? '20:00',
    notif_bill_h1: settings.notif_bill_h1 ?? '1',
    notif_bill_overdue: settings.notif_bill_overdue ?? '1',
    notif_budget_near: settings.notif_budget_near ?? '1',
    notif_budget_over: settings.notif_budget_over ?? '1',
    notif_goal: settings.notif_goal ?? '1',
    notif_backup: settings.notif_backup ?? '1',
    timezone: settings.timezone ?? 'Asia/Jakarta',
    month_start_day: settings.month_start_day ?? '1',
  };

  const existingKeys = await getDedupeKeys(db);
  const newItems = evaluateAlerts(prev, next, prefs, existingKeys);
  if (newItems.length > 0) {
    await insertInboxItems(db, newItems);
  }
  return newItems;
}

/** Loads current budget+goal alert state snapshot from the database. */
export async function loadAlertState(db: Db): Promise<AlertState> {
  const settings = await getAllSettings(db);
  const monthStartDay = parseInt(settings.month_start_day ?? '1', 10);
  const tzOffset = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 }[settings.timezone ?? 'Asia/Jakarta'] ?? 7;
  const nowMs = Date.now() + tzOffset * 3600000;
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = (() => {
    const d = new Date(nowMs);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  })();

  // Current period start
  const period = periodOfDate(todayStr, monthStartDay);
  const pStart = periodStart(period, monthStartDay);
  const pEnd = periodEnd(period, monthStartDay);
  const daysLeft = Math.max(0, daysBetween(todayStr, pEnd));

  const budgetRows = await db.getAllAsync<{
    id: number; category_id: number; category: string;
    limit_amount: number; spent: number; used_bp: number;
  }>('SELECT id, category_id, category, limit_amount, spent, used_bp FROM v_budget_status WHERE month = ?', [period]);

  const budgets: BudgetAlertItem[] = budgetRows.map(r => ({
    budget_id: r.id,
    category_id: r.category_id,
    categoryName: r.category,
    usedBp: r.used_bp,
    spentAmount: r.spent,
    limitAmount: r.limit_amount,
    daysLeft,
    periodStart: pStart,
  }));

  const goalRows = await db.getAllAsync<{
    id: number; name: string; target_amount: number; current_amount: number; progress_bp: number;
  }>('SELECT id, name, target_amount, current_amount, progress_bp FROM v_goal_progress');

  const goals: GoalAlertItem[] = goalRows.map(r => ({
    goal_id: r.id,
    goalName: r.name,
    progressBp: r.progress_bp,
    targetAmount: r.target_amount,
    currentAmount: r.current_amount,
  }));

  return { budgets, goals, periodStart: pStart };
}
