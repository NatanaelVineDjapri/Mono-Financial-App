// The general parser of the notification import (docs/IMPORT_PLAN.md, section 6): used for every allowed app that
// has no parser of its own. It does NOT know any bank's format; it looks for what almost every Indonesian payment
// notification has in common (a rupiah amount, a verb that says money moved, sometimes "di <merchant>"), and
// everything it finds is marked "Ditebak" on the review screen. It prefers to throw a notification away rather
// than guess: no amount, a one-time code, a promotion, a bill reminder or no word for money moving gives null.
//
// Pure. The notification's title and text come in, only the parsed fields come out; nothing is stored or logged
// here, and the caller drops the text as soon as this returns.
export interface ParsedNotification {
  kind: 'income' | 'expense' | null; // null: not clear, the person chooses ("Perlu dicek")
  amountIdr: number; // whole rupiah, > 0
  merchant: string; // '' when none was found
}

const MAX_AMOUNT = 1_000_000_000_000;
const MERCHANT_MAX = 40;

// Never a transaction: one-time codes, logins, security text.
const SECURITY = /\b(otp|kode (?:verifikasi|otp|rahasia|keamanan)|verification code|one[- ]time|jangan (?:berikan|bagikan|beritahu)|kata sandi|password|passcode|masuk ke akun|login)\b/i;
// A reminder that a bill is due is not money moving yet.
const REMINDER = /\b(jatuh tempo|tagihan (?:anda|kamu|mu)|segera bayar|harap bayar|belum dibayar|batas waktu|mengingatkan|reminder)\b/i;
// Marketing: dropped unless the text also says money actually moved.
const PROMO = /\b(promo|diskon|voucher|hemat|dapatkan|gratis|undian|hadiah|ikuti|klaim|berlaku sampai|syarat dan ketentuan)\b/i;

const EXPENSE = [
  'pembayaran', 'membayar', 'dibayar', 'bayar', 'pembelian', 'membeli', 'belanja', 'debit', 'penarikan', 'tarik tunai',
  'transfer keluar', 'transfer ke', 'transfer dana ke', 'dikirim', 'mengirim', 'kirim uang', 'qris', 'kartu debit', 'payment', 'purchase', 'paid', 'spent', 'withdrawal',
];
const INCOME = [
  'menerima', 'diterima', 'dana masuk', 'uang masuk', 'transfer masuk', 'transfer dari', 'kredit', 'gaji', 'received',
  'refund', 'pengembalian dana', 'deposit',
];
// Money moved, but whether it is income or expense depends on the account: the person chooses.
const AMBIGUOUS = ['top up', 'topup', 'isi saldo', 'transfer berhasil', 'transaksi berhasil'];
// "Transfer" on its own (a bank's "Transfer Dana Berhasil Rp...") says money moved but not which way. It only counts when no clearer
// word is there ("transfer ke Budi" is still an expense), so it never turns a clear direction into "choose".
const WEAK_MONEY_WORDS = ['transfer'];

function containsAny(haystack: string, words: readonly string[]): boolean {
  return words.some(w => new RegExp(`(?:^|[^a-z])${w.replace(/ /g, '\\s+')}(?:[^a-z]|$)`, 'i').test(haystack));
}

// "Rp25.000", "Rp 1.250.000,00", "IDR 25,000.00", "Rp25000". The last separator followed by one or two digits is the
// decimal part (dropped: a notification shows whole rupiah), every other separator is a thousands mark.
function toRupiah(raw: string): number | null {
  const match = raw.match(/^(\d[\d.,]*?)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const whole = match[1].replace(/[.,]/g, '');
  if (!whole || whole.length > 13) return null;
  let value = Number(whole);
  if (match[2] && Number(match[2]) * (match[2].length === 1 ? 10 : 1) >= 50) value += 1; // half up
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT ? value : null;
}

// What comes right before an amount says what it is: a balance, a limit or a minimum is never the payment.
const NOT_THE_PAYMENT = /(saldo|sisa|balance|limit|minimal|minimum|total tagihan|biaya admin|admin fee|cashback)(?:\W+(?:anda|kamu|mu|akhir|tersisa|saat|ini))*\W*$/i;

export function findAmount(text: string): number | null {
  const re = /(?:rp\.?|idr)\s*(\d[\d.,]*)/gi;
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 28), m.index ?? 0);
    if (NOT_THE_PAYMENT.test(before)) continue;
    const value = toRupiah(m[1]);
    if (value !== null) return value;
  }
  return null;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s)([a-z])/g, (_all, space: string, letter: string) => space + letter.toUpperCase());
}

function cleanMerchant(raw: string): string {
  let text = raw
    .replace(/\b\d{6,}\b/g, ' ') // account, phone and reference numbers
    .replace(/\b(?:rp|idr)\.?\s*\d[\d.,]*/gi, ' ')
    .replace(/[|*_#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 2 || !/[a-z]/i.test(text)) return '';
  if (text === text.toUpperCase()) text = titleCase(text); // SHOUTED names read better in Title Case
  return text.slice(0, MERCHANT_MAX).trim();
}

const STOP = '(?=\\s+(?:pada|tanggal|tgl|jam|pukul|sebesar|senilai|dengan|via|melalui|menggunakan|ref|no|nomor|berhasil|sukses|telah)\\b|\\s+(?:rp|idr)(?=\\d|\\s|\\.)|\\s+\\d|[\\n.,;:()|]|$)';
const TO = new RegExp(`\\b(?:di|ke|kepada|untuk|to|at)\\s+(?!rekening\\b|bank\\b|akun\\b|saldo\\b|kamu\\b|anda\\b)([^\\n.,;:()|]{2,60}?)${STOP}`, 'i');
const FROM = new RegExp(`\\b(?:dari|from)\\s+(?!rekening\\b|bank\\b|akun\\b|saldo\\b|kamu\\b|anda\\b)([^\\n.,;:()|]{2,60}?)${STOP}`, 'i');

function findMerchant(text: string, kind: ParsedNotification['kind']): string {
  const order = kind === 'income' ? [FROM, TO] : kind === 'expense' ? [TO, FROM] : [TO, FROM];
  for (const re of order) {
    const m = text.match(re);
    if (m) {
      const merchant = cleanMerchant(m[1]);
      if (merchant) return merchant;
    }
  }
  return '';
}

// Why a notification was thrown away: only these codes are ever kept (counted per app, so the person can see why an app's
// notifications do not turn into transactions); the text itself is never kept.
export type DropReason = 'empty' | 'security' | 'reminder' | 'no_amount' | 'no_money_word' | 'promo';

export type GenericOutcome = { parsed: ParsedNotification; dropped?: undefined } | { parsed: null; dropped: DropReason };

export function explainGeneric(title: string | null, text: string | null): GenericOutcome {
  const original = [title, text].filter((part): part is string => !!part && part.trim().length > 0).join(' \n ');
  if (!original) return { parsed: null, dropped: 'empty' };
  const lower = original.toLowerCase();

  if (SECURITY.test(lower)) return { parsed: null, dropped: 'security' };
  if (REMINDER.test(lower)) return { parsed: null, dropped: 'reminder' };

  const amountIdr = findAmount(original);
  if (amountIdr === null) return { parsed: null, dropped: 'no_amount' };

  const expense = containsAny(lower, EXPENSE);
  const income = containsAny(lower, INCOME);
  const ambiguous = containsAny(lower, AMBIGUOUS);
  // No word for money moving: not a transaction. A promotion is dropped unless something clearly moved.
  const weak = containsAny(lower, WEAK_MONEY_WORDS);
  if (!expense && !income && !ambiguous && !weak) return { parsed: null, dropped: 'no_money_word' };
  if (PROMO.test(lower) && !expense && !income) return { parsed: null, dropped: 'promo' };

  const kind: ParsedNotification['kind'] = expense && !income && !ambiguous ? 'expense' : income && !expense && !ambiguous ? 'income' : null;
  return { parsed: { kind, amountIdr, merchant: findMerchant(original, kind) } };
}

export function parseGeneric(title: string | null, text: string | null): ParsedNotification | null {
  return explainGeneric(title, text).parsed;
}
