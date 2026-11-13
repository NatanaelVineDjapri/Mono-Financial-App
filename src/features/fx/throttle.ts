// Pure throttle rules for the rate refresh, kept separate from fetchRates.ts so they are
// testable without a network mock. Reading/writing the actual timestamps (via the
// settings repo: fx_rate_limited_at, fx_last_success_at) is domain/fx.ts's job.

const LOCK_AFTER_429_MS = 20 * 60 * 1000; // 20 minutes
const COOLDOWN_AFTER_SUCCESS_MS = 60 * 60 * 1000; // 1 hour
const AUTO_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// lastRateLimitedAt is set ONLY when the API itself responds HTTP 429 — never on a
// plain network failure or timeout, which are not the server asking us to back off.
export function isLockedOut(lastRateLimitedAt: string | null, now: Date = new Date()): boolean {
  if (!lastRateLimitedAt) return false;
  return now.getTime() - new Date(lastRateLimitedAt).getTime() < LOCK_AFTER_429_MS;
}

export function isInCooldown(lastSuccessAt: string | null, now: Date = new Date()): boolean {
  if (!lastSuccessAt) return false;
  return now.getTime() - new Date(lastSuccessAt).getTime() < COOLDOWN_AFTER_SUCCESS_MS;
}

// For messages like "Sudah diperbarui 12 menit lalu."
export function minutesSince(at: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(at).getTime()) / 60000);
}

// True only when automatic updates are switched on AND it has been at least 24h since
// the last success (or there has never been one). The caller decides when to check this
// (e.g. once per app open) — it is not part of refreshRates' own throttle, which applies
// the same way to a manual tap or an automatic check.
//
// `nextUpdateAt` is the service's own "rates change again at": asking before it returns the same
// numbers, so an automatic check waits for it (a manual tap never does).
//
// `hasUnratedCurrency` is a pocket added since the last fetch: it has no rate at all, and a day's
// wait or the service's next-update time would leave it unusable, so that one asks immediately.
export function shouldAutoUpdate(
  lastSuccessAt: string | null,
  enabled: boolean,
  now: Date = new Date(),
  nextUpdateAt: string | null = null,
  hasUnratedCurrency = false,
): boolean {
  if (!enabled) return false;
  if (hasUnratedCurrency) return true;
  if (nextUpdateAt && now.getTime() < new Date(nextUpdateAt).getTime()) return false;
  if (!lastSuccessAt) return true;
  return now.getTime() - new Date(lastSuccessAt).getTime() >= AUTO_UPDATE_INTERVAL_MS;
}
