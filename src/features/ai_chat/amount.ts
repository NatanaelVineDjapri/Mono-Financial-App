// A local reading of rupiah amounts typed in Indonesian shorthand, used to cross-check the
// model's number (CLAUDE.md rule 9): the model's amount must equal a number that is really in
// the typed message. Integer maths only; anything ambiguous is null, never a guess.
//   "25rb" "25 ribu" "25k"  = 25.000        "1,5jt" "1.5 jt" "1,5 juta" = 1.500.000
//   "150000" "150.000" "rp150.000" = 150.000   "1.500" = 1.500 (a thousands dot)
//   "1,5" and "2k5" are not recognised.
import { MAX_AMOUNT } from '../../core/tx/validate';

const MULTIPLIER: Record<string, number> = { rb: 1000, ribu: 1000, k: 1000, jt: 1000000, juta: 1000000 };

const PLAIN = /^\d+$/;
const GROUPED = /^\d{1,3}([.,]\d{3})+$/;
const DECIMAL = /^(\d+)[.,](\d{1,2})$/;

function safe(n: number): number | null {
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_AMOUNT ? n : null;
}

// One amount as typed ("25rb", "Rp 150.000") to whole rupiah, or null.
export function parseRupiah(text: string | null | undefined): number | null {
  if (text == null) return null;
  const t = text
    .toLowerCase()
    .trim()
    .replace(/^rp\.?\s*/, '')
    .replace(/\s+/g, ' ');
  const m = /^(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?$/.exec(t);
  if (!m) return null;
  const [, digits, suffix] = m;

  if (!suffix) {
    if (PLAIN.test(digits)) return safe(Number(digits));
    if (GROUPED.test(digits)) return safe(Number(digits.replace(/[.,]/g, '')));
    return null;
  }

  const factor = MULTIPLIER[suffix];
  if (PLAIN.test(digits)) return safe(Number(digits) * factor);
  if (GROUPED.test(digits)) return safe(Number(digits.replace(/[.,]/g, '')) * factor);
  const d = DECIMAL.exec(digits);
  if (d) {
    const scale = 10 ** d[2].length;
    const scaled = (Number(d[1]) * scale + Number(d[2])) * factor;
    return scaled % scale === 0 ? safe(scaled / scale) : null;
  }
  return null;
}

export interface AmountCandidate {
  text: string;
  value: number;
}

// Every amount-looking number in the person's own message, in order of appearance.
export function extractAmountCandidates(message: string): AmountCandidate[] {
  const found: AmountCandidate[] = [];
  const pattern = /(?:rp\.?\s*)?(\d[\d.,]*)(?:\s*(rb|ribu|k|jt|juta)(?![a-z0-9]))?/gi;
  for (const m of message.matchAll(pattern)) {
    const text = m[0].replace(/[.,]+$/, '').trim();
    const value = parseRupiah(text);
    if (value != null) found.push({ text, value });
  }
  return found;
}
