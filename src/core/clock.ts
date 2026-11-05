// The app's one source of "now" (CLAUDE.md step 5 / build order). Every place that needs
// today's date for business logic (budgets, overview, recurring due dates, …) must call
// now()/today() here instead of `new Date()` directly, so a __DEV__ build can pin the
// clock to the sample dataset's reference date (28 Oct 2026) without touching release
// behaviour — setClockOverride() is a no-op outside __DEV__, checked again on every read,
// so flipping __DEV__ off always falls back to the real system clock.
//
// Deliberately NOT used by src/features/fx/fetchRates.ts or throttle.ts: those stamp and
// gate a real network call against the real external API's actual timing, and faking
// that via the dev override would misrepresent when a real fetch genuinely happened.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

let devOverrideMs: number | null = null;

export function setClockOverride(iso: string | null): void {
  if (!__DEV__) return;
  devOverrideMs = iso === null ? null : new Date(iso).getTime();
}

export function now(): Date {
  if (__DEV__ && devOverrideMs !== null) return new Date(devOverrideMs);
  return new Date();
}

// Today's calendar date in WIB (UTC+7), as YYYY-MM-DD — the date format used throughout
// the schema (occurred_on, budgets.month, …).
export function today(): string {
  const wib = new Date(now().getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`;
}
