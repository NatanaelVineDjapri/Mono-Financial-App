// The Backup status card on More (PAGES.md M): three states, so the risk of losing data is always
// visible. Pure: the time of the newest `backup_log` row and "now" go in, the state comes out.
//   none    no backup was ever made
//   old     the last one is more than 30 days ago ("45 hari lalu")
//   recent  the date and time of the last one ("21 Okt 2026, 20.14 WIB")
// Times are shown in the zone of the `timezone` setting (default WIB). Nothing is stored: the
// state is read again every time the screen gets focus.

export const OLD_AFTER_DAYS = 30;

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

export type BackupState =
  | { kind: 'none' }
  | { kind: 'old'; days: number }
  | { kind: 'recent'; whenText: string };

const pad = (n: number) => String(n).padStart(2, '0');

// "21 Okt 2026, 20.14 WIB" (id) or "21 Oct 2026, 20:14 WIB" (en)
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

export function backupState(lastBackupIso: string | null, nowMs: number, timezone?: string | null, language: 'id' | 'en' = 'id'): BackupState {
  if (!lastBackupIso || Number.isNaN(new Date(lastBackupIso).getTime())) return { kind: 'none' };
  const days = daysSince(lastBackupIso, nowMs, timezone);
  if (days > OLD_AFTER_DAYS) return { kind: 'old', days };
  return { kind: 'recent', whenText: formatBackupTime(lastBackupIso, timezone, language) };
}
