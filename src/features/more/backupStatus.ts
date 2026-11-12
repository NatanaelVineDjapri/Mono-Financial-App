// The backup status strip on More (DESIGN.md section I, PAGES.md M): where the data lives and how
// safe it is, always in view. Pure: the time of the newest `backup_log` row, how many transactions
// were created or changed since then, and "now" go in; the state comes out. Nothing is stored: it
// is worked out again every time the screen gets focus.
//
//   none    no backup was ever made
//   recent  the last one is less than BACKUP_STALE_AFTER_DAYS days old (shows how many
//           transactions changed since, when there are any)
//   stale   the last one is BACKUP_STALE_AFTER_DAYS days old or more
//
// The threshold is src/core/backupPolicy.ts, shared with the backup reminder. Days are calendar
// days in the zone of the `timezone` setting (default WIB).
import { isBackupStale } from '../../core/backupPolicy';

const ZONES: Record<string, { label: string; offsetHours: number }> = {
  'Asia/Jakarta': { label: 'WIB', offsetHours: 7 },
  'Asia/Makassar': { label: 'WITA', offsetHours: 8 },
  'Asia/Jayapura': { label: 'WIT', offsetHours: 9 },
};
const DEFAULT_ZONE = ZONES['Asia/Jakarta'];

const MONTHS: Record<'id' | 'en', string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
// Indonesian writes the time with a dot (20.14), English with a colon (20:14); both are 24 hour.
const TIME_SEPARATOR: Record<'id' | 'en', string> = { id: '.', en: ':' };
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

export function zoneOf(timezone: string | null | undefined): { label: string; offsetHours: number } {
  return (timezone ? ZONES[timezone] : undefined) ?? DEFAULT_ZONE;
}

export type BackupState = { kind: 'none' } | { kind: 'recent'; days: number; changed: number } | { kind: 'stale'; days: number; changed: number };

const pad = (n: number) => String(n).padStart(2, '0');

// "21 Okt 2026, 20.14 WIB" (id) or "21 Oct 2026, 20:14 WIB" (en): the full time of a backup, for the
// Backup screen's list (the strip itself only says how long ago).
export function formatBackupTime(iso: string, timezone?: string | null, language: 'id' | 'en' = 'id'): string {
  const zone = zoneOf(timezone);
  const local = new Date(new Date(iso).getTime() + zone.offsetHours * HOUR_MS);
  return `${local.getUTCDate()} ${MONTHS[language][local.getUTCMonth()]} ${local.getUTCFullYear()}, ${pad(local.getUTCHours())}${TIME_SEPARATOR[language]}${pad(local.getUTCMinutes())} ${zone.label}`;
}

// Whole calendar days between two instants, as dates in the zone (a backup at 23.50 and a look at
// 00.10 the next morning is one day, not twenty minutes).
export function daysSince(iso: string, nowMs: number, timezone?: string | null): number {
  const offset = zoneOf(timezone).offsetHours * HOUR_MS;
  const startOfDay = (ms: number) => Math.floor((ms + offset) / DAY_MS);
  return startOfDay(nowMs) - startOfDay(new Date(iso).getTime());
}

export function backupState(lastBackupIso: string | null, changedSince: number, nowMs: number, timezone?: string | null): BackupState {
  if (!lastBackupIso || Number.isNaN(new Date(lastBackupIso).getTime())) return { kind: 'none' };
  // A backup dated in the future (a clock set back) counts as today.
  const days = Math.max(0, daysSince(lastBackupIso, nowMs, timezone));
  const changed = Math.max(0, Math.floor(changedSince));
  return { kind: isBackupStale(days) ? 'stale' : 'recent', days, changed };
}

export type RelativeUnit = 'today' | 'yesterday' | 'days' | 'weeks' | 'months' | 'years';

// "hari ini", "kemarin", "3 hari lalu", "2 minggu lalu", "2 bulan lalu": which unit and how many.
// Under two weeks it counts days, under two months weeks, under a year months.
export function relativeParts(days: number): { unit: RelativeUnit; n: number } {
  const d = Math.max(0, Math.floor(days));
  if (d === 0) return { unit: 'today', n: 0 };
  if (d === 1) return { unit: 'yesterday', n: 1 };
  if (d < 14) return { unit: 'days', n: d };
  if (d < 60) return { unit: 'weeks', n: Math.floor(d / 7) };
  if (d < 365) return { unit: 'months', n: Math.floor(d / 30) };
  return { unit: 'years', n: Math.floor(d / 365) };
}
