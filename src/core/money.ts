// Money is an integer of whole rupiah; percentages are basis points (10000 = 100%).
// Own formatter on purpose: Hermes `Intl` support differs by device. See DESIGN.md section 16.

const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function rp(v: number, sign = false): string {
  const n = dots(Math.abs(v));
  if (v < 0) return `−Rp${n}`; // true minus sign, not a hyphen
  return sign && v > 0 ? `+Rp${n}` : `Rp${n}`;
}

// 6810 -> "68,10%". Integer maths only.
export function pct(bp: number): string {
  const a = Math.abs(bp);
  const s = `${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}%`;
  return bp < 0 ? `−${s}` : s;
}

// The single gate for hidden-amounts mode (CLAUDE.md rule 12): every currency figure
// passes through this before rendering. Masks to a fixed placeholder so layout width
// does not jump between shown and hidden state.
export function shown(formatted: string, hidden: boolean): string {
  return hidden ? 'Rp••••••••' : formatted;
}
