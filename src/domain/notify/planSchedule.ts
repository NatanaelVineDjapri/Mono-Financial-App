// Pure schedule planner — no React, no expo-notifications import.
// Returns ScheduleItems for the next 14 days, capped at 60 (furthest dropped).
import { addDays, daysBetween } from '../../core/date';
import type { NotifPayload, NotifPrefs, PlanState, ScheduleItem } from './types';

const WINDOW_DAYS = 14;
const MAX_ITEMS = 60;
const BACKUP_INTERVAL_DAYS = 7;
const NEVER_BACKUP_TX_THRESHOLD = 10;

// Timezone offset hours by IANA name.
const TZ_OFFSET: Record<string, number> = {
  'Asia/Jakarta': 7,
  'Asia/Makassar': 8,
  'Asia/Jayapura': 9,
};

/** Returns 'YYYY-MM-DD' for a Date in the given timezone (by fixed offset). */
function dateInTz(d: Date, tzOffsetH: number): string {
  const ms = d.getTime() + tzOffsetH * 3600000;
  const local = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** Builds a Date for a local 'HH:MM' wall-clock time on a given 'YYYY-MM-DD' date. */
function wallClockToDate(dateStr: string, timeStr: string, tzOffsetH: number): Date {
  const [h, m] = timeStr.split(':').map(Number);
  // Start of that calendar day in UTC = midnight minus tzOffset
  const [y, mo, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d) - tzOffsetH * 3600000;
  return new Date(utcMs + h * 3600000 + m * 60000);
}

/** Returns time-of-day in minutes (0–1439). */
function todMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Adjust `at` for quiet hours: if the wall-clock time falls in [quiet_start, quiet_end)
 * (allowing wrap-around overnight, e.g. 22:00–06:00), push to quiet_end same or next day.
 */
function applyQuietHours(at: Date, tzOffsetH: number, prefs: NotifPrefs): Date {
  const qStart = todMinutes(prefs.quiet_start);
  const qEnd = todMinutes(prefs.quiet_end);

  const localMs = at.getTime() + tzOffsetH * 3600000;
  const localMinutes = Math.floor(localMs / 60000) % 1440;

  const inQuiet = qStart > qEnd
    ? (localMinutes >= qStart || localMinutes < qEnd)  // overnight
    : (localMinutes >= qStart && localMinutes < qEnd); // same day

  if (!inQuiet) return at;

  // Push to quiet_end on the same or next day.
  const dayStartUtc = at.getTime() - (localMinutes * 60000) - ((localMs % 60000));
  const targetMs = dayStartUtc + qEnd * 60000;
  const adjusted = new Date(targetMs);
  // If adjusted is still in past relative to at (overnight wrap), add one day.
  return adjusted <= at ? new Date(adjusted.getTime() + 86400000) : adjusted;
}

export function planSchedule(
  now: Date,
  prefs: NotifPrefs,
  state: PlanState,
): ScheduleItem[] {
  if (prefs.notif_enabled !== '1') return [];

  const tzOffset = TZ_OFFSET[prefs.timezone] ?? 7;
  const todayStr = dateInTz(now, tzOffset);
  const items: ScheduleItem[] = [];

  // --- daily ---
  if (prefs.notif_daily === '1') {
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const dateStr = addDays(todayStr, i);
      // Skip today if the user already recorded a transaction.
      if (i === 0 && state.hasTransactionToday) continue;
      const rawAt = wallClockToDate(dateStr, prefs.notif_daily_time, tzOffset);
      if (rawAt <= now) continue; // already past
      const at = applyQuietHours(rawAt, tzOffset, prefs);
      items.push({
        key: `daily:${dateStr}`,
        at,
        kind: 'daily',
        payload: { kind: 'daily' },
      });
    }
  }

  // --- bill_due (H-1) and bill_overdue ---
  for (const rec of state.activeRecurring) {
    if (rec.remind === 0 || rec.archived === 1) continue;

    for (const dueDate of rec.dueDates) {
      const isConfirmed = rec.confirmedDates.has(dueDate);

      // bill_due: schedule at H-1 09:00 if not confirmed and not past
      if (prefs.notif_bill_h1 === '1' && !isConfirmed) {
        const reminderDate = addDays(dueDate, -1);
        const rawAt = wallClockToDate(reminderDate, '09:00', tzOffset);
        if (rawAt > now) {
          const at = applyQuietHours(rawAt, tzOffset, prefs);
          const payload: NotifPayload = {
            kind: 'bill_due',
            recurringId: rec.id,
            name: rec.name,
            accountName: rec.account_name,
            amount: rec.amount,
            amountVaries: rec.amount_varies,
            dueDate,
          };
          items.push({ key: `bill_due:${rec.id}:${dueDate}`, at, kind: 'bill_due', payload });
        }
      }

      // bill_overdue: day after due at 09:00, once, if not confirmed
      if (prefs.notif_bill_overdue === '1' && !isConfirmed) {
        const overdueDate = addDays(dueDate, 1);
        const rawAt = wallClockToDate(overdueDate, '09:00', tzOffset);
        if (rawAt > now) {
          const at = applyQuietHours(rawAt, tzOffset, prefs);
          const payload: NotifPayload = {
            kind: 'bill_overdue',
            recurringId: rec.id,
            name: rec.name,
            accountName: rec.account_name,
            dueDate,
          };
          items.push({ key: `bill_overdue:${rec.id}:${dueDate}`, at, kind: 'bill_overdue', payload });
        }
      }
    }
  }

  // --- backup ---
  if (prefs.notif_backup === '1') {
    const lastAt = state.lastBackupAt;
    if (lastAt === null) {
      // Never backed up: prompt once if enough transactions exist
      if (state.txCount >= NEVER_BACKUP_TX_THRESHOLD) {
        const tomorrowStr = addDays(todayStr, 1);
        const rawAt = wallClockToDate(tomorrowStr, '09:00', tzOffset);
        if (rawAt > now) {
          const at = applyQuietHours(rawAt, tzOffset, prefs);
          items.push({
            key: `backup:never:${tomorrowStr}`,
            at,
            kind: 'backup',
            payload: { kind: 'backup', daysSinceLast: null },
          });
        }
      }
    } else {
      const lastDate = lastAt.slice(0, 10);
      const daysSince = daysBetween(lastDate, todayStr);
      // If overdue (>= 7 days): schedule tomorrow, then next regular cycle
      const startDay = daysSince >= BACKUP_INTERVAL_DAYS ? 1 : BACKUP_INTERVAL_DAYS - daysSince;
      for (let offset = startDay; offset <= WINDOW_DAYS; offset += BACKUP_INTERVAL_DAYS) {
        const reminderDate = addDays(todayStr, offset);
        const rawAt = wallClockToDate(reminderDate, '09:00', tzOffset);
        if (rawAt > now) {
          const at = applyQuietHours(rawAt, tzOffset, prefs);
          const daysAtSchedule = daysSince + offset;
          items.push({
            key: `backup:${reminderDate}`,
            at,
            kind: 'backup',
            payload: { kind: 'backup', daysSinceLast: daysAtSchedule },
          });
          break; // only first occurrence within window
        }
      }
    }
  }

  // Sort by time ascending, cap to MAX_ITEMS (drop furthest).
  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items.slice(0, MAX_ITEMS);
}
