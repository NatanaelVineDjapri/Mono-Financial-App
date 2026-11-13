// Ties the throttle rules, the network fetch and saving together. Never throws to the
// caller — every outcome, including a network failure, comes back as a plain result, and
// a failed refresh never touches the rates already stored (CLAUDE.md rule 8).
import type { Db } from '../data/db/types';
import * as fxRepo from '../data/repo/fx';
import * as settingsRepo from '../data/repo/settings';
import { fetchRates } from '../features/fx/fetchRates';
import { fxFailureKind, type FetchRatesFailure, type FxFailureKind, type FxRate } from '../features/fx/fetchRates';
import { isInCooldown, isLockedOut, shouldAutoUpdate } from '../features/fx/throttle';

export type RefreshOutcome =
  | { status: 'updated'; rates: FxRate[] }
  | { status: 'skipped_locked'; lockedUntil: string }
  | { status: 'skipped_cooldown'; lastSuccessAt: string }
  | { status: 'skipped_no_pockets' }
  | { status: 'failed'; reason: FetchRatesFailure['reason']; kind: FxFailureKind; message: string };

// A manual tap and an automatic check both go through the same throttle: locked out for
// 20 minutes after a 429, and no more than once an hour since the last success. The
// caller decides IF to call this automatically (see shouldAutoUpdate in
// src/features/fx/throttle.ts); this function does not distinguish why it was called.
export async function refreshRates(db: Db, now: string): Promise<RefreshOutcome> {
  const nowDate = new Date(now);

  const lastRateLimitedAt = await settingsRepo.getSetting(db, 'fx_rate_limited_at');
  if (isLockedOut(lastRateLimitedAt, nowDate)) {
    return { status: 'skipped_locked', lockedUntil: lastRateLimitedAt! };
  }

  const heldCurrencies = await fxRepo.listHeldCurrencies(db);
  if (heldCurrencies.length === 0) {
    return { status: 'skipped_no_pockets' };
  }

  // The hourly cooldown exists so we do not ask again for numbers we already have. A pocket added
  // after the last fetch has no rate at all (it was not held when the request was made), and
  // waiting an hour would leave that pocket unusable — the form refuses to record a Valas
  // transaction without a rate. So the cooldown only applies once every held currency has a rate;
  // the 429 lockout above still applies always.
  const latest = await fxRepo.listLatestRates(db);
  const hasUnrated = hasUnratedCurrency(heldCurrencies, latest);
  const lastSuccessAt = await settingsRepo.getSetting(db, 'fx_last_success_at');
  if (!hasUnrated && isInCooldown(lastSuccessAt, nowDate)) {
    return { status: 'skipped_cooldown', lastSuccessAt: lastSuccessAt! };
  }

  const result = await fetchRates(heldCurrencies);
  if (!result.ok) {
    if (result.reason === 'rate_limited') {
      await settingsRepo.setSetting(db, 'fx_rate_limited_at', now);
    }
    return { status: 'failed', reason: result.reason, kind: fxFailureKind(result.reason), message: result.message };
  }

  await fxRepo.saveFetchedRates(db, result.rates, result.fetchedAt);
  await settingsRepo.setSetting(db, 'fx_last_success_at', now);
  // The service's own next-update time, kept so an automatic check does not ask for the same numbers.
  await settingsRepo.setSetting(db, 'fx_next_update_at', result.nextUpdateAt ?? '');
  return { status: 'updated', rates: result.rates };
}

// A manual rate: a new row (source='manual'), never an overwrite — history is kept, see
// v_latest_fx.
export async function saveManualRate(db: Db, currency: string, rateE4: number, enteredAt: string): Promise<void> {
  await fxRepo.insertFxRate(db, currency, rateE4, enteredAt, 'manual');
}

// The switch "Perbarui otomatis" (settings.fx_auto_update): on from the start. The schema seeds the
// row with '1' (an older database is flipped once by migration 5 -> 6), so only an explicit '0' —
// the person switching it off — counts as off, and a missing row (a restored database without it)
// stays on rather than quietly stopping the updates.
export async function getFxAutoUpdate(db: Db): Promise<boolean> {
  return (await settingsRepo.getSetting(db, 'fx_auto_update')) !== '0';
}

export async function setFxAutoUpdate(db: Db, on: boolean): Promise<void> {
  await settingsRepo.setSetting(db, 'fx_auto_update', on ? '1' : '0');
}

// The automatic check, run when the app opens: only when the switch is on, the rates are older than a
// day and the service's own next-update time has passed. A pocket with no rate yet (added since the
// last fetch) is the exception: it asks straight away, see hasUnratedCurrency. It goes through the
// same throttle as a manual tap and never throws; a failure keeps the stored rates.
export async function autoUpdateRates(db: Db, now: string): Promise<RefreshOutcome | { status: 'skipped_not_due' }> {
  const [enabled, lastSuccessAt, nextUpdateAt, held, latest] = await Promise.all([
    getFxAutoUpdate(db),
    settingsRepo.getSetting(db, 'fx_last_success_at'),
    settingsRepo.getSetting(db, 'fx_next_update_at'),
    fxRepo.listHeldCurrencies(db),
    fxRepo.listLatestRates(db),
  ]);
  const hasUnrated = hasUnratedCurrency(held, latest);
  if (!shouldAutoUpdate(lastSuccessAt, enabled, new Date(now), nextUpdateAt || null, hasUnrated)) return { status: 'skipped_not_due' };
  return refreshRates(db, now);
}

// True when some held currency has no stored rate at all (any source, any age). A rate that is old is
// still a rate; only a missing one leaves the pocket unusable.
function hasUnratedCurrency(held: readonly string[], latest: readonly { currency: string }[]): boolean {
  const rated = new Set(latest.map(row => row.currency));
  return held.some(currency => !rated.has(currency));
}

// When the stored rates were last fetched OK, when the service says they change next, and when we
// were last told to slow down: what the Rates screen shows under its buttons.
export async function getFxStatus(db: Db): Promise<{ lastSuccessAt: string | null; nextUpdateAt: string | null; rateLimitedAt: string | null }> {
  const [lastSuccessAt, nextUpdateAt, rateLimitedAt] = await Promise.all([
    settingsRepo.getSetting(db, 'fx_last_success_at'),
    settingsRepo.getSetting(db, 'fx_next_update_at'),
    settingsRepo.getSetting(db, 'fx_rate_limited_at'),
  ]);
  return { lastSuccessAt, nextUpdateAt: nextUpdateAt || null, rateLimitedAt };
}
