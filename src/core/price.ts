// Stock prices and share quantities are integers times 10.000 (e4). Parsing what a person types and showing it again.
import { getNumberFormat } from './money';

export const E4 = 10_000;

// "6.000" and "1.250,5" (Indonesian), "358.54" (as a broker shows a US price). Null when it is not a positive number
// with at most four decimals.
export function parseE4(text: string): number | null {
  let t = text.trim().replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const m = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(t);
  if (!m) return null;
  const value = Number(m[1]) * E4 + Number((m[2] ?? '').padEnd(4, '0') || 0);
  return value > 0 && Number.isSafeInteger(value) ? value : null;
}

// 3585400 -> "358,54"; 60000000 -> "6.000"; up to four decimals, trailing zeros left out.
export function formatE4(value: number, fmt = getNumberFormat()): string {
  const a = Math.abs(value);
  const whole = String(Math.floor(a / E4)).replace(/\B(?=(\d{3})+(?!\d))/g, fmt === 'en_US' ? ',' : '.');
  const frac = String(a % E4).padStart(4, '0').replace(/0+$/, '');
  return `${value < 0 ? '−' : ''}${whole}${frac ? `${fmt === 'en_US' ? '.' : ','}${frac}` : ''}`;
}

// A price in its own currency: "Rp6.000", "USD 358,54".
export function priceText(value: number, currency: string): string {
  return currency === 'IDR' ? `Rp${formatE4(value)}` : `${currency} ${formatE4(value)}`;
}

// The Indonesian exchange trades in lots of 100 shares; elsewhere a lot is one share.
export function lotSize(symbol: string): number {
  return symbol.toUpperCase().endsWith('.JK') ? 100 : 1;
}
