// Reading a receipt's text (Receipt-Scan / Receipt-Review). Pure: the lines of text the
// on-device OCR returned in, a small result out. No database, no UI, no network, and nothing
// from the text is kept beyond the few fields returned here.
//
// What it finds:
//   - the total: lines named TOTAL / GRAND TOTAL / JUMLAH / TOTAL BAYAR (and weaker hints such
//     as a card payment line) are scored; SUBTOTAL, TUNAI, KEMBALI, PPN, DISKON and the like are
//     never the total. When two or more candidates score close to each other all of them are
//     returned, best first, for the review screen to show as chips.
//   - the date (28/10/2026, 28-10-26, 28 Okt 2026), the receipt's own when it is a real date that
//     is not in the future, otherwise today.
//   - the shop's name: the first meaningful line at the top that is not an address, a phone
//     number or a legal-entity line when a better one exists.
//   - whether the receipt is in a foreign currency (not supported yet).
//
// OCR mistakes are expected: O/o read for 0, l/I/| for 1 and S/s for 5 are repaired, but only
// inside something that already looks like a number (a digit group with separators, or a label
// is matched after the same repair), never in ordinary words. Amounts go through the existing
// parseRupiah, so 48.000, 48,000 and 48000 all mean Rp48.000.
import { MAX_AMOUNT } from '../../core/tx/validate';
import { parseRupiah } from '../ai_chat/amount';

export interface TotalCandidate {
  amount: number; // whole rupiah
  score: number; // higher is more likely the total
}

export interface ParsedReceipt {
  merchant: string | null;
  date: string; // 'YYYY-MM-DD': the receipt's date, or today
  dateFromReceipt: boolean;
  // The best candidate first, then every other one whose score is close to it (at most MAX_CHIPS).
  totals: TotalCandidate[];
  // The receipt is in a foreign currency: not supported yet.
  foreignCurrency: boolean;
}

export const MIN_TOTAL = 100;
export const CLOSE_SCORE = 15;
export const MAX_CHIPS = 3;

// ---------------------------------------------------------------- numbers

const FIX: Record<string, string> = { O: '0', o: '0', I: '1', l: '1', '|': '1', S: '5', s: '5' };

// "4S.OOO" -> "45.000". Only ever applied to a token that already looks like a number.
function fixDigits(token: string): string {
  return token.replace(/[OoIl|Ss]/g, c => FIX[c]);
}

const DIGIT = '[0-9OoIl|Ss]';
// A grouped amount (48.000 / 1.250.000 / 48,000, with an optional .00 / ,00 tail) or a plain run of
// 3 to 9 real digits (a longer run is a phone or card number). The character before must not be a letter or digit, the one after neither.
const AMOUNT_TOKEN = new RegExp(`(?:^|[^A-Za-z0-9.,])(${DIGIT}{1,3}(?:[.,]${DIGIT}{3})+(?:[.,]${DIGIT}{2})?|[0-9]{3,9})(?![A-Za-z0-9])`, 'g');

function stripCurrency(line: string): string {
  return line.replace(/\b(?:RP|IDR)\.?\s*(?=[0-9])/gi, ' ').replace(/Rp(?=[0-9])/g, ' ');
}

// One token as rupiah, or null: no real digit at all ("S.OOO" is not a number), a ".00" tail dropped,
// then parseRupiah.
function tokenToRupiah(token: string): number | null {
  if (!/[0-9]/.test(token)) return null;
  let t = fixDigits(token);
  const tail = /^(\d{1,3}(?:[.,]\d{3})+)[.,]\d{2}$/.exec(t);
  if (tail) t = tail[1];
  const value = parseRupiah(t);
  return value != null && value >= MIN_TOTAL && value <= MAX_AMOUNT ? value : null;
}

// Every amount on a line, left to right.
export function amountsOnLine(line: string): number[] {
  const out: number[] = [];
  for (const m of stripCurrency(line).matchAll(AMOUNT_TOKEN)) {
    const value = tokenToRupiah(m[1]);
    if (value != null) out.push(value);
  }
  return out;
}

// A line that is only an amount (and maybe Rp): the value half of a split label/value pair.
function isAmountOnly(line: string): boolean {
  const rest = stripCurrency(line).replace(AMOUNT_TOKEN, ' ').replace(/[\s:=.,*\-_/]+/g, '');
  return rest === '' && amountsOnLine(line).length > 0;
}

// ---------------------------------------------------------------- labels

type Kind = 'subtotal' | 'grand' | 'total' | 'sum' | 'pay' | 'card' | 'cash' | 'change' | 'noise';

// Upper-case letters only, with the O/0 confusion repaired next to letters ("T0TAL" -> "TOTAL").
function labelOf(line: string): string {
  let s = line.toUpperCase().replace(/[^A-Z0-9%+ ]+/g, ' ');
  s = s.replace(/([A-Z])0/g, '$1O').replace(/0([A-Z])/g, 'O$1').replace(/([A-Z])0/g, '$1O');
  return s.replace(/\s+/g, ' ').trim();
}

const SUBTOTAL = /\bSUB ?TOTAL\b|\bSUBTOT\b|\bSUB TTL\b/;
const GRAND =
  /\bGRAND ?TOTAL\b|\bTOTAL (BAYAR|BELANJA|TAGIHAN|AKHIR|PEMBAYARAN|PEMBELIAN|HARUS DIBAYAR|DIBAYAR|SETELAH)\b|\bJUMLAH (BAYAR|TAGIHAN|AKHIR)\b|\bAMOUNT (DUE|PAYABLE)\b|\bTOTAL DUE\b|\bTAGIHAN\b|\bNETTO\b|\bNET TOTAL\b/;
const TOTAL_BAD_SUFFIX =
  /\bTOTAL (ITEM|ITEMS|QTY|BARANG|DISKON|DISC\w*|HEMAT|PPN|PAJAK|TAX|PB1|POTONGAN|POIN|SAVING|SAVINGS|PROMO|ADMIN|SERVICE|SVC|KEMBALI|TUNAI|CASH|TRANSAKSI|PRODUK|PCS)\b/;
const TOTAL = /\bTOTAL\b|\bTTL\b/;
const CHANGE = /\b(KEMBALI|KEMBALIAN|KMBL|CHANGE|SISA)\b/;
const CASH = /\b(TUNAI|CASH|UANG DITERIMA|DITERIMA|BAYAR TUNAI|TUNA1)\b/;
const NOISE = /\b(PPN|PB1|PBI|TAX|PAJAK|DISKON|DISC\w*|POTONGAN|HEMAT|SERVICE|SERVIS|SVC|DPP|POIN|POINT|ADMIN|BIAYA|ONGKIR|PACKING|PEMBULATAN)\b/;
const SUM = /\b(JUMLAH|JML|JMLH)\b(?! ?(ITEM|BARANG|QTY|PCS|PRODUK))/;
const CARD =
  /\b(DEBIT|KREDIT|CREDIT|KARTU|QRIS|GOPAY|OVO|DANA|SHOPEEPAY|LINKAJA|EDC|VISA|MASTERCARD|MASTER|FLAZZ|BRIZZI|TAPCASH|E ?MONEY|BCA|MANDIRI|BNI|BRI|CIMB|JENIUS)\b/;
const PAY = /\b(BAYAR|PEMBAYARAN|PAYMENT)\b/;

export function classify(line: string): Kind | null {
  const label = labelOf(line);
  if (SUBTOTAL.test(label)) return 'subtotal';
  if (GRAND.test(label) && !TOTAL_BAD_SUFFIX.test(label)) return 'grand';
  if (TOTAL_BAD_SUFFIX.test(label)) return 'noise';
  if (TOTAL.test(label)) return 'total';
  if (CHANGE.test(label)) return 'change';
  if (CASH.test(label)) return 'cash';
  if (NOISE.test(label)) return 'noise';
  if (SUM.test(label)) return 'sum';
  if (CARD.test(label)) return 'card';
  if (PAY.test(label)) return 'pay';
  return null;
}

const BASE_SCORE: Partial<Record<Kind, number>> = { grand: 100, total: 90, sum: 80, pay: 60, card: 55 };
const DERIVED_SCORE = 60; // tunai minus kembali

// ---------------------------------------------------------------- split label / value columns

// OCR often returns the labels as one block and the values as another:
//   TOTAL / TUNAI / KEMBALI / 48.000 / 50.000 / 2.000
// A run of label-only lines followed by a run of value-only lines is put back together pairwise.
export function pairColumns(lines: readonly string[]): string[] {
  const items = lines.map(l => l.trim()).filter(l => l.length > 0);
  const labelOnly = (l: string) => classify(l) != null && amountsOnLine(l).length === 0;
  const out: string[] = [];
  let i = 0;
  while (i < items.length) {
    if (!labelOnly(items[i])) {
      out.push(items[i]);
      i += 1;
      continue;
    }
    let labelEnd = i;
    while (labelEnd < items.length && labelOnly(items[labelEnd])) labelEnd += 1;
    let valueEnd = labelEnd;
    while (valueEnd < items.length && isAmountOnly(items[valueEnd])) valueEnd += 1;
    const labels = items.slice(i, labelEnd);
    const values = items.slice(labelEnd, valueEnd);
    if (values.length >= labels.length) {
      labels.forEach((label, k) => out.push(`${label} ${values[k]}`));
      out.push(...values.slice(labels.length));
      i = valueEnd;
    } else {
      out.push(...labels);
      i = labelEnd;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the total

export function findTotals(lines: readonly string[]): TotalCandidate[] {
  const paired = pairColumns(lines);

  let cash: number | null = null;
  let change: number | null = null;
  const found = new Map<number, { base: number; support: number }>();
  const add = (amount: number, base: number) => {
    const known = found.get(amount);
    if (!known) found.set(amount, { base, support: 0 });
    else if (base > known.base) found.set(amount, { base, support: known.support + 1 });
    else found.set(amount, { base: known.base, support: known.support + 1 });
  };

  for (const line of paired) {
    const kind = classify(line);
    if (!kind) continue;
    const amounts = amountsOnLine(line);
    if (amounts.length === 0) continue;
    const value = amounts[amounts.length - 1]; // the value column is the rightmost
    if (kind === 'cash') cash = cash == null ? value : Math.max(cash, value);
    else if (kind === 'change') change = change == null ? value : Math.max(change, value);
    else if (BASE_SCORE[kind] != null) add(value, BASE_SCORE[kind] as number);
  }

  const derived = cash != null && change != null && cash > change ? cash - change : null;
  if (derived != null && derived >= MIN_TOTAL) add(derived, DERIVED_SCORE);

  const scored: TotalCandidate[] = [...found.entries()].map(([amount, { base, support }]) => {
    let score = base + Math.min(support, 2) * 8;
    if (derived != null && amount === derived && base !== DERIVED_SCORE) score += 15;
    // A total cannot be more than the cash handed over.
    if (cash != null && amount > cash && !(derived != null && amount === derived)) score -= 15;
    return { amount, score };
  });
  scored.sort((a, b) => b.score - a.score || b.amount - a.amount);
  if (scored.length === 0) return [];
  const top = scored[0].score;
  return scored.filter(c => top - c.score <= CLOSE_SCORE).slice(0, MAX_CHIPS);
}

// ---------------------------------------------------------------- the date

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGT: 8, AGS: 8, AUG: 8,
  SEP: 9, OKT: 10, OCT: 10, NOV: 11, NOP: 11, DES: 12, DEC: 12,
};

const D = '[0-9OoIl]';
const NUMERIC_DATE = new RegExp(`(?:^|[^0-9A-Za-z])(${D}{1,2})[/.\\-](${D}{1,2})[/.\\-](${D}{4}|${D}{2})(?![0-9A-Za-z])`, 'g');
const ISO_DATE = new RegExp(`(?:^|[^0-9A-Za-z])(${D}{4})[/.\\-](${D}{1,2})[/.\\-](${D}{1,2})(?![0-9A-Za-z])`, 'g');
const TEXT_DATE = new RegExp(`(?:^|[^0-9A-Za-z])(${D}{1,2})[\\s\\-/.]*([A-Za-z]{3,9})[\\s\\-/.,]*(${D}{4}|${D}{2})(?![0-9A-Za-z])`, 'g');

const num = (s: string) => Number(fixDigits(s).replace(/\D/g, ''));
const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function makeDate(day: number, month: number, year: number): string | null {
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || y < 2000 || y > 2100) return null;
  if (day > daysInMonth(y, month)) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

// Every real date in the text, in order of appearance.
export function datesIn(lines: readonly string[]): string[] {
  const found: string[] = [];
  for (const line of lines) {
    const hits: { index: number; date: string }[] = [];
    for (const m of line.matchAll(NUMERIC_DATE)) {
      const [a, b, y] = [num(m[1]), num(m[2]), num(m[3])];
      // dd/mm is the Indonesian order; mm/dd only when dd/mm cannot be a date.
      const date = makeDate(a, b, y) ?? (b > 12 ? makeDate(b, a, y) : null);
      if (date) hits.push({ index: m.index ?? 0, date });
    }
    for (const m of line.matchAll(ISO_DATE)) {
      const date = makeDate(num(m[3]), num(m[2]), num(m[1]));
      if (date) hits.push({ index: m.index ?? 0, date });
    }
    for (const m of line.matchAll(TEXT_DATE)) {
      const month = MONTHS[m[2].slice(0, 3).toUpperCase()];
      const date = month ? makeDate(num(m[1]), month, num(m[3])) : null;
      if (date) hits.push({ index: m.index ?? 0, date });
    }
    hits.sort((p, q) => p.index - q.index);
    found.push(...hits.map(h => h.date));
  }
  return found;
}

// The first date that is real and not later than today (an old receipt keeps its own date; the
// form's rules, such as "before the account opened", judge it); otherwise today.
export function findDate(lines: readonly string[], today: string): { date: string; fromReceipt: boolean } {
  const date = datesIn(lines).find(d => d <= today);
  return date ? { date, fromReceipt: true } : { date: today, fromReceipt: false };
}

// ---------------------------------------------------------------- the shop's name

const NOT_A_NAME =
  /\b(JL|JLN|JALAN|NO|RT|RW|KEL|KELURAHAN|KEC|KECAMATAN|KOTA|KAB|KABUPATEN|GEDUNG|LT|BLOK|RUKO|TELP|TLP|TELEPON|PHONE|HP|WA|FAX|NPWP|NPPKP|WWW|HTTP|HTTPS|STRUK|STRUCK|NOTA|RECEIPT|INVOICE|BILL|KASIR|CASHIER|OPERATOR|TERIMA KASIH|SELAMAT DATANG|WELCOME|THANK YOU|TANGGAL|DATE|JAM|TIME|NO TRANS\w*|ORDER|MEJA|TABLE|PESANAN|DINE IN|TAKE AWAY|ITEM|QTY|HARGA|PRICE)\b/;
const LEGAL = /^(PT|CV|UD|PD)\b/;

function looksLikeName(line: string): boolean {
  const text = line.trim();
  if (text.length < 3) return false;
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 3 || letters < text.replace(/\s/g, '').length / 2) return false;
  if (/\d{6,}/.test(text.replace(/[\s.\-()]/g, ''))) return false; // a phone or id number
  if (/@|\.com\b|\.co\.id\b/i.test(text)) return false;
  if (datesIn([text]).length > 0 || /\b\d{1,2}[:.]\d{2}\b/.test(text)) return false;
  if (amountsOnLine(text).length > 0) return false;
  const kind = classify(text);
  if (kind === 'subtotal' || kind === 'grand' || kind === 'total' || kind === 'sum' || kind === 'cash' || kind === 'change') return false;
  return !NOT_A_NAME.test(labelOf(text));
}

// Words that stay in capitals when a shouting name is tidied: abbreviations and anything with no vowel.
const KEEP_CAPS = new Set(['PT', 'CV', 'UD', 'PD', 'RM', 'TB', 'TK', 'BCA', 'BNI', 'BRI', 'KFC', 'ATM', 'SPBU', 'RS']);
const keepCaps = (w: string) => w.length <= 4 && /^[A-Z]+$/.test(w) && (KEEP_CAPS.has(w) || !/[AEIOU]/.test(w));

function tidyName(line: string): string {
  const cleaned = line.replace(/[*#_=~|<>]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.,:;-]+$/, '').trim();
  const letters = cleaned.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  const name = allCaps
    ? cleaned
        .replace(/([A-Z])0/g, '$1O')
        .replace(/0([A-Z])/g, 'O$1')
        .split(' ')
        .map(w => (keepCaps(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(' ')
    : cleaned;
  return name.slice(0, 60);
}

export function findMerchant(lines: readonly string[]): string | null {
  const head = lines.map(l => l.trim()).filter(l => l.length > 0).slice(0, 8);
  const names = head.filter(looksLikeName);
  if (names.length === 0) return null;
  const chosen = names.find(n => !LEGAL.test(labelOf(n))) ?? names[0];
  const tidy = tidyName(chosen);
  if (tidy.length < 3) return null;
  // A branch on the next line ("@ KEMANG") belongs to the name.
  const next = head[head.indexOf(chosen) + 1];
  const branch = next && /^@\s*[A-Za-z][A-Za-z .'-]{2,}$/.test(next) && classify(next) == null ? tidyName(next) : '';
  return branch ? `${tidy} ${branch}`.slice(0, 60) : tidy;
}

// ---------------------------------------------------------------- foreign currency

const FOREIGN = /\b(USD|SGD|EUR|MYR|JPY|AUD|GBP|HKD|THB|CNY)\b|US\$|S\$|A\$|€|£|¥|\$\s?\d|\bRM\s?\d/i;
const RUPIAH = /\b(RP|IDR)\b|\bRp(?=\d)/i;

export function isForeignCurrency(lines: readonly string[]): boolean {
  const text = lines.join('\n');
  return FOREIGN.test(text) && !RUPIAH.test(text);
}

// ---------------------------------------------------------------- the whole receipt

export function parseReceipt(lines: readonly string[], today: string): ParsedReceipt {
  const cleaned = lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 0);
  const { date, fromReceipt } = findDate(cleaned, today);
  return {
    merchant: findMerchant(cleaned),
    date,
    dateFromReceipt: fromReceipt,
    totals: findTotals(cleaned),
    foreignCurrency: isForeignCurrency(cleaned),
  };
}

// The receipt gives a total the person can check: not foreign, and at least one candidate.
export function isReadable(parsed: ParsedReceipt): boolean {
  return !parsed.foreignCurrency && parsed.totals.length > 0;
}
