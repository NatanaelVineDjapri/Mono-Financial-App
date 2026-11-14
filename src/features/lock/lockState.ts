// Pure lock state decision function. No React, no side effects.
// ponytail: fixed 30s grace period; upgrade to configurable grace duration if user settings require it.

export const DEFAULT_GRACE_MS = 30000;

export interface ShouldLockOptions {
  appLockOn: boolean;
  isColdStart?: boolean;
  backgroundedAt: number | null;
  now: number;
  graceMs?: number;
  suspended?: boolean;
}

export function shouldLock({
  appLockOn,
  isColdStart = false,
  backgroundedAt,
  now,
  graceMs = DEFAULT_GRACE_MS,
  suspended = false,
}: ShouldLockOptions): boolean {
  if (!appLockOn) return false;
  if (suspended) return false;
  if (isColdStart) return true;
  if (backgroundedAt != null && now - backgroundedAt >= graceMs) return true;
  return false;
}
