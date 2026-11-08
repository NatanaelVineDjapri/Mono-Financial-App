// Money is an integer of whole rupiah; percentages are basis points (10000 = 100%).
// Own formatter on purpose: Hermes `Intl` support differs by device. See DESIGN.md section 16.

const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function rp(v: number, sign = false): string {
  const n = dots(Math.abs(v));
  if (v < 0) return `−Rp${n}`; // true minus sign (U+2212), not a hyphen
  return sign && v > 0 ? `+Rp${n}` : `Rp${n}`;
}

// 6810 -> "68,10%". Integer maths only. `sign` mirrors rp()'s own flag: a leading "+" on
// a positive value, e.g. for a month-over-month change ("+37,63%").
export function pct(bp: number, sign = false): string {
  const a = Math.abs(bp);
  const s = `${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}%`;
  if (bp < 0) return `−${s}`; // true minus sign (U+2212)
  return sign && bp > 0 ? `+${s}` : s;
}

// Whole rupiah, compact for tight spaces (a bar chart's own value label): 640000 ->
// "640k", 812000 -> "812k". Rounds to the nearest thousand, half away from zero — a chart
// label, never the exact figure a screen states elsewhere (that's rp(), always).
export function rpCompact(v: number): string {
  const a = Math.abs(v);
  const k = Math.floor((a + 500) / 1000);
  return `${v < 0 ? '−' : ''}${k}k`;
}

// Foreign amounts. minorFactor comes from the `currencies` table (100 for USD, 1 for JPY and KRW).
const SYMBOL: Record<string, string> = {
  USD: 'US$',
  SGD: 'S$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  HKD: 'HK$',
  CNY: 'CN¥',
  MYR: 'RM',
  KRW: '₩',
  THB: '฿',
  SAR: 'SAR ',
};

export function money(minor: number, code: string, minorFactor: number, sign = false): string {
  const a = Math.abs(minor);
  const digits = String(minorFactor).length - 1; // 100 -> 2, 1 -> 0
  const whole = dots(Math.floor(a / minorFactor));
  const frac = digits ? ',' + String(a % minorFactor).padStart(digits, '0') : '';
  const body = `${SYMBOL[code] ?? code + ' '}${whole}${frac}`;
  return minor < 0 ? `−${body}` : sign && minor > 0 ? `+${body}` : body;
}

// amount (minor units) at rate_e4 -> whole rupiah, half away from zero, one rounding.
// BigInt because minor * rateE4 passes 2^53 for amounts above about US$5.000.000.
export function toIdr(minor: number, rateE4: number, minorFactor: number): number {
  const n = BigInt(minor) * BigInt(rateE4);
  const d = BigInt(10000 * minorFactor);
  const a = n < 0n ? -n : n;
  const r = (a * 2n + d) / (2n * d);
  return Number(n < 0n ? -r : r);
}

// The single gate for hidden-amounts mode (CLAUDE.md rule 12): every currency figure
// passes through this before rendering. Masks to a fixed placeholder so layout width
// does not jump between shown and hidden state.
export function shown(formatted: string, hidden: boolean): string {
  return hidden ? 'Rp••••••••' : formatted; // 8 bullets (U+2022)
}
