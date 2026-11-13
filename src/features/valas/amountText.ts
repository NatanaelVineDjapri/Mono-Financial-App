// What a person types for an amount of foreign money, and back. Integers only (CLAUDE.md rule 1): the
// text becomes minor units of the currency (cents for USD, whole yen for JPY), never a float.
//
// The keyboard may give "." or "," for the decimal mark and a person may also type a thousands mark, so
// the LAST separator is the decimal mark when it is followed by at most as many digits as the currency
// has (US$: 2), and a thousands mark otherwise ("1.250" is one thousand two hundred fifty dollars when
// the currency has cents, "250,5" is two hundred fifty and a half). A currency without minor units
// (yen) has no decimal mark: every separator is a thousands mark and must be followed by three digits.

export function decimalsOf(minorFactor: number): number {
  let d = 0;
  for (let f = minorFactor; f > 1; f = Math.round(f / 10)) d += 1;
  return d;
}

// null when the text is empty or is not an amount.
export function parseCurrencyText(text: string, minorFactor: number): number | null {
  const t = text.trim().replace(/\s+/g, '');
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const decimals = decimalsOf(minorFactor);
  const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));

  let whole: string;
  let fraction = '';
  if (last < 0) {
    whole = t;
  } else {
    const after = t.slice(last + 1);
    const before = t.slice(0, last);
    if (decimals > 0 && after.length <= decimals) {
      if (!/^(\d*|\d{1,3}([.,]\d{3})+)$/.test(before)) return null;
      whole = before.replace(/[.,]/g, '');
      fraction = after;
    } else {
      // The separator is a thousands mark: every separator must split groups of three digits.
      if (!/^\d{1,3}([.,]\d{3})+$/.test(t)) return null;
      whole = t.replace(/[.,]/g, '');
    }
  }
  if (whole === '' && fraction === '') return null;
  if (whole === '') whole = '0';
  if (!/^\d+$/.test(whole) || (fraction !== '' && !/^\d+$/.test(fraction))) return null;
  const minor = Number(whole) * minorFactor + (decimals > 0 ? Number(fraction.padEnd(decimals, '0') || '0') : 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

// Minor units as the text a person edits: "25000" (cents) -> "250,00"; yen stay whole. No thousands
// marks, so it parses back to the same number.
export function currencyInputText(minor: number, minorFactor: number): string {
  const decimals = decimalsOf(minorFactor);
  const sign = minor < 0 ? '-' : '';
  const a = Math.abs(minor);
  if (decimals === 0) return `${sign}${a}`;
  const whole = Math.floor(a / minorFactor);
  const frac = String(a % minorFactor).padStart(decimals, '0');
  return `${sign}${whole},${frac}`;
}
