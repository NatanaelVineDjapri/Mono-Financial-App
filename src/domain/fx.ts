// Ties the throttle rules, the network fetch and saving together. Never throws to the
// caller — every outcome, including a network failure, comes back as a plain result, and
// a failed refresh never touches the rates already stored (CLAUDE.md rule 8).
import type { Db } from '../data/db/types';
import * as fxRepo from '../data/repo/fx';
import * as settingsRepo from '../data/repo/settings';
import { fetchRates } from '../features/fx/fetchRates';
import type { FetchRatesFailure, FxRate } from '../features/fx/fetchRates';
import { isInCooldown, isLockedOut } from '../features/fx/throttle';

export type RefreshOutcome =
  | { status: 'updated'; rates: FxRate[] }
  | { status: 'skipped_locked'; lockedUntil: string }
  | { status: 'skipped_cooldown'; lastSuccessAt: string }
  | { status: 'skipped_no_pockets' }
  | { status: 'failed'; reason: FetchRatesFailure['reason']; message: string };

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

  const lastSuccessAt = await settingsRepo.getSetting(db, 'fx_last_success_at');
  if (isInCooldown(lastSuccessAt, nowDate)) {
    return { status: 'skipped_cooldown', lastSuccessAt: lastSuccessAt! };
  }

  const heldCurrencies = await fxRepo.listHeldCurrencies(db);
  if (heldCurrencies.length === 0) {
    return { status: 'skipped_no_pockets' };
  }

  const result = await fetchRates(heldCurrencies);
  if (!result.ok) {
    if (result.reason === 'rate_limited') {
      await settingsRepo.setSetting(db, 'fx_rate_limited_at', now);
    }
    return { status: 'failed', reason: result.reason, message: result.message };
  }

  await fxRepo.saveFetchedRates(db, result.rates, result.fetchedAt);
  await settingsRepo.setSetting(db, 'fx_last_success_at', now);
  return { status: 'updated', rates: result.rates };
}

// A manual rate: a new row (source='manual'), never an overwrite — history is kept, see
// v_latest_fx.
export async function saveManualRate(db: Db, currency: string, rateE4: number, enteredAt: string): Promise<void> {
  await fxRepo.insertFxRate(db, currency, rateE4, enteredAt, 'manual');
}
