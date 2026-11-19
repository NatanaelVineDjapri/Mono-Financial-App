// Shared types for the notification domain. No React, no expo deps.

export type NotifKind =
  | 'daily'
  | 'bill_due'
  | 'bill_overdue'
  | 'budget_near'
  | 'budget_over'
  | 'goal_milestone'
  | 'backup';

// Stored in the `notifications` table.
export interface NotifRow {
  id: number;
  kind: NotifKind;
  dedupe_key: string;
  ref_type: string | null;
  ref_id: number | null;
  payload: string; // JSON — integers/ISO dates only
  created_at: string;
  read_at: string | null;
}

// A candidate for expo-notifications scheduling.
export interface ScheduleItem {
  key: string; // deterministic, used as notification identifier
  at: Date;    // absolute timestamp (already adjusted for quiet hours & tz)
  kind: NotifKind;
  payload: NotifPayload;
}

// A new inbox item returned by evaluateAlerts / materializeDue.
export interface InboxItem {
  kind: NotifKind;
  dedupe_key: string;
  ref_type?: string;
  ref_id?: number;
  payload: NotifPayload;
  created_at: string; // ISO
}

// Payload is always integers/ISO dates only — no rendered sentences.
export type NotifPayload =
  | { kind: 'daily' }
  | { kind: 'bill_due';      recurringId: number; name: string; accountName: string; amount: number; amountVaries: 0 | 1; dueDate: string }
  | { kind: 'bill_overdue';  recurringId: number; name: string; accountName: string; dueDate: string }
  | { kind: 'budget_near';   budgetId: number; categoryName: string; usedBp: number; spentAmount: number; limitAmount: number; daysLeft: number; periodStart: string }
  | { kind: 'budget_over';   budgetId: number; categoryName: string; usedBp: number; spentAmount: number; limitAmount: number; periodStart: string }
  | { kind: 'goal_milestone'; goalId: number; goalName: string; milestone: 5000 | 7500 | 10000; targetAmount: number; currentAmount: number }
  | { kind: 'backup';        daysSinceLast: number | null }; // null = never backed up

export interface NotifPrefs {
  notif_enabled: string;
  quiet_start: string;    // 'HH:MM'
  quiet_end: string;      // 'HH:MM'
  notif_daily: string;
  notif_daily_time: string;
  notif_bill_h1: string;
  notif_bill_overdue: string;
  notif_budget_near: string;
  notif_budget_over: string;
  notif_goal: string;
  notif_backup: string;
  timezone: string;       // 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'
  month_start_day: string;
}

// State snapshot passed into planSchedule / evaluateAlerts.
export interface PlanState {
  hasTransactionToday: boolean;         // any tx dated today (tz-aware)
  activeRecurring: ActiveRecurring[];
  lastBackupAt: string | null;          // ISO or null
  txCount: number;                      // total transactions (for first-time backup prompt)
}

export interface ActiveRecurring {
  id: number;
  name: string;
  amount: number;
  amount_varies: 0 | 1;
  account_id: number;
  account_name: string;
  remind: 0 | 1;
  archived: 0 | 1;
  end_on: string | null;
  // Upcoming due dates in the 14-day window (YYYY-MM-DD), already clamped to month end by DB view.
  dueDates: string[];
  // Which of those are confirmed (key = dueDate).
  confirmedDates: Set<string>;
}

export interface AlertState {
  budgets: BudgetAlertItem[];
  goals: GoalAlertItem[];
  periodStart: string; // YYYY-MM-DD, current period start
}

export interface BudgetAlertItem {
  budget_id: number;
  category_id: number;
  categoryName: string;
  usedBp: number;        // basis points, 0-∞
  spentAmount: number;
  limitAmount: number;
  daysLeft: number;
  periodStart: string;
}

export interface GoalAlertItem {
  goal_id: number;
  goalName: string;
  progressBp: number;    // basis points
  targetAmount: number;
  currentAmount: number;
}
