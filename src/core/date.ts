// Pure date-string math on 'YYYY-MM-DD' (the schema's own date format), independent of
// any particular timezone's wall clock (CLAUDE.md step 5's dev clock gives a date, not a
// moment, to the callers that need this). Periods honour settings.month_start_day the
// same way v_tx does in mono_schema_v1.sql — period 'YYYY-MM' runs from that day of the
// month to the day before it the next month, with day 1 giving the calendar month.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = toUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

export function addMonths(dateStr: string, months: number): string {
  const date = toUtcDate(dateStr);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toDateString(date);
}

// Mirrors v_tx's own `period` expression exactly (mono_schema_v1.sql): shift back
// (monthStartDay - 1) days, then take the year-month of that shifted date.
export function periodOfDate(dateStr: string, monthStartDay: number): string {
  return addDays(dateStr, -(monthStartDay - 1)).slice(0, 7);
}

export function periodStart(period: string, monthStartDay: number): string {
  return addDays(`${period}-01`, monthStartDay - 1);
}

export function periodEnd(period: string, monthStartDay: number): string {
  return addDays(addMonths(periodStart(period, monthStartDay), 1), -1);
}

export function previousPeriod(period: string, monthStartDay: number): string {
  return periodOfDate(addDays(periodStart(period, monthStartDay), -1), monthStartDay);
}

export function nextPeriod(period: string, monthStartDay: number): string {
  return periodOfDate(addDays(periodEnd(period, monthStartDay), 1), monthStartDay);
}

// Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative when `to` is earlier.
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86400000);
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

// "28 Oct" — day + month, no year (a transaction row's own date, inside a month section
// that already states the year in its header).
export function formatDayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

// "Wed, 28 Oct" — a day section's own header (per the design board).
export function formatDayHeader(dateStr: string): string {
  const weekday = WEEKDAYS_SHORT[toUtcDate(dateStr).getUTCDay()];
  return `${weekday}, ${formatDayMonth(dateStr)}`;
}

// "October 2026" (per the design board's month section header — always carries the year).
export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

// "Oct 2026" — the Budgets header's month chip.
export function monthShortLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

// "Oct" — the month alone, no year (Budget-Category's four-month bar chart axis, where
// the card's own title already states the year).
export function monthAbbrev(period: string): string {
  const m = Number(period.split('-')[1]);
  return MONTHS_SHORT[m - 1];
}

// "October" — the month name alone (Budgets: "Days left in October").
export function monthName(period: string): string {
  const m = Number(period.split('-')[1]);
  return MONTHS_FULL[m - 1];
}

// "28 Oct 2026, 09:00" — an fx_rates.fetched_at (or any full ISO instant) for the
// Accounts card stack's forex note and the Exchange rates row. Formats the instant in
// WIB (UTC+7, the app's one timezone per CLAUDE.md step 5's clock), not the device's own.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// "12:41" — the clock time of an ISO instant in WIB (a record's created_at, shown beside its
// date on Transaction detail).
export function formatTimeWib(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;
}

export function formatDateTime(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const d = wib.getUTCDate();
  return `${d} ${MONTHS_SHORT[m]} ${y}, ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;
}
