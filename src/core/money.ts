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

// 335 (permille) -> "33,5%". One decimal, integer maths only: the Overview's category
// shares, rounded with largestRemainderSharesBp(values, total, 1000) so they add to 100,0%.
export function pct1(permille: number, sign = false): string {
  const a = Math.abs(permille);
  const s = `${Math.floor(a / 10)},${a % 10}%`;
  if (permille < 0) return `−${s}`;
  return sign && permille > 0 ? `+${s}` : s;
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

// "S$" for SGD: the short symbol money() prefixes, for a rate line like "S$1 = Rp12.500".
export function currencySymbol(code: string): string {
  return SYMBOL[code] ?? `${code} `;
}

// A rate_e4 (rupiah per 1 major unit, times 10.000) as rupiah: "Rp12.500", or "Rp12.500,25"
// when it is not a whole number (two decimals at most, half away from zero).
export function rateRp(rateE4: number): string {
  const hundredths = Math.floor((rateE4 + 50) / 100);
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  return frac === 0 ? rp(whole) : `${rp(whole)},${String(frac).padStart(2, '0')}`;
}

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

// Hidden-amounts mode also covers the Overview's percentages (month-over-month change,
// category shares): next to a masked amount they would still leak the ratio. Same fixed
// width idea as shown() — "••,••%" is as wide as "12,34%".
export function shownPct(formatted: string, hidden: boolean): string {
  return hidden ? '••,••%' : formatted;
}

// A chart's y-axis label ("8", "12", "500k") is an amount too: hidden mode masks it, at a
// short fixed width so the axis gutter does not jump.
export function shownCompact(formatted: string, hidden: boolean): string {
  return hidden ? '•••' : formatted;
}
