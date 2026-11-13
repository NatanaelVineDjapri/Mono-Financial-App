// The maths of rates and exchanges, integers only (CLAUDE.md rule 1). A rate is rupiah per 1 major
// unit times 10.000 (`rate_e4`: USD at Rp16.250 is 162500000). Rounding is half away from zero and
// done once, in BigInt, because the products pass 2^53 for large amounts.
import { toIdr } from '../../core/money';

// "16.250" -> 162500000, "16250,5" -> 162505000, "16.250,25" -> 162502500. Rupiah with at most two
// decimals (a comma), thousands dots optional. Anything else, zero or an absurd rate is null.
export function parseRateInput(text: string): number | null {
  const t = text.trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const whole = Number(m[1].replace(/\./g, ''));
  const frac = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  const rateE4 = whole * 10000 + frac * 100;
  // A rupiah rate for one unit of a currency: from a hundredth of a rupiah up to ten million.
  if (!Number.isSafeInteger(rateE4) || rateE4 <= 0 || whole > 10_000_000) return null;
  return rateE4;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  const n = numerator < 0n ? -numerator : numerator;
  const r = (n * 2n + denominator) / (2n * denominator);
  return numerator < 0n ? -r : r;
}

// What `rupiah` for `foreignMinor` of a currency implies, as a rate_e4 (rupiah per 1 major unit x 10.000).
export function impliedRateE4(rupiah: number, foreignMinor: number, minorFactor: number): number {
  if (foreignMinor <= 0) return 0;
  return Number(roundDiv(BigInt(rupiah) * 10000n * BigInt(minorFactor), BigInt(foreignMinor)));
}

export interface ExchangeSide {
  currency: string; // 'IDR' or a foreign code
  amount: number; // minor units
  minorFactor: number;
}

// How many rupiah an amount is worth at the latest rates; null when its currency has no rate (never 0).
export function valueIdr(side: ExchangeSide, rates: Readonly<Record<string, number>>): number | null {
  if (side.currency === 'IDR') return side.amount;
  const rate = rates[side.currency];
  return rate == null ? null : toIdr(side.amount, rate, side.minorFactor);
}

export type RateText =
  | { kind: 'idr'; currency: string; rateE4: number } // rupiah per 1 unit of `currency`
  | { kind: 'cross'; from: string; to: string; perUnitE4: number }; // units of `to` per 1 unit of `from`, x 10.000

export interface ExchangeSummary {
  yours: RateText | null; // the rate the two typed amounts imply
  latest: RateText | null; // the latest stored rate for the same pair
  differenceBp: number | null; // received value minus sent value, at the latest rates, in basis points of the sent value
  differenceIdr: number | null; // the same difference in whole rupiah: how far net worth moves
}

// The card on the Exchange form: the person's own rate, the latest stored one, and the difference.
// "You send" and "You receive" are typed exactly as the bank or exchange gave them; the rate is only
// worked out from them, never stored. Net worth moves only by the difference, because both pockets
// are valued at the same latest rates. Anything that cannot be worked out (a missing rate, an empty
// amount) is null, never zero.
export function exchangeSummary(from: ExchangeSide, to: ExchangeSide, rates: Readonly<Record<string, number>>): ExchangeSummary {
  const empty: ExchangeSummary = { yours: null, latest: null, differenceBp: null, differenceIdr: null };
  if (from.amount <= 0 || to.amount <= 0 || from.currency === to.currency) return empty;

  let yours: RateText;
  let latest: RateText | null;
  if (from.currency === 'IDR' || to.currency === 'IDR') {
    const foreign = from.currency === 'IDR' ? to : from;
    const rupiah = from.currency === 'IDR' ? from.amount : to.amount;
    yours = { kind: 'idr', currency: foreign.currency, rateE4: impliedRateE4(rupiah, foreign.amount, foreign.minorFactor) };
    latest = rates[foreign.currency] != null ? { kind: 'idr', currency: foreign.currency, rateE4: rates[foreign.currency] } : null;
  } else {
    // units of `to` per 1 unit of `from`
    const perUnit = roundDiv(BigInt(to.amount) * BigInt(from.minorFactor) * 10000n, BigInt(from.amount) * BigInt(to.minorFactor));
    yours = { kind: 'cross', from: from.currency, to: to.currency, perUnitE4: Number(perUnit) };
    const rf = rates[from.currency];
    const rt = rates[to.currency];
    latest = rf != null && rt != null ? { kind: 'cross', from: from.currency, to: to.currency, perUnitE4: Number(roundDiv(BigInt(rf) * 10000n, BigInt(rt))) } : null;
  }

  const sent = valueIdr(from, rates);
  const received = valueIdr(to, rates);
  if (sent == null || received == null || sent <= 0) return { yours, latest, differenceBp: null, differenceIdr: null };
  const differenceIdr = received - sent;
  const differenceBp = Number(roundDiv(BigInt(differenceIdr) * 10000n, BigInt(sent)));
  return { yours, latest, differenceBp, differenceIdr };
}
