// Notification scheduler — syncs expo-notifications with planSchedule output.
// ponytail: uses DATE trigger (not exact alarm); accepts Doze imprecision of a few minutes.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { useHideAmounts } from '../../components/hide-amounts-store';
import type { Db } from '../../data/db/types';
import { getLastBackupAt } from '../../data/repo/backupLog';
import { listRecurring } from '../../data/repo/recurring';
import { getAllSettings } from '../../data/repo/settings';
import { planSchedule } from '../../domain/notify/planSchedule';
import type { ActiveRecurring, NotifPrefs, PlanState, ScheduleItem } from '../../domain/notify/types';
import { notifChannelDescription, notifChannelName } from '../../i18n';
import { renderNotification } from './copy';

// ── Android channels ─────────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: 'pengingat',
    text: 'reminders',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  },
  {
    id: 'tagihan',
    text: 'bills',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  },
  {
    id: 'anggaran',
    text: 'budgets',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  },
] as const;

type ChannelId = 'pengingat' | 'tagihan' | 'anggaran';

function channelFor(kind: ScheduleItem['kind']): ChannelId {
  if (kind === 'bill_due' || kind === 'bill_overdue') return 'tagihan';
  if (kind === 'budget_near' || kind === 'budget_over' || kind === 'goal_milestone') return 'anggaran';
  return 'pengingat';
}

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const ch of CHANNELS) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: notifChannelName(ch.text),
      description: notifChannelDescription(ch.text),
      importance: ch.importance,
      lockscreenVisibility: ch.lockscreenVisibility,
      showBadge: true,
    });
  }
}

// ── Debounce ─────────────────────────────────────────────────────────────────
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced wrapper — safe to call after any write. */
export function scheduleSync(db: Db): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => void syncNotifications(db), 500);
}

// Hide amounts (CLAUDE.md rule 10): a reminder carries no amount while the mode is on. The text is written when the reminder is
// scheduled, not when it fires, so the mode in force when it is scheduled decides: the toggle as it is now, or "Hide on launch",
// which will switch it on at the next open. (The old `hide_amounts` setting was never written by anything.)
export function notificationsHideAmounts(settings: Record<string, string>, hiddenNow: boolean = useHideAmounts.getState().hidden): boolean {
  return hiddenNow || settings.hide_on_launch === '1';
}

// ── Core sync ─────────────────────────────────────────────────────────────────
export async function syncNotifications(db: Db): Promise<void> {
  const settings = await getAllSettings(db);
  const prefs = settingsToPrefs(settings);

  // Cancel all and do nothing if disabled or permission not granted.
  if (prefs.notif_enabled !== '1') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  // Handle the one-time cancel flag set by migration.
  if (settings.notif_cancel_all === '1') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    // Clear the flag so we don't cancel every time.
    // We use execAsync directly to avoid a re-import cycle.
    await db.runAsync("UPDATE settings SET value = '0' WHERE key = 'notif_cancel_all'");
  }

  const state = await buildPlanState(db, prefs);
  const desired = planSchedule(new Date(), prefs, state);

  // Load currently scheduled items.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingMap = new Map<string, Notifications.NotificationRequest>(
    existing.map(n => [n.identifier, n]),
  );
  const desiredMap = new Map<string, ScheduleItem>(desired.map(d => [d.key, d]));

  // Cancel stale.
  for (const [id] of existingMap) {
    if (!desiredMap.has(id)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }

  const hideAmounts = notificationsHideAmounts(settings);

  // Schedule new, and again any reminder that was written under the other Hide amounts mode (its text would show or hide an
  // amount the person no longer wants shown or hidden).
  for (const item of desired) {
    const scheduled = existingMap.get(item.key);
    if (scheduled) {
      const wrote = (scheduled.content.data as { hide?: boolean } | null)?.hide;
      if (wrote === hideAmounts) continue; // already scheduled, and written the right way
      await Notifications.cancelScheduledNotificationAsync(item.key);
    }
    const rendered = renderNotification(item.payload, { hideAmounts });
    await Notifications.scheduleNotificationAsync({
      identifier: item.key,
      content: {
        title: rendered.title,
        body: rendered.body,
        data: { key: item.key, kind: item.kind, hide: hideAmounts },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        // The Android channel belongs to the trigger: set on the content it was ignored, and every reminder landed in the
        // default channel instead of "bills", "budgets" or "reminders".
        ...(Platform.OS === 'android' ? { channelId: channelFor(item.kind) } : {}),
      },
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function settingsToPrefs(s: Record<string, string>): NotifPrefs {
  return {
    notif_enabled: s.notif_enabled ?? '0',
    quiet_start: s.quiet_start ?? '22:00',
    quiet_end: s.quiet_end ?? '06:00',
    notif_daily: s.notif_daily ?? '1',
    notif_daily_time: s.notif_daily_time ?? '20:00',
    notif_bill_h1: s.notif_bill_h1 ?? '1',
    notif_bill_overdue: s.notif_bill_overdue ?? '1',
    notif_budget_near: s.notif_budget_near ?? '1',
    notif_budget_over: s.notif_budget_over ?? '1',
    notif_goal: s.notif_goal ?? '1',
    notif_backup: s.notif_backup ?? '1',
    timezone: s.timezone ?? 'Asia/Jakarta',
    month_start_day: s.month_start_day ?? '1',
  };
}

async function buildPlanState(db: Db, prefs: NotifPrefs): Promise<PlanState> {
  const tzOffset = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 }[prefs.timezone] ?? 7;
  const nowMs = Date.now() + tzOffset * 3600000;
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = (() => {
    const d = new Date(nowMs);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  })();

  // Has any transaction dated today?
  const txTodayRow = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM transactions WHERE occurred_on = ?',
    [todayStr],
  );
  const hasTransactionToday = (txTodayRow?.n ?? 0) > 0;

  // Active recurring with due dates in next 14 days.
  const recs = await listRecurring(db);
  // We need recurring + their upcoming due dates. Query v_recurring_due for window.
  const windowEnd = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const dueRows = await db.getAllAsync<{
    recurring_id: number; due_on: string; account_name: string; account_id: number; amount: number; amount_varies: number; name: string;
  }>(
    `SELECT v.recurring_id, v.due_on, r.name, r.amount, r.amount_varies, v.account_id, a.name AS account_name
     FROM v_recurring_due v
     JOIN recurring r ON r.id = v.recurring_id
     JOIN accounts a ON a.id = v.account_id
     WHERE v.due_on <= ? AND r.remind = 1 AND r.archived = 0 AND a.type != 'forex'
     ORDER BY v.recurring_id, v.due_on`,
    [windowEnd],
  );

  // Confirmed dates per recurring.
  const confirmedRows = await db.getAllAsync<{ recurring_id: number; due_on: string }>(
    `SELECT recurring_id, due_on FROM recurring_events WHERE status = 'recorded' AND due_on >= ?`,
    [todayStr],
  );
  const confirmedMap = new Map<number, Set<string>>();
  for (const r of confirmedRows) {
    if (!confirmedMap.has(r.recurring_id)) confirmedMap.set(r.recurring_id, new Set());
    confirmedMap.get(r.recurring_id)!.add(r.due_on);
  }

  // Build ActiveRecurring list.
  const recMap = new Map<number, ActiveRecurring>();
  for (const row of dueRows) {
    if (!recMap.has(row.recurring_id)) {
      recMap.set(row.recurring_id, {
        id: row.recurring_id,
        name: row.name,
        amount: row.amount,
        amount_varies: row.amount_varies as 0 | 1,
        account_id: row.account_id,
        account_name: row.account_name,
        remind: 1,
        archived: 0,
        end_on: null,
        dueDates: [],
        confirmedDates: confirmedMap.get(row.recurring_id) ?? new Set(),
      });
    }
    recMap.get(row.recurring_id)!.dueDates.push(row.due_on);
  }

  const lastBackupAt = await getLastBackupAt(db);
  const txCountRow = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM transactions');

  return {
    hasTransactionToday,
    activeRecurring: Array.from(recMap.values()),
    lastBackupAt,
    txCount: txCountRow?.n ?? 0,
  };
}
