// Every user-facing string lives here (CLAUDE.md working agreement: one module, so a
// second language stays possible later). This file currently only has the 13 guard-code
// messages — the rest of the app's copy is written screen by screen, later phases.
import type { AccountType } from '../data/repo/accounts';
import type { GuardCode } from '../domain/errors';

// Extra numbers a pre-check already computed, to make a message specific (e.g. the
// real shortfall) instead of generic. Filled in by the domain layer, never guessed from
// the bare SQLite error — if a guard fires without a matching pre-check, the message
// falls back to the code's generic form. shortfallFormatted arrives pre-formatted
// (rp() for an IDR pocket, money() for a foreign one) since id.ts does not know which
// pocket a shortfall belongs to.
export interface GuardMessageContext {
  shortfallFormatted?: string; // insufficient_balance
  currency?: string; // currency_not_in_account, missing_fx_rate
}

const guardMessages: Record<GuardCode, (ctx: GuardMessageContext) => string> = {
  future_date: () => 'Tanggalnya gak boleh di masa depan.',
  before_opening_date: () => 'Itu sebelum akunmu dibuka.',
  category_kind_mismatch: () => 'Pilih kategori yang sesuai jenis transaksinya.',
  insufficient_balance: ctx => (ctx.shortfallFormatted ? `Kurang ${ctx.shortfallFormatted}.` : 'Saldonya gak cukup.'),
  budget_needs_expense_category: () => 'Anggaran cuma buat kategori pengeluaran.',
  over_monthly_limit: () => 'Naikkan batas bulanan dulu.',
  budgets_exist_for_month: () => 'Hapus anggarannya dulu.',
  currency_not_in_account: ctx => (ctx.currency ? `Akun ini gak punya kantong ${ctx.currency}.` : 'Akun ini gak punya kantong mata uang itu.'),
  missing_fx_rate: ctx => (ctx.currency ? `Tambahkan kurs ${ctx.currency} dulu.` : 'Tambahkan kursnya dulu.'),
  pocket_needs_forex_account: () => 'Cuma akun Valas yang punya kantong.',
  pocket_not_empty: () => 'Kosongkan kantongnya dulu.',
  account_type_locked: () => 'Tipe akun ini udah gak bisa diubah.',
  recurring_needs_idr_account: () => 'Pengeluaran tetap cuma buat akun rupiah.',
};

export function guardMessage(code: GuardCode, ctx: GuardMessageContext = {}): string {
  return guardMessages[code](ctx);
}

// ProgressBar (DESIGN.md section 8/16): the visible over-limit row, and the matching
// fragment inside the full accessibility label. `nominal` is caller-formatted (rp() then
// shown()) — this file only owns the connector words, never the number formatting.
export function overBy(nominal: string): string {
  return `Lebih ${nominal}`;
}

export function progressAccessibilityLabel(subject: string, usedPct: string, overNominal?: string): string {
  return overNominal ? `${subject}, terpakai ${usedPct}, lebih ${overNominal}` : `${subject}, terpakai ${usedPct}`;
}

// ChartTable (DESIGN.md section 7/16): the collapse toggle's visible label and its
// accessibilityState companion.
export function chartTableToggleLabel(expanded: boolean): string {
  return expanded ? 'Sembunyikan tabel' : 'Lihat tabel nilai';
}

// BankCard (docs/DESIGN.md's brand-colour-cards addendum, section 11/16): the pill
// tag's short caps label and the longer phrase folded into the card's full
// accessibility label. `balanceText` arrives pre-formatted (rp() then shown()) — this
// file only owns the connector words, never the number formatting (same split as
// ProgressBar's overBy above).
const accountTypeTags: Record<AccountType, string> = {
  bank: 'DEBIT',
  savings: 'TABUNGAN',
  ewallet: 'E-WALLET',
  cash: 'TUNAI',
  forex: 'VALAS',
};

export function accountTypeTag(type: AccountType): string {
  return accountTypeTags[type];
}

const accountTypeDescriptions: Record<AccountType, string> = {
  bank: 'rekening bank',
  savings: 'rekening tabungan',
  ewallet: 'e-wallet',
  cash: 'tunai',
  forex: 'akun valas',
};

export function accountTypeDescription(type: AccountType): string {
  return accountTypeDescriptions[type];
}

export function bankCardAccessibilityLabel(name: string, type: AccountType, balanceText: string): string {
  return `${name}, ${accountTypeDescription(type)}, saldo ${balanceText}`;
}

// TabBar / the five (tabs) routes (DESIGN.md section 9): the bottom nav's own labels,
// reused as each tab's temporary app-bar title until its real content lands.
export type TabKey = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'more';

const tabLabels: Record<TabKey, string> = {
  overview: 'Ringkasan',
  transactions: 'Transaksi',
  accounts: 'Akun',
  budgets: 'Anggaran',
  more: 'Lainnya',
};

export function tabLabel(key: TabKey): string {
  return tabLabels[key];
}

// Lainnya tab's __DEV__-only entry point into app/dev/index.tsx (never shown in a
// release build).
export function devToolsLabel(): string {
  return 'Dev tools';
}

export function devToolsHint(): string {
  return 'Data contoh, reset database, atur ulang tanggal.';
}

// Accounts tab (DESIGN.md "D. Accounts"). Group labels are the "cap" style's own text
// (uppercased by the style, not here) — distinct from accountTypeTag above, which is the
// shorter word that sits on a BankCard itself (e.g. "DEBIT" vs this "Bank").
const accountGroupLabels: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Tunai',
  ewallet: 'E-wallet',
  savings: 'Tabungan',
  forex: 'Mata uang asing',
};

export function accountGroupLabel(type: AccountType): string {
  return accountGroupLabels[type];
}

export function accountsSummaryLabel(): string {
  return 'Total saldo · kekayaan bersih';
}

export function accountsCountLabel(count: number): string {
  return `${count} akun`;
}

export function accountsTransferNote(): string {
  return 'Memindahkan uang antar akun tidak mengubah total.';
}

export function accountsIncompleteNote(): string {
  return 'Belum lengkap: ada mata uang tanpa kurs.';
}

export function accountsNoLoginNote(): string {
  return 'MONO tidak meminta login bank. Akun hanya label di ponselmu.';
}

export function transferAccountsLabel(): string {
  return 'Transfer antar akun';
}

export function addAccountLabel(): string {
  return 'Tambah akun';
}

export function notAvailableToast(): string {
  return 'Belum tersedia.';
}

export function accountsEmptyTitle(): string {
  return 'Belum ada akun';
}

export function accountsEmptyBody(): string {
  return 'Tambahkan akun pertamamu buat mulai mencatat saldo.';
}

export function accountsErrorMessage(): string {
  return 'Akun gagal dimuat.';
}

export function retryLabel(): string {
  return 'Coba lagi';
}
