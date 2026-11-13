// Exchange rate refresh. CLAUDE.md rule 8 (offline-first): src/features/ai_chat and
// src/features/fx are the only two places allowed to reach the network.
//
// One GET request, no body, no user data sent. Source: open.er-api.com, provided by
// Exchange Rate API — the Rates screen (built in a later phase) must show and link the
// attribution below.
//
// Persisting a successful result into fx_rates, and deciding which currencies the user
// actually holds, is the repo layer's job once it exists (src/data/db has no repo layer
// yet — see CLAUDE.md). This module only fetches and normalises.

export const ATTRIBUTION_TEXT = 'Rates By Exchange Rate API';
export const ATTRIBUTION_URL = 'https://www.exchangerate-api.com';

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 20000;

export type FxRate = { currency: string; rateE4: number };

export type FetchRatesSuccess = {
  ok: true;
  fetchedAt: string; // ISO 8601 with a +07:00 offset
  rates: FxRate[];
  // When the service says its rates change next (time_next_update_unix / time_next_update_utc), as
  // an ISO instant with the +07:00 offset; null when it did not say. Asking again before then returns
  // the same numbers.
  nextUpdateAt?: string | null;
};

export type FetchRatesFailure = {
  ok: false;
  reason: 'http_error' | 'rate_limited' | 'bad_response' | 'missing_currency' | 'network_error' | 'timeout';
  message: string;
};

export type FetchRatesResult = FetchRatesSuccess | FetchRatesFailure;

// What the person is told, in three kinds (the Rates screen words each): no internet or no answer in
// time; the service asked us to slow down (HTTP 429); or an answer we cannot use. In every case the
// rates already stored stay as they are.
export type FxFailureKind = 'offline' | 'rate_limited' | 'invalid';

export function fxFailureKind(reason: FetchRatesFailure['reason']): FxFailureKind {
  if (reason === 'network_error' || reason === 'timeout') return 'offline';
  if (reason === 'rate_limited') return 'rate_limited';
  return 'invalid';
}

const WIB_OFFSET_MS = 7 * 3600000;

function isoWib(ms: number): string {
  const wib = new Date(ms + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`;
}

// The service's own next-update time, from the unix field when it is there and otherwise from the UTC
// string; null when neither can be read.
export function nextUpdateFrom(body: { time_next_update_unix?: unknown; time_next_update_utc?: unknown }): string | null {
  const unix = body.time_next_update_unix;
  if (typeof unix === 'number' && Number.isFinite(unix) && unix > 0) return isoWib(unix * 1000);
  const utc = body.time_next_update_utc;
  if (typeof utc === 'string') {
    const ms = Date.parse(utc);
    if (!Number.isNaN(ms)) return isoWib(ms);
  }
  return null;
}

function nowInJakarta(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}` +
    `T${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}+07:00`
  );
}

// heldCurrencies: the currency codes the user actually has a pocket in
// (account_currencies). Only these are kept, per the owner's instruction.
export async function fetchRates(heldCurrencies: readonly string[]): Promise<FetchRatesResult> {
  if (heldCurrencies.length === 0) {
    return { ok: true, fetchedAt: nowInJakarta(), rates: [] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(API_URL, { signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, reason: 'timeout', message: `No response within ${TIMEOUT_MS / 1000}s.` };
    }
    return { ok: false, reason: 'network_error', message: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    return { ok: false, reason: 'rate_limited', message: 'Rate limited (HTTP 429).' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'http_error', message: `HTTP ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'bad_response', message: 'Response was not valid JSON.' };
  }

  const parsed = body as { result?: string; rates?: Record<string, number>; time_next_update_unix?: unknown; time_next_update_utc?: unknown };
  if (parsed.result !== 'success' || !parsed.rates || typeof parsed.rates.IDR !== 'number') {
    return { ok: false, reason: 'bad_response', message: "Missing result = 'success' or rates.IDR." };
  }

  const rates: FxRate[] = [];
  for (const currency of heldCurrencies) {
    const perUsd = parsed.rates[currency];
    if (typeof perUsd !== 'number') {
      return { ok: false, reason: 'missing_currency', message: `No rate for ${currency}.` };
    }
    // The only place float math is allowed (CLAUDE.md rule 1): at the network boundary,
    // converting the API's USD-based cross rate to rupiah-per-unit before rounding to
    // an integer. Everything downstream of this line is integer-only.
    const idrPerUnit = parsed.rates.IDR / perUsd;
    rates.push({ currency, rateE4: Math.round(idrPerUnit * 10000) });
  }

  return { ok: true, fetchedAt: nowInJakarta(), rates, nextUpdateAt: nextUpdateFrom(parsed) };
}
