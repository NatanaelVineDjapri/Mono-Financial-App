// Pure throttle rules for the rate refresh, kept separate from fetchRates.ts so they are
// testable without a network mock. Reading/writing the actual last-attempt and
// last-success timestamps is the repo layer's job once it exists.

const LOCK_AFTER_429_MS = 20 * 60 * 1000; // 20 minutes
const COOLDOWN_AFTER_SUCCESS_MS = 60 * 60 * 1000; // 1 hour

export function isLockedOut(lastAttemptAt: string | null, now: Date = new Date()): boolean {
  if (!lastAttemptAt) return false;
  return now.getTime() - new Date(lastAttemptAt).getTime() < LOCK_AFTER_429_MS;
}

export function isInCooldown(lastSuccessAt: string | null, now: Date = new Date()): boolean {
  if (!lastSuccessAt) return false;
  return now.getTime() - new Date(lastSuccessAt).getTime() < COOLDOWN_AFTER_SUCCESS_MS;
}

// For messages like "Sudah diperbarui 12 menit lalu."
export function minutesSince(at: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(at).getTime()) / 60000);
}
