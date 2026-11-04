// Every user-facing string lives here (CLAUDE.md working agreement: one module, so a
// second language stays possible later). This file currently only has the 13 guard-code
// messages — the rest of the app's copy is written screen by screen, later phases.
import type { GuardCode } from '../domain/errors';
import { rp } from '../core/money';

// Extra numbers a pre-check already computed, to make a message specific (e.g. the
// real shortfall) instead of generic. Filled in by the domain layer, never guessed from
// the bare SQLite error — if a guard fires without a matching pre-check, the message
// falls back to the code's generic form.
export interface GuardMessageContext {
  shortfall?: number; // insufficient_balance, in rupiah
  currency?: string; // currency_not_in_account, missing_fx_rate
}

const guardMessages: Record<GuardCode, (ctx: GuardMessageContext) => string> = {
  future_date: () => 'Tanggalnya gak boleh di masa depan.',
  before_opening_date: () => 'Itu sebelum akunmu dibuka.',
  category_kind_mismatch: () => 'Pilih kategori yang sesuai jenis transaksinya.',
  insufficient_balance: ctx => (ctx.shortfall ? `Kurang ${rp(ctx.shortfall)}.` : 'Saldonya gak cukup.'),
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
