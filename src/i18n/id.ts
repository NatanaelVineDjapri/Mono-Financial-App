// Every user-facing string lives here (CLAUDE.md working agreement: one module, so a
// second language stays possible later). This file currently only has the 13 guard-code
// messages — the rest of the app's copy is written screen by screen, later phases.
import type { AccountType } from '../data/repo/accounts';
import type { TxSource } from '../data/repo/transactions';
import type { GuardCode } from '../domain/errors';
import { CURRENCY_NAMES_ID } from './currencyNamesId';

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
  future_date: () => 'Date cannot be in the future.',
  before_opening_date: () => 'This date is before the account was opened.',
  category_kind_mismatch: () => 'Choose a category that matches the transaction type.',
  insufficient_balance: ctx => (ctx.shortfallFormatted ? `Short by ${ctx.shortfallFormatted}.` : 'Insufficient balance.'),
  budget_needs_expense_category: () => 'Budgets can only be assigned to expense categories.',
  over_monthly_limit: () => 'Increase the monthly limit first.',
  budgets_exist_for_month: () => 'Delete the budget first.',
  currency_not_in_account: ctx => (ctx.currency ? `This account does not have a ${ctx.currency} pocket.` : 'This account does not have a pocket for that currency.'),
  missing_fx_rate: ctx => (ctx.currency ? `Add the ${ctx.currency} exchange rate first.` : 'Add the exchange rate first.'),
  pocket_needs_forex_account: () => 'Only Forex accounts support currency pockets.',
  pocket_not_empty: () => 'Empty the pocket first.',
  account_type_locked: () => 'This account type can no longer be changed.',
  recurring_needs_idr_account: () => 'Recurring expenses are only available for IDR accounts.',
  forex_account_exists: () => 'Akun Valas sudah ada. Tambahkan mata uangnya ke akun itu.',
};

export function guardMessage(code: GuardCode, ctx: GuardMessageContext = {}): string {
  return guardMessages[code](ctx);
}

// Pengeluaran tetap
export const recurringTitle = () => 'Pengeluaran tetap';
export const recurringIntro = () => 'Biaya rutin yang dibayar terjadwal. Tidak ada yang tercatat sebelum kamu konfirmasi.';
export const recurringEmpty = () => 'Belum ada pengeluaran tetap. Tambahkan gym, internet, atau langganan.';
export const recurringAdd = () => 'Tambah pengeluaran tetap';
export const recurringMonthly = () => 'Per bulan, perkiraan';
export const recurringDueToday = () => 'Jatuh tempo hari ini';
export const recurringNeedsConfirmation = () => 'Perlu dikonfirmasi';
export const recurringComingUp = () => 'Segera';
export const recurringRecordNow = () => 'Catat sekarang';
export const recurringSkip = () => 'Lewati bulan ini';
export const recurringVaries = () => 'Jumlah berubah';
export const recurringAbout = (amount: string) => `sekitar ${amount}`;
export const recurringDay = (day: number) => `tiap tanggal ${day}`;
export const recurringToday = () => 'Jatuh tempo hari ini';
export const recurringOverdue = (days: number) => `Terlewat ${days} hari`;
export const recurringReminderNote = () => 'Pengingat dikirim sehari sebelum dan saat jatuh tempo. Bulan yang terlewat menunggu di sini, terlama dulu.';
export const recurringNewTitle = () => 'Pengeluaran tetap baru';
export const recurringEditTitle = () => 'Ubah pengeluaran tetap';
export const recurringName = () => 'Nama';
export const recurringNameHint = () => 'Contoh: Gym membership';
export const recurringAmount = () => 'Jumlah';
export const recurringAmountVaries = () => 'Jumlah berubah tiap bulan';
export const recurringAmountVariesHint = () => 'Nyalakan untuk tagihan seperti listrik. Jumlah di atas menjadi perkiraan dan kamu isi jumlah sebenarnya saat konfirmasi.';
export const recurringCategory = () => 'Kategori';
export const recurringPayFrom = () => 'Bayar dari';
export const recurringRepeats = () => 'Berulang';
export const recurringFirstDue = () => 'Jatuh tempo pertama';
export const recurringEnds = () => 'Berakhir';
export const recurringNoEnd = () => 'Tanpa batas';
export const recurringClampHint = () => 'Tanggal 29 sampai 31 jatuh pada hari terakhir bulan yang lebih pendek.';
export const recurringRemind = () => 'Ingatkan aku';
export const recurringRemindHint = () => 'Notifikasi 09.00, sehari sebelum dan saat jatuh tempo';
export const recurringStop = () => 'Hentikan pengeluaran tetap';
export const recurringStopTitle = (name: string) => `Hentikan ${name}?`;
export const recurringStopBody = () => 'Transaksi yang sudah tercatat tetap ada.';
export const recurringSave = () => 'Simpan';
export const recurringNameRequired = () => 'Masukkan nama pengeluaran tetap.';
export const recurringAmountRequired = () => 'Masukkan jumlah di atas Rp0.';
export const recurringAccountRequired = () => 'Pilih akun untuk membayar.';
export const recurringCategoryRequired = () => 'Pilih kategori.';
export const recurringNoneDue = () => 'Tidak ada';
export const recurringCountLabel = (count: number) => `${count} pengeluaran tetap`;
export const recurringCountWithEstimate = (count: number, name: string) => `${count} pengeluaran tetap. Termasuk perkiraan untuk ${name}.`;
export const recurringEndInvalid = () => 'Tanggal berakhir tidak boleh sebelum jatuh tempo pertama.';
export const recurringConfirmTitle = (name: string) => `Catat ${name}?`;
export const recurringConfirmDue = (date: string) => `Jatuh tempo hari ini, ${date} · berulang tiap bulan`;
export const recurringUsualAmount = () => 'Jumlah biasa. Ubah kalau bulan ini berbeda.';
export const recurringDate = () => 'Tanggal';
export const recurringAfter = (account: string, amount: string) => `${account} setelah ${amount}`;
export const recurringRecord = () => 'Catat pengeluaran';
export const recurringRemindTomorrow = () => 'Ingatkan besok';
export const recurringSkipNote = (date: string) => `Dilewati berarti tidak ada yang tercatat. Jatuh tempo berikutnya ${date}.`;
export const recurringSavedToast = (account: string, amount: string) => `Pengeluaran tersimpan. ${account} sekarang ${amount}.`;

// ProgressBar (DESIGN.md section 8/16): the visible over-limit row, and the matching
// fragment inside the full accessibility label. `nominal` is caller-formatted (rp() then
// shown()) — this file only owns the connector words, never the number formatting.
export function overBy(nominal: string): string {
  return `Over by ${nominal}`;
}

export function progressAccessibilityLabel(subject: string, usedPct: string, overNominal?: string): string {
  return overNominal ? `${subject}, ${usedPct} used, over by ${overNominal}` : `${subject}, ${usedPct} used`;
}

// ChartTable (DESIGN.md section 7/16): the collapse toggle's visible label and its
// accessibilityState companion.
export function chartTableToggleLabel(expanded: boolean): string {
  return expanded ? 'Hide table' : 'View values table';
}

// BankCard (docs/DESIGN.md's brand-colour-cards addendum, section 11/16): the pill
// tag's short caps label and the longer phrase folded into the card's full
// accessibility label. `balanceText` arrives pre-formatted (rp() then shown()) — this
// file only owns the connector words, never the number formatting (same split as
// ProgressBar's overBy above).
const accountTypeTags: Record<AccountType, string> = {
  bank: 'DEBIT',
  savings: 'SAVINGS',
  ewallet: 'E-WALLET',
  cash: 'CASH',
  forex: 'FOREX',
};

export function accountTypeTag(type: AccountType): string {
  return accountTypeTags[type];
}


// The Accounts card stack's open Valas card (Fase 4.2c; DESIGN.md "Accounts with a Valas
// account"): "2 CURRENCIES" — a dynamic count, distinct from the fixed per-type tags above.
export function currencyCountTag(count: number): string {
  return `${count} ${count === 1 ? 'CURRENCY' : 'CURRENCIES'}`;
}

const accountTypeDescriptions: Record<AccountType, string> = {
  bank: 'bank account',
  savings: 'savings account',
  ewallet: 'e-wallet',
  cash: 'cash',
  forex: 'foreign currency account',
};

export function accountTypeDescription(type: AccountType): string {
  return accountTypeDescriptions[type];
}

export function bankCardAccessibilityLabel(name: string, type: AccountType, balanceText: string): string {
  return `${name}, ${accountTypeDescription(type)}, balance ${balanceText}`;
}

// TabBar / the four (tabs) routes (DESIGN.md "Bottom navigation"): the bottom nav's own
// labels, reused as each tab's app-bar title. More is not a tab — see moreTitle().
export type TabKey = 'overview' | 'transactions' | 'accounts' | 'budgets';

const tabLabels: Record<TabKey, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  accounts: 'Accounts',
  budgets: 'Budgets',
};

export function tabLabel(key: TabKey): string {
  return tabLabels[key];
}

// The pushed /more screen (opened from the avatar on Overview): its title and the
// avatar's accessibility label.
export function moreTitle(): string {
  return 'More';
}

// More's __DEV__-only entry point into app/dev/index.tsx (never shown in a
// release build).
export function devToolsLabel(): string {
  return 'Dev tools';
}

export function devToolsHint(): string {
  return 'Sample data, reset database, adjust date.';
}

// Accounts tab (DESIGN.md "D. Accounts"). Group labels are the "cap" style's own text
// (uppercased by the style, not here) — distinct from accountTypeTag above, which is the
// shorter word that sits on a BankCard itself (e.g. "DEBIT" vs this "Bank").
const accountGroupLabels: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  ewallet: 'E-wallet',
  savings: 'Savings',
  forex: 'Foreign currency',
};

export function accountGroupLabel(type: AccountType): string {
  return accountGroupLabels[type];
}

export function accountsSummaryLabel(): string {
  return 'Total balance · net worth';
}

export function accountsCountLabel(count: number): string {
  return `${count} accounts`;
}

export function accountsTransferNote(): string {
  return 'Every account added together. Moving money between accounts never changes this total.';
}

export function accountsIncompleteNote(): string {
  return 'Belum lengkap: ada mata uang yang belum punya kurs.';
}

export function accountsNoLoginNote(): string {
  return 'A balance is the opening balance plus every recorded movement. Accounts are labels you keep on this device. MONO never asks for bank logins or links to a bank.';
}

// The card stack's total card (Fase 4.2c), when a forex account has a rate (so the total
// is an estimate, not a warning) — distinct from accountsIncompleteNote above, which is
// for when a pocket has NO rate at all and the total is genuinely missing data.
export function accountsForexEstimateNote(dateTimeFormatted: string): string {
  return `Mata uang asing memakai kurs terbaru (${dateTimeFormatted}), jadi total ini perkiraan.`;
}

export function exchangeRatesLabel(): string {
  return 'Kurs';
}

export function exchangeRatesUpdatedLabel(dateTimeFormatted: string): string {
  return `diperbarui ${dateTimeFormatted}`;
}

// The Accounts card stack's own strip/open accessibility labels (Fase 4.2c step 3) —
// distinct wording from bankCardAccessibilityLabel above, which BankCard still falls
// back to everywhere else it's used.
export function cardStackAdvanceLabel(name: string, balanceFormatted: string): string {
  return `${name}, ${balanceFormatted}. Bring card forward.`;
}

export function cardStackOpenLabel(name: string, balanceFormatted: string): string {
  return `${name}, ${balanceFormatted}. Open account.`;
}

export function transferAccountsLabel(): string {
  return 'Transfer';
}

export function addAccountLabel(): string {
  return 'Add account';
}

export function notAvailableToast(): string {
  return 'Not available yet.';
}

export function accountsEmptyTitle(): string {
  return 'No accounts yet';
}

export function accountsEmptyBody(): string {
  return 'Add your first account to start tracking your balances.';
}

export function accountsErrorMessage(): string {
  return 'Failed to load accounts.';
}

export function retryLabel(): string {
  return 'Try again';
}

// Transactions tab (DESIGN.md "B. Transactions", PAGES.md B1).
export function transactionsCountLabel(count: number, rangeLabel: string): string {
  return `${count} ${count === 1 ? 'transaction' : 'transactions'} · ${rangeLabel}`;
}

export function filtersButtonLabel(): string {
  return 'Filters';
}

export function searchPlaceholder(): string {
  return 'Search transactions';
}

export type TxTypeFilter = 'all' | 'income' | 'expense' | 'transfer';

const txTypeChipLabels: Record<TxTypeFilter, string> = {
  all: 'All',
  income: 'Income',
  expense: 'Expenses',
  transfer: 'Transfers',
};

export function txTypeChipLabel(type: TxTypeFilter): string {
  return txTypeChipLabels[type];
}

// The row's own type label (singular, next to its amount) — distinct wording from the
// chip above it (e.g. "Expense" here vs "Expenses" as the chip's label).
const txKindLabels: Record<'income' | 'expense' | 'transfer', string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

export function txKindLabel(kind: 'income' | 'expense' | 'transfer'): string {
  return txKindLabels[kind];
}

export function transactionsNotCountedNote(count: number, amountFormatted: string): string {
  return `Not counted: ${count} ${count === 1 ? 'transfer' : 'transfers'} between accounts (${amountFormatted})`;
}

export function monthExpenseLabel(amountFormatted: string): string {
  return `Expense ${amountFormatted}`;
}

export function transactionsEmptyTitle(): string {
  return 'No matches';
}

export function transactionsEmptyBody(): string {
  return 'Try a different search or filter.';
}

export function resetSearchLabel(): string {
  return 'Reset search';
}

// The tab bar's centre "+" (TabFab).
export function recordViaChatLabel(): string {
  return 'Add transaction by chat';
}

export function filtersSheetTitle(): string {
  return 'Filters';
}

export function filtersSheetSubtitle(): string {
  return 'Narrow down your transactions';
}

export function filtersComingSoonMessage(): string {
  return 'Filters are coming soon.';
}

export function transactionDetailTitle(): string {
  return 'Transaction';
}

export function accountDetailTitle(): string {
  return 'Account';
}

export function aiChatTitle(): string {
  return 'AI chat';
}

export function comingSoonMessage(): string {
  return 'Not built yet.';
}

export function txRowAccessibilityLabel(title: string, subtitle: string, kindLabel: string, amountFormatted: string): string {
  return `${title}, ${kindLabel}, ${subtitle}, ${amountFormatted}`;
}

export function netLabel(): string {
  return 'Net';
}

// Generic sheet-scrim dismiss label (DESIGN.md section 8/16 "bottom sheet"), reused by
// every sheet built on top of src/components/Sheet.tsx.
export function closeLabel(): string {
  return 'Close';
}

// Transactions tab's statistics area (Fase 4.3c).
export function statsCardTitle(rangeLabel: string): string {
  return `Summary · ${rangeLabel}`;
}

export function hideStatsLabel(): string {
  return 'Hide statistics';
}

export function showStatsLabel(): string {
  return 'Show statistics';
}

export function spentLabel(): string {
  return 'Spent';
}

export function ofLimitLabel(limitFormatted: string): string {
  return `of ${limitFormatted} limit`;
}

export function overLimitLabel(): string {
  return 'Over';
}

export function othersLabel(): string {
  return 'Others';
}

export function categoryRowAccessibilityLabel(name: string, percentFormatted: string, amountFormatted: string): string {
  return `${name}, ${percentFormatted}, ${amountFormatted}`;
}

export function ringAccessibilityLabel(kindLabel: string, totalFormatted: string, limitNote?: string): string {
  return limitNote ? `${kindLabel} breakdown, ${totalFormatted}, ${limitNote}` : `${kindLabel} breakdown, ${totalFormatted}`;
}

// Transaction filters sheet (Tx-Filters).
export function filtersButtonAccessibilityLabel(activeCount: number): string {
  return activeCount === 0 ? filtersButtonLabel() : `${filtersButtonLabel()}, ${activeCount} active`;
}

export function filtersActiveBadgeLabel(activeCount: number): string {
  return `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`;
}

export function resetAllFiltersLabel(): string {
  return 'Reset all';
}

export function cancelLabel(): string {
  return 'Cancel';
}

export function filtersApplyLabel(count: number): string {
  return `Show ${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}

export function filtersTypeLabel(): string {
  return 'Type';
}

export function filtersDateRangeLabel(): string {
  return 'Date range';
}

export function filtersCategoriesLabel(): string {
  return 'Categories';
}

export function filtersAccountsLabel(): string {
  return 'Accounts';
}

export type TxDatePresetLabel = 'this-month' | 'last-month' | 'three-months' | 'this-year' | 'custom';

const txDatePresetLabels: Record<TxDatePresetLabel, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'three-months': '3 months',
  'this-year': 'This year',
  custom: 'Custom',
};

export function txDatePresetLabel(preset: TxDatePresetLabel): string {
  return txDatePresetLabels[preset];
}

export function filtersCustomStartLabel(): string {
  return 'From';
}

export function filtersCustomEndLabel(): string {
  return 'To';
}

export function filtersDateFormatHint(): string {
  return 'YYYY-MM-DD';
}

export function filtersActiveTypeLabel(type: TxTypeFilter): string {
  return `${filtersTypeLabel()}: ${txTypeChipLabel(type)}`;
}

export function filtersActiveDateLabel(rangeLabel: string): string {
  return `${filtersDateRangeLabel()}: ${rangeLabel}`;
}

export function filtersActiveAccountLabel(name: string): string {
  return `Account: ${name}`;
}

export function filtersActiveCategoryLabel(name: string): string {
  return `Category: ${name}`;
}

export function filtersActiveMinAmountLabel(amount: string): string {
  return `Minimum: ${amount}`;
}

export function filtersActiveMaxAmountLabel(amount: string): string {
  return `Maximum: ${amount}`;
}

export function removeFilterAccessibilityLabel(label: string): string {
  return `Remove filter ${label}`;
}

export function unknownFilterOptionLabel(id: number): string {
  return `#${id}`;
}

export function filtersBadgeValue(activeCount: number): string {
  return activeCount > 99 ? '99+' : String(activeCount);
}

// Budgets tab, Budget-Create and Budget-Category (Fase 4.4; DESIGN.md "F. Budgets",
// PAGES.md F1–F3). Every nominal arrives pre-formatted (rp() then shown()).
export function budgetsTotalSpentLabel(): string {
  return 'Total spent';
}

export function budgetLimitLabel(limitFormatted: string): string {
  return `Limit ${limitFormatted}`;
}

export function usedPctLabel(pctFormatted: string): string {
  return `${pctFormatted} used`;
}

export function budgetRemainingLabel(amountFormatted: string): string {
  return `${amountFormatted} remaining`;
}

export function budgetLeftLabel(amountFormatted: string): string {
  return `${amountFormatted} left`;
}

export function daysLeftInLabel(monthNameText: string): string {
  return `Days left in ${monthNameText}`;
}

export function availablePerDayLabel(): string {
  return 'Available per day';
}

export function byCategoryLabel(): string {
  return 'By category';
}

export function mostUsedFirstLabel(): string {
  return 'Most used first';
}

export function budgetsFootnote(): string {
  return 'Only consumption expenses count here. Transfers between your accounts are excluded. Total remaining = total limit − total spent, so an overspent category reduces it.';
}

export function addCategoryBudgetLabel(): string {
  return 'Add category budget';
}

export function reviewSpendingByCategoryLabel(): string {
  return 'Review spending by category';
}

export function editMonthlyLimitLabel(): string {
  return 'Edit monthly limit';
}

// Budgets header month chip and the month sheet it opens.
export function monthChipAccessibilityLabel(monthLabelText: string): string {
  return `Month: ${monthLabelText}. Change month`;
}

export function chooseMonthTitle(): string {
  return 'Choose month';
}

export function goalChooseMonthTitle(): string { return 'Pilih bulan'; }
export function goalChooseMonthSubtitle(): string { return 'Pilih bulan target'; }

// Under the month sheet's title: the year of the months listed, or the span when the
// list crosses years.
export function chooseMonthSubtitle(newestYear: string, oldestYear: string): string {
  return newestYear === oldestYear ? `Select a month from ${newestYear}` : `Select a month from ${oldestYear} to ${newestYear}`;
}

export function confirmLabel(): string {
  return 'Confirm';
}

export function previousYearLabel(): string {
  return 'Previous year';
}

export function nextYearLabel(): string {
  return 'Next year';
}

export function budgetsEmptyTitle(monthLabelText: string): string {
  return `No budget for ${monthLabelText}`;
}

export function budgetsEmptyBody(): string {
  return 'Set a monthly limit, then give each category its share.';
}

export function addBudgetLabel(): string {
  return 'Add budget';
}

export function noCategoryBudgetsYet(): string {
  return 'No category budgets this month yet.';
}

export function budgetsErrorMessage(): string {
  return 'Failed to load budgets.';
}

// Every budget bar's accessibility label carries the exact figures, never only a share.
export type BudgetBarState = { kind: 'left'; amountFormatted: string } | { kind: 'remaining'; amountFormatted: string } | { kind: 'over'; amountFormatted: string };

export function budgetBarAccessibilityLabel(
  subject: string,
  spentFormatted: string,
  limitFormatted: string,
  usedPct: string,
  state: BudgetBarState,
): string {
  const tail =
    state.kind === 'over'
      ? `over by ${state.amountFormatted}`
      : state.kind === 'remaining'
        ? `${state.amountFormatted} remaining`
        : `${state.amountFormatted} left`;
  return `${subject}: ${spentFormatted} spent of ${limitFormatted} limit, ${usedPct} used, ${tail}`;
}

export function budgetRowAccessibilityLabel(barLabel: string): string {
  return `${barLabel}. Review spending.`;
}

export function monthTotalSubject(monthLabelText: string): string {
  return `${monthLabelText} total`;
}

// Budget-Create (create/edit budget and the monthly limit, one form).
export function editCategoryBudgetTitle(): string {
  return 'Edit category budget';
}

export function monthlyLimitTitle(): string {
  return 'Monthly limit';
}

export function stepLabel(step: number, text: string): string {
  return `${step} · ${text}`;
}

export function categoryWithoutBudgetLabel(): string {
  return 'Category without a budget';
}

export function categoryLabel(): string {
  return 'Category';
}

export function budgetCategoryHelper(): string {
  return 'Only expense categories can have a budget. Transfers never do.';
}

export function noCategoriesLeftMessage(): string {
  return 'Every expense category already has a budget this month.';
}

export function monthlyLimitForLabel(categoryName: string | null): string {
  return categoryName ? `Monthly limit for ${categoryName}` : 'Monthly limit for this category';
}

export function totalMonthlyLimitLabel(monthLabelText: string): string {
  return `Total monthly limit · ${monthLabelText}`;
}

export function repeatEveryMonthLabel(): string {
  return 'Repeat every month';
}

export function repeatEveryMonthHelper(monthLabelText: string): string {
  return `Starts ${monthLabelText}. You can change a single month later.`;
}

export function allocationCheckLabel(): string {
  return 'Allocation check';
}

export function raisedFromLabel(amountFormatted: string): string {
  return `Raised from ${amountFormatted}`;
}

export function alreadyAllocatedLabel(count: number): string {
  return `Already allocated, ${count} ${count === 1 ? 'category' : 'categories'}`;
}

export function allocatedLabel(count: number): string {
  return `Allocated, ${count} ${count === 1 ? 'category' : 'categories'}`;
}

export function thisBudgetLabel(): string {
  return 'This budget';
}

export function totalAllocatedLabel(): string {
  return 'Total allocated';
}

// The message catalogue's Budget row (DESIGN.md section 14, States-Validation).
export function overMonthlyLimitBy(amountFormatted: string): string {
  return `Over the monthly limit by ${amountFormatted}.`;
}

export function overMonthlyLimitHint(): string {
  return 'Raise the limit or lower this budget to save.';
}

export function overMonthlyLimitHintForLimit(): string {
  return 'Raise the limit or lower category budgets first.';
}

export function unallocatedMessage(amountFormatted: string): string {
  return `${amountFormatted} of the monthly limit is not allocated yet.`;
}

export function fullyAllocatedMessage(): string {
  return 'The whole monthly limit is allocated.';
}

export function raiseMonthlyLimitToLabel(amountFormatted: string): string {
  return `Raise monthly limit to ${amountFormatted}`;
}

export function saveBudgetLabel(): string {
  return 'Save budget';
}

export function saveLimitLabel(): string {
  return 'Save limit';
}

// Message catalogue (DESIGN.md section 14): Amount and Category rows.
export function amountAboveZeroMessage(): string {
  return 'Enter an amount above Rp0.';
}

export function chooseCategoryMessage(): string {
  return 'Choose a category.';
}

export function budgetSavedToast(categoryName: string, amountFormatted: string): string {
  return `${categoryName} budget saved: ${amountFormatted}.`;
}

export function monthlyLimitSavedToast(amountFormatted: string): string {
  return `Monthly limit saved: ${amountFormatted}.`;
}

export function budgetSaveFailedMessage(): string {
  return 'Could not save. Nothing was changed.';
}

// Budget-Category (category spending review).
export function categoryReviewTitle(categoryName: string, monthLabelText: string): string {
  return `${categoryName} · ${monthLabelText}`;
}

export function expensesInCategoryLabel(): string {
  return 'Expenses in this category';
}

export function itemsCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function noExpensesInCategoryMessage(monthLabelText: string): string {
  return `No expenses in this category in ${monthLabelText}.`;
}

export function monthSpentLabel(monthName: string): string {
  return `${monthName} spent`;
}

export function changeVsMonthLabel(monthName: string): string {
  return `Change vs ${monthName}`;
}

export function lastFourMonthsLabel(): string {
  return 'Last four months';
}

export function dashedEqualsLimitLabel(): string {
  return 'Dashed = limit';
}

// The four-month chart's own accessibility label (DESIGN.md "every chart has an
// exact-value table and a text label") — the visible table beneath it already states
// every figure, but a screen reader hitting the chart View itself needs the same facts
// in one sentence before it reaches that table.
export function categoryHistoryAccessibilityLabel(monthsFormatted: string, limitFormatted: string): string {
  return `${monthsFormatted}. Dashed line marks the ${limitFormatted} limit.`;
}

export function openInTransactionsLabel(): string {
  return 'Open in Transactions';
}

export function editNamedBudgetLabel(categoryName: string): string {
  return `Edit ${categoryName} budget`;
}

export function addNamedBudgetLabel(categoryName: string): string {
  return `Add ${categoryName} budget`;
}

export function deleteNamedBudgetLabel(categoryName: string): string {
  return `Delete ${categoryName} budget`;
}

export function deleteBudgetConfirmTitle(categoryName: string): string {
  return `Delete ${categoryName} budget?`;
}

export function deleteBudgetConfirmMessage(): string {
  return 'This removes the budget limit for this category. Your existing transactions are not affected.';
}

export function deleteBudgetConfirmAction(): string {
  return 'Delete';
}

export function budgetDeletedToast(categoryName: string): string {
  return `${categoryName} budget deleted.`;
}

export function noBudgetForCategoryMessage(categoryName: string, monthLabelText: string): string {
  return `${categoryName} has no budget in ${monthLabelText}.`;
}

export function raiseBudgetNote(categoryName: string, byFormatted: string, totalFormatted: string, limitFormatted: string, exceedsLimit: boolean): string {
  return exceedsLimit
    ? `Raising ${categoryName} by ${byFormatted} would bring total allocation to ${totalFormatted}, above the ${limitFormatted} monthly limit. MONO will ask you to raise the limit as well.`
    : `Raising ${categoryName} by ${byFormatted} would bring total allocation to ${totalFormatted}, within the ${limitFormatted} monthly limit.`;
}

export function backLabel(): string {
  return 'Back';
}

export function categoryNotFoundMessage(): string {
  return 'This category no longer exists.';
}

// Overview tab (DESIGN.md "A. Overview", PAGES.md A1/A2).
export type GreetingKind = 'morning' | 'afternoon' | 'late_afternoon' | 'evening' | 'checkin';

// The line on Overview: by the time of day, or "Apa kabar, Nael?" once the app was opened several
// times that day.
export function welcomeGreeting(nickname: string | null, kind: GreetingKind): string {
  const words: Record<GreetingKind, string> = {
    morning: 'Selamat pagi',
    afternoon: 'Selamat siang',
    late_afternoon: 'Selamat sore',
    evening: 'Selamat malam',
    checkin: 'Apa kabar',
  };
  const end = kind === 'checkin' ? '?' : '';
  return nickname ? `${words[kind]}, ${nickname}${end}` : `${words[kind]}${end}`;
}

export function hideAmountsLabel(): string {
  return 'Hide amounts';
}

export function showAmountsLabel(): string {
  return 'Show amounts';
}

// The same two buttons on a narrow screen (under 360dp); the accessibility label stays long.
export function hideAmountsShortLabel(): string {
  return 'Hide';
}

export function showAmountsShortLabel(): string {
  return 'Show';
}

export function netWorthChangeLabel(amountFormatted: string, pctFormatted: string, vsDate: string): string {
  return `${amountFormatted} (${pctFormatted}) vs ${vsDate}`;
}

export function yourAccountsLabel(): string {
  return 'Your accounts';
}

export function allAccountsLabel(): string {
  return 'All accounts';
}

export function fixedExpensesLabel(): string {
  return 'Pengeluaran tetap';
}

export function reviewAndRecordLabel(): string {
  return 'Tinjau dan catat';
}

export function nextDueLabel(name: string, date: string, amountFormatted: string): string {
  return `Next: ${name} · ${date} ${amountFormatted}`;
}

export function thisMonthLabel(): string {
  return 'This month';
}

export function incomeLabel(): string {
  return 'Income';
}

export function expenseLabel(): string {
  return 'Expense';
}

export function recentTransactionsLabel(): string {
  return 'Recent transactions';
}

export function seeAllLabel(): string {
  return 'See all';
}

// Overview empty state (PAGES.md A2).
export function overviewEmptyMessage(): string {
  return 'No accounts yet. Net worth is calculated from your accounts.';
}

export function setUpInFourStepsLabel(): string {
  return 'Set up in four steps';
}

export function stepsDoneLabel(done: number, total: number): string {
  return `${done} of ${total} done`;
}

export function addAccountStepLabel(): string {
  return 'Add an account';
}

export function addAccountStepHint(): string {
  return 'Track cash, e-wallet or savings, with an opening balance';
}

export function addTransactionStepLabel(): string {
  return 'Record a transaction';
}

export function addTransactionStepHint(): string {
  return 'Income, expense or transfer';
}

export function setBudgetStepLabel(): string {
  return 'Set a monthly budget';
}

export function setBudgetStepHint(): string {
  return 'Spending limit and category limits';
}

export function createBackupStepLabel(): string {
  return 'Create a backup';
}

export function createBackupStepHint(): string {
  return 'Your data lives only on this device';
}

export function chartsAppearTitle(): string {
  return 'Charts appear with your first records';
}

export function chartsAppearBody(): string {
  return 'Net worth history, income versus expenses and asset allocation are drawn from stored records.';
}

export function privacyByDesignNote(): string {
  return 'Private by design. No sign-up, no server, no sync. Records are stored on this phone and work offline.';
}

// Recurring due card (PAGES.md A1).
export function dueTodayLabel(): string {
  return 'Jatuh tempo hari ini';
}

export function noDueExpensesMessage(): string {
  return 'Tidak ada yang jatuh tempo.';
}

export function recurringAllLabel(): string { return 'Semua'; }
export function recurringOverdueOverview(days: number): string { return `Terlewat ${days} hari`; }
export function recurringNextOverview(name: string, date: string): string { return `Berikutnya: ${name} · ${date}`; }
export function recurringOthersWaiting(count: number): string { return `+ ${count} lainnya menunggu`; }
export function recurringReviewAndRecord(): string { return 'Tinjau dan catat'; }

export function recurringAccessibilityLabel(name: string, date: string, amountFormatted: string): string {
  return `${name}, due ${date}, ${amountFormatted}`;
}

// ---------------------------------------------------------------- Overview rebuild (R3)
// DESIGN.md "A. Overview", PAGES.md A1/A2.
export function notificationsLabel(): string {
  return 'Notifications';
}

export function backToOverviewLabel(): string {
  return 'Overview';
}

export function netWorthLabel(): string {
  return 'Net worth';
}

export function netWorthIncompleteNote(): string {
  return 'Some currencies have no exchange rate yet, so this total is incomplete.';
}

export function expensesCardLabel(): string {
  return 'Expenses';
}

export function incomeCardLabel(): string {
  return 'Income';
}

// "▲ 8,05% vs Sep" — the arrow is drawn, not part of the string.
export function overviewChangeVsLabel(pctFormatted: string, monthAbbrevText: string): string {
  return `${pctFormatted} vs ${monthAbbrevText}`;
}

export function noChangeVsMonthLabel(monthAbbrevText: string): string {
  return `No data for ${monthAbbrevText}`;
}

export function monthFlowCardAccessibilityLabel(label: string, amountFormatted: string, changeText: string): string {
  return `${label} this month, ${amountFormatted}, ${changeText}`;
}

export function netCashFlowLabel(monthAbbrevText: string): string {
  return `Net cash flow · ${monthAbbrevText}`;
}

export function consumptionOnlyNote(): string {
  return 'Consumption only. Transfers between your accounts are excluded.';
}

export function accountsCountNote(count: number): string {
  return `${count} ${count === 1 ? 'account' : 'accounts'}. Swipe to see all. Total equals net worth.`;
}

export function cashFlowTitle(): string {
  return 'Cash flow';
}

export function lastTwelveMonthsLabel(): string {
  return 'Last 12 months';
}

export function cashFlowAccessibilityLabel(valuesText: string): string {
  return `Income versus expenses, last six months. ${valuesText}`;
}

export function cashFlowValuesText(monthAbbrevText: string, incomeFormatted: string, expenseFormatted: string): string {
  return `${monthAbbrevText}: income ${incomeFormatted}, expenses ${expenseFormatted}`;
}

export function topCategoriesTitle(): string {
  return 'Top categories';
}

export function amountsLinkLabel(): string {
  return 'Amounts';
}

export function othersCategoryLabel(): string {
  return 'Others';
}

export function noSpendingThisMonthMessage(): string {
  return 'No spending recorded this month yet.';
}

export function topCategoriesRingAccessibilityLabel(valuesText: string): string {
  return `Spending by category this month. ${valuesText}`;
}

export function legendValueText(name: string, percentFormatted: string): string {
  return `${name} ${percentFormatted}`;
}

export function budgetSummaryTitle(monthLabelText: string): string {
  return `Budget · ${monthLabelText}`;
}

export function detailsLabel(): string {
  return 'Details';
}

export function percentUsedLabel(percentFormatted: string): string {
  return `${percentFormatted} used`;
}

export function overLimitAlert(categoryName: string, overFormatted: string): string {
  return `${categoryName} is over its limit by ${overFormatted}`;
}

export function noBudgetThisMonthMessage(): string {
  return 'No monthly limit set for this month.';
}

export function goalsTitle(): string {
  return 'Goals';
}

export function allGoalsLabel(): string {
  return 'All goals';
}

export function goalTargetDateLabel(dateText: string): string {
  return `Target ${dateText}`;
}

export function goalOfTargetLabel(targetFormatted: string): string {
  return `of ${targetFormatted}`;
}

export function goalCompleteLabel(percentFormatted: string): string {
  return `${percentFormatted} complete`;
}

export function goalRemainingLabel(amountFormatted: string): string {
  return `${amountFormatted} remaining`;
}

export function goalAchieved(): string {
  return 'Tercapai';
}

export function netWorthHistoryTitle(): string {
  return 'Net worth history';
}

export function netWorthHistoryAccessibilityLabel(valuesText: string): string {
  return `Net worth at each month end. ${valuesText}`;
}

export function whereYourMoneyIsTitle(): string {
  return 'Where your money is';
}

export function byAccountCaption(): string {
  return 'By account';
}

export function whereMoneyAccessibilityLabel(valuesText: string): string {
  return `Net worth by account. ${valuesText}`;
}

export function monthEndValuesNote(): string {
  return 'Month-end values. The latest month is to date.';
}

export function nextRecurringLabel(name: string, dateText: string): string {
  return `Next: ${name} · ${dateText}`;
}

export function axisInMillionsLabel(): string {
  return 'axis in Rp million';
}

export function goalLineLabel(valueText: string): string {
  return `Goal · Rp${valueText}`;
}

export function rangeSixMonthsLabel(): string {
  return '6M';
}

export function rangeOneYearLabel(): string {
  return '1Y';
}

export function rangeAllLabel(): string {
  return 'All';
}

// ---------------------------------------------------------------- Transaction detail
// Tx-Detail, Tx-Detail-Transfer, Tx-Detail-Valas, Tx-Delete (DESIGN.md "C2").
export function editTransactionLabel(): string {
  return 'Edit transaction';
}

export function editLabel(): string {
  return 'Edit';
}

export function deleteLabel(): string {
  return 'Delete';
}

export function txDetailAccountLabel(): string {
  return 'Account';
}

export function txDetailDateLabel(): string {
  return 'Date';
}

export function txDetailSourceLabel(): string {
  return 'Source';
}

export function txDetailNotesLabel(): string {
  return 'Notes';
}

export function txDetailCurrencyLabel(): string {
  return 'Currency';
}

export function txDetailRupiahValueLabel(): string {
  return 'Rupiah value';
}

export function txDetailRateUsedLabel(): string {
  return 'Rate used';
}

export function txDetailFromLabel(): string {
  return 'From';
}

export function txDetailToLabel(): string {
  return 'To';
}

export function noNoteLabel(): string {
  return 'No note';
}

const txSourceLabels: Record<TxSource, string> = {
  manual: 'Manual',
  ai: 'AI chat',
  recurring: 'Fixed expense',
  scan: 'Scan struk',
};

export function txSourceName(source: TxSource): string {
  return txSourceLabels[source];
}

export function balanceAfterLabel(amountFormatted: string): string {
  return `Balance after ${amountFormatted}`;
}

export function afterLabel(amountFormatted: string): string {
  return `After ${amountFormatted}`;
}

export function pocketAfterLabel(symbol: string, amountFormatted: string): string {
  return `Pocket ${symbol} · after ${amountFormatted}`;
}

export function txCategoryDateLine(categoryName: string, dateText: string): string {
  return `${categoryName} · ${dateText}`;
}

export function txDateTimeLine(dateText: string, timeText: string): string {
  return `${dateText} · ${timeText}`;
}

export function transferExplainer(): string {
  return 'Moves money between your accounts. It is not income or spending and is not counted in reports or budgets.';
}

export function txBudgetCardTitle(categoryName: string): string {
  return `Budget · ${categoryName}`;
}

export function txBudgetOfLimit(limitFormatted: string, percentFormatted: string): string {
  return `of ${limitFormatted} · ${percentFormatted}`;
}

export function txBudgetPartNote(): string {
  return 'This transaction is part of that total.';
}

export function rupiahAtTheTime(rupiahFormatted: string, rateText: string): string {
  return `${rupiahFormatted} at the time (${rateText})`;
}

export function rateEquals(symbol: string, rateFormatted: string): string {
  return `${symbol}1 = ${rateFormatted}`;
}

export function rateFixedNote(): string {
  return 'The rupiah value is fixed when you record the transaction, so later rate changes do not rewrite it.';
}

export function txNotFoundMessage(): string {
  return 'This transaction no longer exists.';
}

export function txDetailLoadError(): string {
  return 'Could not load this transaction.';
}

export function txDetailHeroAccessibilityLabel(title: string, kindLabel: string, subtitle: string, amountFormatted: string): string {
  return `${title}, ${kindLabel}, ${subtitle}, ${amountFormatted}`;
}

export function deleteDialogTitle(): string {
  return 'Delete this transaction?';
}

// The dialog's body as plain and bold parts: the nominals are bold. `toParts` is a clause for a
// transfer's second account, `budgetParts` for an expense that counts toward a budget.
export function deleteDialogParts(input: {
  title: string;
  amount: string;
  accountName: string;
  accountAfter: string;
  toAccountName?: string;
  toAccountAfter?: string;
  budgetCategory?: string;
  budgetAfter?: string;
}): { text: string; strong?: boolean }[] {
  const parts: { text: string; strong?: boolean }[] = [
    { text: `“${input.title}”, ` },
    { text: input.amount, strong: true },
    { text: `, will be removed. ${input.accountName} goes back to ` },
    { text: input.accountAfter, strong: true },
  ];
  if (input.toAccountName && input.toAccountAfter) {
    parts.push({ text: ` and ${input.toAccountName} to ` }, { text: input.toAccountAfter, strong: true });
  }
  if (input.budgetCategory && input.budgetAfter) {
    parts.push({ text: ` and the ${input.budgetCategory} budget to ` }, { text: input.budgetAfter, strong: true });
  }
  parts.push({ text: '. You can undo this for a few seconds.' });
  return parts;
}

export function transactionDeletedMessage(): string {
  return 'Transaction deleted';
}

export function undoLabel(): string {
  return 'Undo';
}

export function transactionRestoreFailedMessage(): string {
  return 'Could not undo the delete.';
}

export function deleteBlockedMessage(): string {
  return 'This would take the account below zero, so it cannot be deleted. The money has already been spent.';
}

export function deleteFailedMessage(): string {
  return 'Could not delete this transaction.';
}

export function editStubMessage(): string {
  return 'The edit form is not built yet.';
}

// The centre + button's add menu (TabFabMenu): three ways to add a transaction.
export function addTransactionLabel(): string {
  return 'Add transaction';
}

export function closeAddMenuLabel(): string {
  return 'Close menu';
}

export function addMenuScanAccessibilityLabel(): string {
  return 'Scan a receipt';
}

export function addMenuAiAccessibilityLabel(): string {
  return 'Add with AI chat';
}

export function addMenuManualAccessibilityLabel(): string {
  return 'Add manually';
}

export function addTransactionTitle(): string {
  return 'Add transaction';
}

export function scanReceiptTitle(): string {
  return 'Scan struk';
}

export function addStubMessage(): string {
  return 'The add form is not built yet.';
}

// The second change line under the balance: since the start of the year.
export function ytdCaption(dateText: string): string {
  return `YTD · vs ${dateText}`;
}

export function netWorthYtdChangeLabel(amountFormatted: string, pctFormatted: string, dateText: string): string {
  return pctFormatted
    ? `Year to date ${amountFormatted} (${pctFormatted}) vs ${dateText}`
    : `Year to date ${amountFormatted} vs ${dateText}`;
}

// ---------------------------------------------------------------- Transaction form
// Tx-Add, Tx-Add-Errors, Tx-Add-Transfer and the edit form (DESIGN.md section 14 for the messages).
export function editTransactionTitle(): string {
  return 'Edit transaction';
}

export function chatButtonLabel(): string {
  return 'Chat';
}

export function chatButtonAccessibilityLabel(): string {
  return 'Add this transaction by chat instead';
}

export function amountFieldLabel(): string {
  return 'Amount';
}

export function amountToMoveLabel(): string {
  return 'Amount to move';
}

export function amountAccessibilityLabel(): string {
  return 'Amount in rupiah';
}

export function quickAddLabel(amountFormatted: string): string {
  return `+${amountFormatted}`;
}

export function quickAddAccessibilityLabel(amountFormatted: string): string {
  return `Add ${amountFormatted} to the amount`;
}

export function moreCategoriesLabel(): string {
  return 'More';
}

export function allCategoriesTitle(): string {
  return 'All categories';
}

export function allCategoriesSubtitle(kindLabel: string): string {
  return `Choose a ${kindLabel.toLowerCase()} category`;
}

export function formAccountLabel(): string {
  return 'Account';
}

export function fromLabel(): string {
  return 'From';
}

export function toLabel(): string {
  return 'To';
}

export function balanceAfterColonLabel(amountFormatted: string): string {
  return `Balance after: ${amountFormatted}`;
}

export function swapAccountsLabel(): string {
  return 'Swap From and To';
}

export function transferInfoBanner(): string {
  return 'Moves money between your own accounts. Net worth does not change, and this is not counted as income or an expense.';
}

export function formDateLabel(): string {
  return 'Date';
}

export function todayLabel(): string {
  return 'Today';
}

export function yesterdayLabel(): string {
  return 'Yesterday';
}

export function formDescriptionLabel(): string {
  return 'Description';
}

export function formDescriptionOptionalLabel(): string {
  return 'Description · optional';
}

export function descriptionPlaceholder(): string {
  return 'e.g. Furniture deposit';
}

export function formNotesOptionalLabel(): string {
  return 'Notes · optional';
}

export function notesPlaceholder(): string {
  return 'Add a note';
}

export function saveButtonLabel(type: 'income' | 'expense' | 'transfer' | 'edit'): string {
  return type === 'edit' ? 'Save changes' : `Save ${type}`;
}

export function savingLabel(): string {
  return 'Saving…';
}

export function fieldsNeedAttention(count: number): string {
  return count === 1 ? '1 field needs attention before this can be saved.' : `${count} fields need attention before this can be saved.`;
}

export function pickAccountTitle(): string {
  return 'Choose account';
}

export function pickAccountSubtitle(): string {
  return 'Your balance now is shown for each';
}

export function pickFromTitle(): string {
  return 'Choose the From account';
}

export function pickToTitle(): string {
  return 'Choose the To account';
}

export function valasComingLater(): string {
  return 'Valas: coming later';
}

export function balanceNowLabel(amountFormatted: string): string {
  return `Balance ${amountFormatted}`;
}

export function pickDateTitle(): string {
  return 'Choose date';
}

export function pickDateSubtitle(): string {
  return 'Not later than today';
}

export function previousMonthLabel(): string {
  return 'Previous month';
}

export function nextMonthLabel(): string {
  return 'Next month';
}

export function chooseDateAccessibilityLabel(dateText: string): string {
  return `Date, ${dateText}. Choose another date`;
}

export function typeLockedHint(): string {
  return 'The type of a transfer cannot be changed.';
}

export function couldNotSaveMessage(): string {
  return "Couldn't save. Nothing was changed.";
}

export function txSavedMessage(
  kind: 'income' | 'expense' | 'transfer',
  accountName: string,
  balanceFormatted: string,
  toAccountName?: string,
  toBalanceFormatted?: string,
): string {
  const label = txKindLabel(kind);
  if (kind === 'transfer' && toAccountName && toBalanceFormatted) {
    return `${label} saved. ${accountName} is now ${balanceFormatted}, ${toAccountName} ${toBalanceFormatted}.`;
  }
  return `${label} saved. ${accountName} is now ${balanceFormatted}.`;
}

export function changesSavedMessage(): string {
  return 'Changes saved.';
}

export function undoFailedMessage(): string {
  return 'Could not undo that.';
}

// One field's error, as a sentence. `linkText` is the part of the sentence that is a link
// ("transfer money in first" switches the form to a transfer into that account).
export interface TxErrorMessage {
  text: string;
  linkText?: string;
}

export interface TxErrorInput {
  code: string;
  accountName?: string;
  balance?: number;
  shortfall?: number;
  today?: string;
  type?: 'income' | 'expense' | 'transfer';
}

export const TRANSFER_IN_FIRST_LINK = 'transfer money in first';

export function txFieldErrorMessage(error: TxErrorInput, rpFormat: (n: number) => string, dateFormat: (d: string) => string): TxErrorMessage {
  switch (error.code) {
    case 'amount_required':
      return { text: 'Enter an amount above Rp0.' };
    case 'category_required':
      return { text: 'Choose a category so this counts toward the right budget.' };
    case 'category_kind_mismatch':
      return { text: 'Choose a category that matches the transaction type.' };
    case 'account_required':
      return { text: 'Choose an account.' };
    case 'to_account_required':
      return { text: 'Choose the account to move the money to.' };
    case 'forex_not_supported':
      return { text: 'Valas accounts are coming later. Pick a rupiah account.' };
    case 'same_account':
      return { text: 'Pick two different accounts.' };
    case 'insufficient_balance': {
      const name = error.accountName ?? 'This account';
      const has = rpFormat(error.balance ?? 0);
      const short = rpFormat(error.shortfall ?? 0);
      if (error.type === 'transfer') {
        return { text: `${name} only has ${has}. Pick another account or lower the amount. Short by ${short}.` };
      }
      return {
        text: `${name} only has ${has}. Pick another account, lower the amount, or ${TRANSFER_IN_FIRST_LINK}. Short by ${short}.`,
        linkText: TRANSFER_IN_FIRST_LINK,
      };
    }
    case 'future_date':
      return { text: `Date cannot be later than ${dateFormat(error.today ?? '')}.` };
    case 'before_opening_date':
      return { text: "This account didn't exist yet on that date." };
    default:
      return { text: couldNotSaveMessage() };
  }
}

// The database's own error code (the guards are a backstop behind the form's checks), as a
// message. Unknown codes never leak a technical string.
export function txDbErrorMessage(
  code: string | undefined,
  ctx: { shortfallFormatted?: string; currency?: string; todayFormatted?: string } = {},
): string {
  switch (code) {
    case 'future_date':
      return ctx.todayFormatted ? `Date cannot be later than ${ctx.todayFormatted}.` : 'Date cannot be in the future.';
    case 'before_opening_date':
      return "This account didn't exist yet on that date.";
    case 'category_kind_mismatch':
      return 'Choose a category that matches the transaction type.';
    case 'insufficient_balance':
      return ctx.shortfallFormatted ? `Short by ${ctx.shortfallFormatted}. Pick another account or lower the amount.` : 'Not enough balance in this account.';
    case 'currency_not_in_account':
      return ctx.currency ? `This account does not have a ${ctx.currency} pocket.` : 'This account does not have a pocket for that currency.';
    case 'missing_fx_rate':
      return ctx.currency ? `Add an exchange rate for ${ctx.currency} first.` : 'Add an exchange rate first.';
    default:
      return couldNotSaveMessage();
  }
}

// The date sheet's weekday row, Monday first.
export function weekdayInitials(): string[] {
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
}

export function chooseAccountPlaceholder(): string {
  return 'Choose account';
}

// ---------------------------------------------------------------- Account detail and form
// Account-Detail and Account-Edit (new and existing).
export function accountKindCaption(typeLabel: string): string {
  return `${typeLabel} · current balance`;
}

const accountTypeNames: Record<'bank' | 'cash' | 'ewallet' | 'savings' | 'forex', string> = {
  bank: 'Bank account',
  cash: 'Cash',
  ewallet: 'E-wallet',
  savings: 'Savings',
  forex: 'Valas account',
};

export function accountTypeName(type: 'bank' | 'cash' | 'ewallet' | 'savings' | 'forex'): string {
  return accountTypeNames[type];
}

export function editAccountLabel(): string {
  return 'Edit account';
}

export function openingBalanceOnLabel(dateText: string): string {
  return `Opening balance · ${dateText}`;
}

export function moneyInLabel(): string {
  return 'Money in';
}

export function moneyOutLabel(): string {
  return 'Money out';
}

export function currentBalanceLabel(): string {
  return 'Current balance';
}

export function moneyInOutNote(): string {
  return 'Money in and out include transfers to and from your other accounts.';
}

export function addToAccountLabel(): string {
  return 'Add';
}

export function transferFromAccountLabel(): string {
  return 'Transfer';
}

export function activityMonthTitle(monthName: string): string {
  return `Activity · ${monthName}`;
}

export function newestFirstLabel(): string {
  return 'Newest first';
}

export function activityFilterLabel(filter: 'all' | 'in' | 'out'): string {
  return filter === 'all' ? 'All' : filter === 'in' ? 'In' : 'Out';
}

export function activityKindLabel(kind: 'income' | 'expense' | 'transfer_out' | 'transfer_in'): string {
  return kind === 'income' ? 'Income' : kind === 'expense' ? 'Expense' : kind === 'transfer_out' ? 'Transfer out' : 'Transfer in';
}

export function activitySubtitle(dateText: string, balanceFormatted: string): string {
  return `${dateText} · Balance ${balanceFormatted}`;
}

export function activityEmptyMessage(monthName: string): string {
  return `Nothing recorded in ${monthName} yet.`;
}

export function activityFilterEmptyMessage(): string {
  return 'No records match this filter.';
}

export function viewAllForAccountLabel(): string {
  return 'View all transactions for this account';
}

export function accountNotFoundMessage(): string {
  return 'This account no longer exists.';
}

export function accountDetailLoadError(): string {
  return 'Could not load this account.';
}

export function newAccountTitle(): string {
  return 'New account';
}

export function accountTypeSectionLabel(): string {
  return 'Account type';
}

export function accountTypeTileLabel(type: 'bank' | 'cash' | 'ewallet' | 'savings'): string {
  return type === 'bank' ? 'Bank' : type === 'cash' ? 'Cash' : type === 'ewallet' ? 'E-wallet' : 'Savings';
}

export function accountNameLabel(): string {
  return 'Account name';
}

export function accountNamePlaceholder(): string {
  return 'e.g. BCA Tabungan';
}

export function openingBalanceLabel(): string {
  return 'Opening balance';
}

export function asOfDateLabel(dateText: string): string {
  return `As of ${dateText}`;
}

export function openingBalanceHelp(): string {
  return 'The balance on that date. Income, expenses and transfers you record afterwards move it. Editing this later recalculates the current balance.';
}

export function accountIconSectionLabel(): string {
  return 'Icon · optional';
}

export function noBankIconLabel(): string {
  return 'No bank';
}

export function bankIconAccessibilityLabel(name: string): string {
  return `${name} icon`;
}

export function accountPrivacyNote(): string {
  return 'No bank login or card number is needed. This is only a label you keep on this device.';
}

export function createAccountLabel(): string {
  return 'Create account';
}

export function accountCreatedMessage(name: string, balanceFormatted: string): string {
  return `Account created. ${name} starts at ${balanceFormatted}.`;
}

export function accountChangesSavedMessage(): string {
  return 'Changes saved.';
}

export function accountFieldErrorMessage(
  error: { code: string; shortfall?: number; firstRecordOn?: string; today?: string },
  rpFormat: (n: number) => string,
  dateFormat: (d: string) => string,
): string {
  switch (error.code) {
    case 'name_required':
      return 'Give the account a name.';
    case 'name_too_long':
      return 'Keep the name to 40 characters or fewer.';
    case 'name_taken':
      return 'You already have an account with this name.';
    case 'balance_invalid':
      return 'Enter an opening balance of Rp0 or more.';
    case 'balance_below_zero':
      return `With this opening balance the account would be ${rpFormat(error.shortfall ?? 0)} below zero. Enter a higher amount.`;
    case 'future_date':
      return `Date cannot be later than ${dateFormat(error.today ?? '')}.`;
    case 'after_first_record':
      return `This account has records from ${dateFormat(error.firstRecordOn ?? '')}. Pick that day or an earlier one.`;
    default:
      return couldNotSaveMessage();
  }
}

export function accountDbErrorMessage(code: string | undefined, ctx: { firstRecordOn?: string } = {}): string {
  switch (code) {
    case 'name_taken':
      return 'You already have an account with this name.';
    case 'before_opening_date':
      return ctx.firstRecordOn ? `This account has records from ${ctx.firstRecordOn}. Pick that day or an earlier one.` : 'This account has records before that date.';
    case 'insufficient_balance':
      return 'With this opening balance the account would go below zero.';
    case 'account_type_locked':
      return 'This account type can no longer be changed.';
    default:
      return couldNotSaveMessage();
  }
}


// AI Chat setup & consent (K1, DESIGN.md "K. AI chat").
export function aiSetupTitle(): string {
  return 'Catat lewat chat';
}

export function aiSetupBadge(): string {
  return 'FITUR OPSIONAL';
}

export function aiSetupDescription(): string {
  return 'Ketik "kopi 25rb pakai GoPay", AI menyiapkan draf transaksinya. Kamu cek, lalu simpan. Fitur ini mati sampai kamu memasukkan API key Gemini milikmu sendiri.';
}

export function aiSetupSentToGemini(): string {
  return 'DIKIRIM KE GEMINI';
}

export function aiSetupNotSent(): string {
  return 'TIDAK DIKIRIM';
}

export function aiSetupSentItem1(): string {
  return 'Pesan yang kamu ketik';
}

export function aiSetupSentItem2(): string {
  return 'Nama akun dan nama kategori, supaya draf cocok dengan datamu';
}

export function aiSetupSentItem3(): string {
  return 'Tanggal hari ini';
}

export function aiSetupNotSentItem1(): string {
  return 'Saldo, riwayat transaksi, anggaran, dan target';
}

export function aiSetupNotSentItem2(): string {
  return 'Berkas cadangan';
}

export function aiSetupApiKeyLabel(): string {
  return 'API KEY GEMINI';
}

export function aiSetupWhatsThisLabel(): string {
  return 'Kunci apa?';
}

export function aiSetupPasteButton(): string {
  return 'Tempel';
}

export function aiSetupKeyNote(): string {
  return 'Dibuat di Google AI Studio. Disimpan hanya di ponsel ini (Android Keystore). MONO tidak punya server yang menerimanya.';
}

export function aiSetupBillingWarning(): string {
  return 'Pesanmu diproses lewat API key-mu. Pemakaian mengikuti kuota atau tagihan tersebut. Fitur ini perlu internet; bagian lain MONO tetap offline.';
}

export function aiSetupSaveAndTest(): string {
  return 'Simpan dan tes kunci';
}

export function aiSetupLaterButton(): string {
  return 'Nanti saja';
}

export function aiSetupTestNote(): string {
  return 'Tes mengirim satu pesan singkat. Tidak ada data keuangan di dalamnya.';
}

export function aiChatGreeting(): string {
  return 'Halo! Ketik transaksimu, misalnya "kopi 25rb pakai GoPay".';
}

export function aiChatFooterWarning(): string {
  return 'AI bisa salah. Selalu cek draf sebelum menyimpan.';
}

export function aiChatInputPlaceholder(): string {
  return 'Ketik transaksi…';
}

export function aiDraftSaveButton(): string {
  return 'Simpan';
}

export function aiDraftEditButton(): string {
  return 'Ubah';
}

export function aiDraftCancelButton(): string {
  return 'Batal';
}

export function aiDraftExpenseKind(): string {
  return 'PENGELUARAN';
}

export function aiDraftIncomeKind(): string {
  return 'PEMASUKAN';
}

export function aiDraftTransferKind(): string {
  return 'TRANSFER';
}

// ---------------------------------------------------------------- AI chat: fixed sentences
// Every sentence the person reads in the chat is written here, by the app. The model never
// supplies one (CLAUDE.md rule 9). src/features/ai_chat/messages.ts assembles them.
export function aiMsgOutOfScope(): string {
  return 'Aku cuma bisa mencatat transaksi. Coba ketik seperti “kopi 25rb pake gopay”.';
}

export function aiMsgDataLookup(): string {
  return 'Aku tidak membaca saldomu, aku hanya mencatat. Saldo ada di tab Accounts.';
}

export function aiMsgOpenAccounts(): string {
  return 'Buka Accounts';
}

export function aiMsgExamples(): string[] {
  return ['Kopi 25rb pake gopay', 'Transfer 500rb BCA ke Jago'];
}

export function aiMsgAskAccountAndCategory(): string {
  return 'Dari akun mana, dan untuk apa? Satu ketukan cukup.';
}

export function aiMsgAskAccount(): string {
  return 'Dari akun mana?';
}

export function aiMsgAskCategory(): string {
  return 'Untuk apa?';
}

export function aiMsgAskAmount(): string {
  return 'Berapa nominalnya?';
}

export function aiMsgAskToAccount(): string {
  return 'Pindah ke akun mana?';
}

export function aiMsgAskType(): string {
  return 'Ini pengeluaran, pemasukan, atau transfer?';
}

export function aiMsgUnknownTransferTarget(name: string): string {
  return `Aku tidak menemukan akun bernama “${name}”. Transfer hanya bisa antar akunmu sendiri. Mau dicatat sebagai pengeluaran?`;
}

export function aiMsgRecordAsExpense(): string {
  return 'Catat pengeluaran';
}

export function aiMsgCheckAmount(typedText: string | null, typedFormatted: string | null, draftFormatted: string): string {
  if (typedText == null || typedFormatted == null) {
    return `Nominal perlu dicek. Drafnya ${draftFormatted}, tapi angkanya tidak cocok dengan pesanmu.`;
  }
  return `Nominal perlu dicek. Kamu mengetik “${typedText}” (${typedFormatted}), drafnya ${draftFormatted}.`;
}

export function aiMsgUseAmount(formatted: string): string {
  return `Pakai ${formatted}`;
}

export function aiMsgDraftsReady(count: number): string {
  return count > 1 ? `Aku menemukan ${count} transaksi. Cek dulu ya.` : 'Oke, ini drafnya. Belum ada yang tersimpan.';
}

export function aiMsgBlockedLead(): string {
  return 'Draf dibuat, tapi tidak bisa disimpan.';
}

export function aiMsgBlockedShortfall(shortfallFormatted: string): string {
  return `Kurang ${shortfallFormatted}. Ganti akun, kecilkan jumlah, atau pindahkan uang dulu.`;
}

export function aiMsgBlockedReason(code: string): string {
  switch (code) {
    case 'future_date':
      return 'Tanggalnya belum terjadi. Ubah tanggalnya.';
    case 'before_opening_date':
      return 'Akun ini belum ada pada tanggal itu. Ganti akun atau tanggalnya.';
    case 'same_account':
      return 'Akun asal dan tujuan sama. Pilih dua akun yang berbeda.';
    case 'category_kind_mismatch':
      return 'Kategorinya tidak cocok dengan jenis transaksi. Pilih kategori lain.';
    case 'forex_not_supported':
      return 'Akun Valas belum didukung di chat. Pilih akun rupiah.';
    default:
      return 'Ada bagian yang perlu diperbaiki. Ketuk Ubah untuk memeriksanya.';
  }
}

export function aiMsgChangeAccount(): string {
  return 'Ganti akun';
}

export function aiMsgChangeAmount(): string {
  return 'Ubah jumlah';
}

export interface AiMsgBlock {
  title: string;
  detail: string;
}

export function aiMsgError(code: string): AiMsgBlock {
  switch (code) {
    case 'no_internet':
      return { title: 'Tidak ada internet.', detail: 'Chat butuh koneksi. Kamu tetap bisa mencatat manual.' };
    case 'key_rejected':
      return { title: 'Kunci Gemini ditolak.', detail: 'Cek kunci di Pengaturan. Tidak ada transaksi yang dibuat.' };
    case 'quota':
      return { title: 'Kuota kunci habis.', detail: 'Coba lagi nanti, atau catat manual. Pesanmu tetap ada di kolom ketik.' };
    case 'unreadable':
      return { title: 'Balasan tidak terbaca.', detail: 'AI mengirim jawaban yang tidak bisa dipakai. Coba kalimat yang lebih singkat. Tidak ada yang tersimpan.' };
    case 'timeout':
      return { title: 'Terlalu lama menunggu.', detail: 'Tidak ada yang berubah. Coba lagi, atau catat manual. Pesanmu tetap ada di kolom ketik.' };
    case 'too_long':
      return { title: 'Pesan terlalu panjang.', detail: 'Maksimal 500 karakter. Persingkat dulu. Tidak ada yang berubah.' };
    case 'empty':
      return { title: 'Pesan masih kosong.', detail: 'Ketik transaksinya dulu.' };
    case 'busy':
      return { title: 'Pesan sebelumnya masih diproses.', detail: 'Tunggu sebentar. Tidak ada yang berubah.' };
    default:
      return { title: 'Gagal memproses.', detail: 'Tidak ada yang berubah.' };
  }
}

export function aiMsgErrorManualAction(): string {
  return 'Catat manual';
}

export function aiMsgErrorSettingsAction(): string {
  return 'Buka pengaturan AI';
}

export function aiMsgSaved(kind: 'income' | 'expense' | 'transfer', accountName: string, balanceFormatted: string, toAccountName?: string, toBalanceFormatted?: string): string {
  if (kind === 'transfer' && toAccountName && toBalanceFormatted) {
    return `Transfer tersimpan. ${accountName} sekarang ${balanceFormatted}, ${toAccountName} ${toBalanceFormatted}.`;
  }
  const label = kind === 'income' ? 'Pemasukan' : kind === 'transfer' ? 'Transfer' : 'Pengeluaran';
  return `${label} tersimpan. ${accountName} sekarang ${balanceFormatted}.`;
}

export function aiMsgSavedMany(count: number): string {
  return `${count} transaksi tersimpan.`;
}

export function aiMsgNotReady(): string {
  return 'Ada draf yang belum siap disimpan. Lengkapi dulu. Tidak ada yang tersimpan.';
}

// ---------------------------------------------------------------- AI chat: screens (AI-2)
// Setup (K1), chat (K2), states (K3) and edit one by one (K4). The sentences the assistant
// "says" are in the aiMsg* block above; these are the screens' own labels.
export function aiBackLabel(): string {
  return 'Kembali';
}

export function aiCloseLabel(): string {
  return 'Tutup';
}

export function aiUndoLabel(): string {
  return 'Urungkan';
}

export function aiRetryLabel(): string {
  return 'Coba lagi';
}

export function aiSetupRejectedHelpLabel(): string {
  return 'Kunci ditolak?';
}

export function aiSetupRejectedHelp(): string {
  return 'Buat kunci baru di Google AI Studio, salin utuh tanpa spasi, lalu tempel di sini. Pastikan kunci itu aktif dan kuotanya belum habis.';
}

export function aiSetupGetKeyLink(): string {
  return 'Belum punya kunci? Buat di Google AI Studio';
}

export function aiSetupGetKeyLinkLabel(): string {
  return 'Buka Google AI Studio di browser untuk membuat API key';
}

export function aiSetupShowKeyLabel(): string {
  return 'Tampilkan kunci';
}

export function aiSetupHideKeyLabel(): string {
  return 'Sembunyikan kunci';
}

export function aiSetupTesting(): string {
  return 'Menguji kunci…';
}

export function aiSetupKeySavedTitle(): string {
  return 'Kunci tersimpan';
}

export function aiSetupKeySavedHint(): string {
  return 'Kunci hanya ada di ponsel ini. Untuk menggantinya, tempel kunci baru di bawah.';
}

export function aiSetupReplaceKeyLabel(): string {
  return 'GANTI KUNCI';
}

export function aiSettingsSwitchLabel(): string {
  return 'Catat lewat chat (AI)';
}

export function aiSettingsSwitchNeedsKeyHint(): string {
  return 'Simpan dan tes kunci dulu.';
}

export function aiSettingsKeyRowLabel(): string {
  return 'API key Gemini';
}

export function aiSettingsKeyRowValue(hasKey: boolean): string {
  return hasKey ? 'Tersimpan' : 'Belum ada';
}

export function aiDeleteKeyLabel(): string {
  return 'Hapus kunci';
}

export function aiDeleteKeyTitle(): string {
  return 'Hapus kunci?';
}

export function aiDeleteKeyMessage(): string {
  return 'Kunci dihapus dari ponsel ini dan Catat lewat chat dimatikan. Transaksi yang sudah kamu simpan tidak berubah.';
}

export function aiDeleteKeyConfirm(): string {
  return 'Hapus';
}

export function aiKeyDeletedToast(): string {
  return 'Kunci dihapus.';
}

export function aiChatHeaderHint(): string {
  return 'Hanya membuat draf';
}

export function aiChatManualButton(): string {
  return 'Catat manual';
}

export function aiChatSettingsLabel(): string {
  return 'Pengaturan AI';
}

export function aiChatOpening(name: string): string {
  const greeting = name.trim() ? `Halo ${name.trim()}!` : 'Halo!';
  return `${greeting} Ketik transaksimu seperti ngobrol, misalnya “kopi 25rb pakai GoPay”. Aku siapkan drafnya, kamu yang menekan Simpan.`;
}

export function aiChatSuggestions(): string[] {
  return ['Beli bensin 40rb', 'Transfer 500rb BCA ke Jago', 'Gaji masuk 8jt ke BCA', 'Makan siang 48rb cash, parkir 5rb'];
}

export function aiChatSendLabel(): string {
  return 'Kirim';
}

export function aiChatCounter(count: number, max: number): string {
  return `${count}/${max}`;
}

export function aiChatProcessing(): string {
  return 'Menyiapkan draf…';
}

export function aiChatCancelRequest(): string {
  return 'Batal';
}

export function aiChatYouLabel(text: string): string {
  return `Kamu: ${text}`;
}

export function aiChatAssistantLabel(text: string): string {
  return `MONO: ${text}`;
}

export function aiChatMascotLabel(): string {
  return 'Maskot MONO';
}

export function aiDraftKindWord(kind: 'income' | 'expense' | 'transfer'): string {
  return kind === 'income' ? 'pemasukan' : kind === 'transfer' ? 'transfer' : 'pengeluaran';
}

export function aiDraftTag(kind: 'income' | 'expense' | 'transfer'): string {
  return `DRAF · ${aiDraftKindWord(kind).toUpperCase()}`;
}

export function aiDraftUnsaved(): string {
  return 'Belum tersimpan';
}

export function aiDraftSavedBadge(): string {
  return 'Tersimpan';
}

export function aiDraftCategoryRow(): string {
  return 'Kategori';
}

export function aiDraftAccountRow(): string {
  return 'Akun';
}

export function aiDraftFromRow(): string {
  return 'Dari';
}

export function aiDraftToRow(): string {
  return 'Ke';
}

export function aiDraftDateRow(): string {
  return 'Tanggal';
}

export function aiDraftBalanceAfterRow(accountName: string): string {
  return `Saldo ${accountName} setelah`;
}

export function aiDraftUntitled(kind: 'income' | 'expense' | 'transfer'): string {
  return kind === 'income' ? 'Pemasukan' : kind === 'transfer' ? 'Transfer' : 'Pengeluaran';
}

export function aiDraftNotSet(): string {
  return 'Belum dipilih';
}

export function aiDraftsHeading(count: number): string {
  return `${count} DRAF`;
}

export function aiDraftsTotalRow(): string {
  return 'Total';
}

export function aiDraftsSaveN(count: number): string {
  return `Simpan ${count} transaksi`;
}

export function aiDraftsEditEach(): string {
  return 'Ubah satu per satu';
}

export function aiDraftLockedNeeds(): string {
  return 'Belum lengkap';
}

export function aiDraftLockedCheckAmount(): string {
  return 'Nominal perlu dicek';
}

export function aiDraftLockedBlocked(): string {
  return 'Tidak bisa disimpan';
}

export function aiDraftCheckboxLabel(title: string, checked: boolean, locked: string | null): string {
  if (locked) return `${title}, ${locked}`;
  return `${title}, ${checked ? 'dipilih' : 'tidak dipilih'}`;
}

export function aiDraftSavingLabel(): string {
  return 'Menyimpan…';
}

export function aiDraftA11y(kind: 'income' | 'expense' | 'transfer', title: string, amountSpoken: string, details: string[], saved: boolean): string {
  const state = saved ? 'tersimpan' : 'belum tersimpan';
  return [`Draf ${aiDraftKindWord(kind)}`, title, amountSpoken, ...details, state].join(', ');
}

export function aiDraftsA11y(count: number, totalSpoken: string): string {
  return `${count} draf transaksi, total ${totalSpoken}, belum tersimpan`;
}

export function aiDraftAmountSpoken(kind: 'income' | 'expense' | 'transfer', formatted: string): string {
  return kind === 'expense' ? `minus ${formatted}` : kind === 'income' ? `plus ${formatted}` : formatted;
}

export function aiEditTitle(): string {
  return 'Ubah draf';
}

export function aiEditProgress(index: number, total: number): string {
  return `${index} dari ${total}`;
}

export function aiEditFromMessage(): string {
  return 'Dari pesanmu';
}

export function aiEditSaveContinue(): string {
  return 'Simpan dan lanjut';
}

export function aiEditSkip(): string {
  return 'Lewati';
}

export function aiEditDiscardTitle(): string {
  return 'Buang perubahan?';
}

export function aiEditDiscardMessage(): string {
  return 'Draf yang belum kamu simpan akan hilang. Yang sudah tersimpan tetap tersimpan.';
}

export function aiEditDiscardConfirm(): string {
  return 'Buang';
}

export function aiEditKeepEditing(): string {
  return 'Lanjut';
}

export function aiEditNothingToEdit(): string {
  return 'Tidak ada draf untuk diubah.';
}

export function aiLoadErrorMessage(): string {
  return 'Data belum bisa dibaca. Tidak ada yang berubah.';
}

export function aiUndoFailed(): string {
  return 'Tidak bisa mengurungkan. Tidak ada yang berubah.';
}

// ---------------------------------------------------------------- More (pushed from the Overview avatar)
export function moreScreenTitle(): string {
  return 'More';
}

export function moreBackText(): string {
  return 'Overview';
}

export function moreBackLabel(): string {
  return 'Kembali ke Overview';
}

export function moreGroupMoney(): string {
  return 'UANG';
}

export function moreGroupData(): string {
  return 'DATA DAN APLIKASI';
}

export function moreGoalsTitle(): string {
  return 'Target keuangan';
}

export function moreGoalsSub(): string {
  return 'Target dari saldo nyata';
}

export function moreRecurringTitle(): string {
  return 'Pengeluaran tetap';
}

export function moreRecurringSub(dueCount: number): string {
  const base = 'Gym, internet, langganan';
  return dueCount > 0 ? `${base} · ${dueCount} jatuh tempo` : base;
}

export function moreReportsTitle(): string {
  return 'Laporan';
}

export function moreReportsSub(): string {
  return 'Arus kas, pengeluaran, kekayaan bersih, ekspor CSV';
}

// ---------------------------------------------------------------- Reports (H)
export function reportsBackLabel(): string {
  return 'Kembali ke Lainnya';
}

export function reportsRangeMonth(): string {
  return 'Bulan';
}

export function reportsRange3Months(): string {
  return '3 bulan';
}

export function reportsRange6Months(): string {
  return '6 bulan';
}

export function reportsRangeYear(): string {
  return 'Tahun';
}

export function reportsPreviousPeriodLabel(): string {
  return 'Periode sebelumnya';
}

export function reportsNextPeriodLabel(): string {
  return 'Periode berikutnya';
}

export function reportsFlowCaption(rangeText: string): string {
  return `${rangeText} · transfer tidak dihitung`;
}

export function reportsNetCashFlowLabel(): string {
  return 'Arus kas bersih';
}

export function reportsSavingsRateLabel(): string {
  return 'Tingkat tabungan';
}

export function reportsSixMonthTrendTitle(): string {
  return 'Tren enam bulan';
}

export function reportsTrendCaption(): string {
  return 'Rp juta. Batang digambar dari nilai persis di tabel.';
}

export function reportsTrendPartialNote(monthNameText: string, cutoffText: string): string {
  return `* ${monthNameText} sampai ${cutoffText}. Nilai dibulatkan ke Rp100.000.`;
}

export function reportsRoundedNote(): string {
  return 'Nilai dibulatkan ke Rp100.000.';
}

export function reportsColumnMonth(): string {
  return 'BULAN';
}

export function reportsColumnIncome(): string {
  return 'PEMASUKAN';
}

export function reportsColumnExpenses(): string {
  return 'PENGELUARAN';
}

export function reportsColumnNet(): string {
  return 'BERSIH';
}

export function reportsColumnValue(): string {
  return 'NILAI';
}

export function reportsColumnChange(): string {
  return 'PERUBAHAN';
}

export function reportsColumnCategory(): string {
  return 'KATEGORI';
}

export function reportsColumnAmount(): string {
  return 'JUMLAH';
}

export function reportsColumnShare(): string {
  return 'PORSI';
}

export function reportsSpendingByCategoryTitle(): string {
  return 'Pengeluaran per kategori';
}

export function reportsCategoryCaption(rangeText: string, totalFormatted: string): string {
  return `${rangeText} · total ${totalFormatted}`;
}

export function reportsSharesRoundingNote(): string {
  return 'Porsi dibulatkan dan mungkin tidak berjumlah tepat 100%.';
}

export function reportsNoSpendingMessage(): string {
  return 'Belum ada pengeluaran pada periode ini.';
}

export function reportsNetWorthTitle(): string {
  return 'Kekayaan bersih';
}

export function reportsNetWorthCaption(): string {
  return 'Akhir bulan, Rp juta · semua akun digabung';
}

export function reportsFirstRecordLabel(): string {
  return 'catatan pertama';
}

export function reportsTodayWord(): string {
  return 'hari ini';
}

export function reportsNetWorthUp(amountFormatted: string): string {
  return `naik ${amountFormatted}`;
}

export function reportsNetWorthDown(amountFormatted: string): string {
  return `turun ${amountFormatted}`;
}

export function reportsNetWorthFlat(): string {
  return 'tidak berubah';
}

export function reportsNetWorthExactNote(
  whenText: string,
  changeText: string,
  valueFormatted: string,
  pctFormatted: string,
  previousMonthText: string,
): string {
  return `Tepat ${whenText}: ${valueFormatted}, ${changeText} (${pctFormatted}) dari akhir bulan ${previousMonthText}. Perubahan memakai nilai persis, jadi bisa berbeda 0,1 dari kolom yang dibulatkan. Transfer tidak mengubah kekayaan bersih.`;
}

export function reportsNetWorthExactFirstNote(whenText: string, valueFormatted: string): string {
  return `Tepat ${whenText}: ${valueFormatted}. Perubahan memakai nilai persis, jadi bisa berbeda 0,1 dari kolom yang dibulatkan. Transfer tidak mengubah kekayaan bersih.`;
}

export function reportsExportTitle(): string {
  return 'Ekspor CSV';
}

export function reportsExportCaption(): string {
  return 'Disimpan di perangkat ini. Tidak diunggah.';
}

export function reportsExportTransactionsLabel(): string {
  return 'Transaksi';
}

export function reportsExportTransactionsSub(): string {
  return 'Periode terpilih, semua akun';
}

export function reportsExportBalancesLabel(): string {
  return 'Saldo akun';
}

export function reportsExportBalancesSub(): string {
  return 'Akhir bulan, per akun';
}

export function reportsCsvButtonLabel(): string {
  return 'CSV';
}

export function reportsExportTransactionsAccessibility(): string {
  return 'Ekspor transaksi sebagai CSV';
}

export function reportsExportBalancesAccessibility(): string {
  return 'Ekspor saldo akun sebagai CSV';
}

export function reportsCsvShareTitle(): string {
  return 'Bagikan CSV';
}

export function reportsCsvReadyToast(): string {
  return 'CSV siap dibagikan.';
}

export function reportsCsvFailedToast(): string {
  return 'Berkas tidak bisa diekspor.';
}

export function reportsFooterNote(): string {
  return 'Semua angka di layar ini dihitung dari transaksi yang kamu catat.';
}

export function reportsEmptyTitle(): string {
  return 'Data belum cukup untuk laporan';
}

export function reportsEmptyBody(): string {
  return 'Terus catat selama satu bulan penuh, lalu kembali lagi.';
}

export function moreCategoriesTitle(): string {
  return 'Kategori';
}

export function moreCategoriesSub(): string {
  return 'Kategori pemasukan dan pengeluaran';
}

export function moreBackupRestoreTitle(): string {
  return 'Cadangan dan pemulihan';
}

export function moreBackupRestoreSub(): string {
  return 'Ekspor atau pulihkan cadangan JSON, ekspor CSV';
}

export function moreSettingsTitle(): string {
  return 'Pengaturan';
}

export function moreSettingsSub(): string {
  return 'Mata uang, privasi, format, tentang';
}

export function moreFooterLine(version: string | null): string {
  const parts = [version ? `Versi ${version}` : null, 'Bekerja offline', 'Tanpa akun, tanpa sinkron'];
  return parts.filter(Boolean).join(' · ');
}

export function moreRowLabel(title: string, sub: string): string {
  return `${title}, ${sub}`;
}

export function moreComingSoon(): string {
  return 'Layar ini belum dibuat.';
}

export function moreLogoLabel(): string {
  return 'MONO Finance';
}

// ---------------------------------------------------------------- Database
export function dbOpenFailedMessage(): string {
  return 'Databasenya gagal dibuka.';
}

export function dbRetryLabel(): string {
  return 'Coba lagi';
}

// ---------------------------------------------------------------- Language
export function moreGroupLanguage(): string {
  return 'BAHASA';
}

export function languageEnglishLabel(): string {
  return 'English';
}

export function languageIndonesianLabel(): string {
  return 'Bahasa Indonesia';
}

export function languageSelectorLabel(): string {
  return 'Bahasa';
}

// Goals list screen & edit form (DESIGN.md "G. Goals").
export function goalNeededPaceLabel(amountFormatted: string): string {
  return 'Laju yang dibutuhkan, perkiraan';
}

export function goalNeededPaceValue(amountFormatted: string): string {
  return `${amountFormatted} / bulan`;
}

export function goalAccountLinkedLabel(accountName: string): string {
  return `Akun tertaut: ${accountName}`;
}

export function goalNotLinkedLabel(): string {
  return 'Belum tertaut ke akun';
}

export function goalCalculatedLabel(): string {
  return 'Dihitung: semua akun dijumlahkan';
}

export function goalsEmptyTitle(): string {
  return 'Belum ada target';
}

export function goalsEmptyBody(): string {
  return 'Buat satu untuk melacak tabunganmu.';
}

export function addGoalLabel(): string {
  return 'Tambah target';
}

export function goalsFooterNote(): string {
  return 'Kemajuan tidak pernah diketik. Dihitung dari akun yang tertaut, jadi selalu sama dengan catatanmu.';
}

export function goalNoTargetDate(): string { return 'Tanpa tanggal target'; }
export function goalBackLabel(): string { return 'Kembali ke Lainnya'; }
export function goalBackText(): string { return 'Lainnya'; }
export function goalPastDueLabel(): string { return 'Tanggal target sudah lewat'; }
export function goalTargetAccessibilityLabel(name: string, current: string, target: string, progress: string): string {
  return `${name}, ${current} dari ${target}, ${progress} tercapai, ketuk untuk mengubah`;
}

// Goal edit form.
export function newGoalTitle(): string {
  return 'Target baru';
}

export function editGoalTitle(): string {
  return 'Ubah target';
}

export function goalNameLabel(): string {
  return 'Nama';
}

export function goalNamePlaceholder(): string {
  return 'Contoh: Dana darurat';
}

export function goalProgressSourceLabel(): string {
  return 'Kemajuan dihitung dari';
}

export function goalModeOneAccountLabel(): string {
  return 'Satu akun';
}

export function goalModeOneAccountSub(): string {
  return 'Saldo satu akun tertaut';
}

export function goalModeTotalAssetsLabel(): string {
  return 'Total aset';
}

export function goalModeTotalAssetsSub(): string {
  return 'Semua akun dijumlahkan';
}

export function goalLinkedAccountLabel(): string {
  return 'Akun tertaut';
}

export function goalCurrentBalanceNote(amountFormatted: string): string {
  return `Saldo sekarang ${amountFormatted} · dibaca dari catatanmu, bukan diketik.`;
}

export function goalTargetAmountLabel(): string {
  return 'Jumlah target';
}

export function goalTargetDateLabel2(): string {
  return 'Tanggal target, opsional';
}

export function goalPreviewLabel(): string {
  return 'Pratinjau dari catatan tersimpan';
}

export function goalPreviewSavedSoFar(): string {
  return 'Terkumpul sejauh ini';
}

export function goalPreviewRemaining(): string {
  return 'Sisa';
}

export function goalPreviewMonthsLeft(monthsLeft: number, dateFormatted: string): string {
  return `Bulan tersisa, sampai ${dateFormatted}`;
}

export function goalPreviewMonthsLeftValue(monthsLeft: number): string {
  return `${monthsLeft}`;
}

export function goalPreviewNeededPace(): string {
  return 'Laju yang dibutuhkan, perkiraan';
}

export function goalDeleteNote(): string {
  return 'Menghapus target tidak mengubah akun atau transaksi.';
}

export function goalDeleteLabel(): string { return 'Hapus target'; }
export function goalDeleteConfirmTitle(name: string): string { return `Hapus target ${name}?`; }
export function goalDeleteConfirmBody(): string { return 'Akun dan transaksi tidak berubah.'; }
export function goalDeletedToast(): string { return 'Target dihapus.'; }
export function goalAchievedPreview(): string { return 'Target ini sudah tercapai dengan saldo sekarang.'; }
export function goalChooseDate(): string { return 'Pilih tanggal'; }
export function goalMonthlyValue(amountFormatted: string): string { return `${amountFormatted} / bulan`; }

export function saveGoalLabel(): string {
  return 'Simpan target';
}

export function goalLinkAccountPickerTitle(): string {
  return 'Link an account';
}

export function goalNameTooLong(): string {
  return 'Nama maksimal 40 karakter.';
}

export function goalNameRequired(): string {
  return 'Nama target wajib diisi.';
}

export function goalAmountRequired(): string {
  return 'Jumlah target harus lebih dari nol.';
}

export function goalAccountRequired(): string {
  return 'Pilih akun yang akan ditautkan.';
}

export function goalLinkCTA(): string {
  return 'Tautkan akun atau catat setoran untuk mulai melacak.';
}

// ---- Receipt scan (/tx/scan, /tx/scan/review): the camera, its error states and the review ----
export function receiptFrameHint(): string {
  return 'Masukkan seluruh struk ke dalam bingkai. Pastikan teks terbaca dan tidak buram.';
}

export function receiptCloseLabel(): string {
  return 'Tutup';
}

export function receiptFlashLabel(on: boolean): string {
  return on ? 'Matikan flash' : 'Nyalakan flash';
}

export function receiptGalleryLabel(): string {
  return 'Pilih dari galeri';
}

export function receiptShutterLabel(): string {
  return 'Ambil foto';
}

export function receiptManualLabel(): string {
  return 'Isi manual';
}

export function receiptReadingLabel(): string {
  return 'Membaca struk…';
}

export function receiptPermissionTitle(): string {
  return 'Kamera belum diizinkan';
}

export function receiptPermissionBody(): string {
  return 'Izinkan kamera supaya MONO bisa memotret struk. Gambarnya dibaca di perangkat, tidak disimpan, dan tidak dikirim ke mana pun. Kamu juga bisa memilih foto dari galeri.';
}

export function receiptOpenSettingsLabel(): string {
  return 'Buka pengaturan';
}

export function receiptAllowCameraLabel(): string {
  return 'Izinkan kamera';
}

export function receiptUnreadableMessage(): string {
  return 'Struk belum terbaca. Coba foto ulang atau isi manual.';
}

export function receiptForeignMessage(): string {
  return 'Struk dalam mata uang asing belum bisa dibaca di sini. Isi manual saja.';
}

export function receiptRetakeLabel(): string {
  return 'Foto ulang';
}

export function receiptReviewTitle(): string {
  return 'Hasil scan';
}

export function receiptBackLabel(): string {
  return 'Kembali';
}

export function receiptOnDeviceTitle(): string {
  return 'Dibaca di perangkat';
}

export function receiptOnDeviceNote(): string {
  return 'Gambar tidak disimpan dan tidak dikirim. Periksa dulu sebelum menyimpan.';
}

export function receiptDraftTag(): string {
  return 'DRAF · PENGELUARAN';
}

export function receiptNotSavedLabel(): string {
  return 'Belum tersimpan';
}

export function receiptDateLine(dateText: string, fromReceipt: boolean): string {
  return fromReceipt ? `${dateText} · dari struk` : `${dateText} · hari ini`;
}

export function receiptShopLabel(): string {
  return 'Nama toko';
}

export function receiptTotalPick(): string {
  return 'Total, pilih yang benar';
}

export function receiptTotalTypeOwn(): string {
  return 'Ketik sendiri';
}

export function receiptTotalOwnLabel(): string {
  return 'Total (Rp)';
}

export function receiptCategoryLabel(): string {
  return 'Kategori';
}

export function receiptChooseCategory(): string {
  return 'Pilih kategori';
}

export function receiptAccountLabel(): string {
  return 'Akun';
}

export function receiptDateLabel(): string {
  return 'Tanggal';
}

export function receiptBalanceAfter(amountText: string): string {
  return `Saldo setelah ${amountText}`;
}

export function receiptSimilarNotice(dateText: string, amountText: string, name: string): string {
  return `Mirip dengan transaksi ${dateText}: ${amountText}${name ? `, ${name}` : ''}. Tetap boleh disimpan.`;
}

export function receiptCancelLabel(): string {
  return 'Batal';
}

export function receiptSaveLabel(): string {
  return 'Simpan pengeluaran';
}

export function receiptSavingLabel(): string {
  return 'Menyimpan…';
}

export function receiptNothingToReview(): string {
  return 'Tidak ada hasil scan untuk diperiksa.';
}

export function receiptScanAgainLabel(): string {
  return 'Scan lagi';
}

export function receiptLoadError(): string {
  return 'Akun dan kategori tidak bisa dimuat.';
}

// ---- Receipt scan: "Rapikan dengan AI" and its consent dialog ----
export function receiptAiButton(): string {
  return 'Rapikan dengan AI';
}

export function receiptAiBusy(): string {
  return 'Merapikan…';
}

export function receiptAiNote(): string {
  return 'Hanya teks hasil bacaan yang dikirim ke Gemini, bukan gambar.';
}

export function receiptAiAdjusted(): string {
  return 'Disesuaikan AI';
}

export function receiptAiNothingChanged(): string {
  return 'AI tidak menemukan yang perlu dirapikan.';
}

export function receiptCategoryByAi(name: string): string {
  return `${name} ✓`;
}

export function receiptConsentTitle(): string {
  return 'Kirim teks struk ke Google?';
}

export function receiptConsentLead(): string {
  return 'Dikirim lewat kunci Gemini-mu: ';
}

export function receiptConsentStrong(): string {
  return 'teks hasil bacaan';
}

export function receiptConsentRest(): string {
  return ' (nama toko dan item), nama akun dan kategori, dan tanggal hari ini.\n\nTidak dikirim: gambar struk, saldo, riwayat transaksi. Kamu akan ditanya setiap kali.';
}

export function receiptConsentCancel(): string {
  return 'Jangan kirim';
}

export function receiptConsentConfirm(): string {
  return 'Kirim';
}

// ---- Automatic import from notifications: Settings entry, Import-Setup, Import-Settings, Import-Permission, dev sampler ----
export function settingsAssistantGroup(): string {
  return 'Asisten';
}

export function importAutoTitle(): string {
  return 'Impor otomatis';
}

export function importAutoRowHint(): string {
  return 'Siapkan transaksi dari notifikasi bank dan e-wallet';
}

export function importAutoRowValue(count: number): string {
  return count === 0 ? 'Mati' : `${count} aplikasi aktif`;
}

export function importIntro(): string {
  return 'Kurangi catat manual. MONO bisa menyiapkan transaksi dari notifikasi bank atau e-wallet-mu. Kamu tinjau dulu; tidak ada yang tersimpan sebelum kamu menekan Simpan.';
}

export function importNotifTitle(): string {
  return 'Notifikasi Android';
}

export function importPillOff(): string {
  return 'Belum aktif';
}

export function importPillOn(): string {
  return 'Aktif';
}

export function importNotifDesc(): string {
  return 'Membaca notifikasi dari aplikasi bank dan e-wallet yang kamu pilih. Diproses di ponsel, tanpa internet.';
}

export function importEnableAccess(): string {
  return 'Aktifkan akses notifikasi';
}

export function importReadsHeader(): string {
  return 'Yang dibaca MONO';
}

export function importReads1(): string {
  return 'Hanya notifikasi dari aplikasi yang kamu pilih.';
}

export function importReads2(): string {
  return 'Nominal, jenis, waktu, merchant, dan nama bank atau e-wallet.';
}

export function importNotReadHeader(): string {
  return 'Yang tidak dibaca atau disimpan';
}

export function importNotRead1(): string {
  return 'Notifikasi lain, dari aplikasi yang tidak kamu pilih.';
}

export function importNotRead2(): string {
  return 'Isi lengkap pesan. Yang disimpan hanya hasil bacanya.';
}

export function importNotRead3(): string {
  return 'Kata sandi atau PIN. MONO tidak pernah memintanya.';
}

export function importOptionalNote(): string {
  return 'Opsional dan mati secara default. Kamu bisa mematikannya kapan saja; transaksi yang sudah kamu simpan tetap ada.';
}

export function importPendingLink(count: number): string {
  return count === 0 ? 'Belum ada transaksi yang menunggu tinjauan' : `${count} transaksi menunggu tinjauan`;
}

export function importPendingSub(): string {
  return 'Belum ada yang tersimpan';
}

export function importAccessRow(): string {
  return 'Akses notifikasi';
}

export function importLastRead(dateTime: string): string {
  return `Terakhir membaca ${dateTime}`;
}

export function importNeverRead(): string {
  return 'Belum ada notifikasi yang dibaca';
}

export function importAccessOn(): string {
  return 'Aktif';
}

export function importAccessOff(): string {
  return 'Mati';
}

export function importFullGroup(): string {
  return 'Didukung penuh';
}

export function importFullEmpty(): string {
  return 'Belum ada. Aplikasi masuk ke sini setelah punya pembaca khusus yang diuji dengan teks asli.';
}

export function importDetectedGroup(): string {
  return 'Aplikasi terdeteksi';
}

export function importDetectedHelp(): string {
  return 'Dibaca dengan pembacaan umum. Hasilnya selalu perlu kamu periksa.';
}

export function importDetectedEmpty(): string {
  return 'Belum ada aplikasi yang terdeteksi. Setelah aplikasi bank atau e-wallet-mu mengirim notifikasi, namanya muncul di sini.';
}

export function importAppToAccount(name: string): string {
  return `Ke akun ${name}`;
}

export function importAppUnmapped(): string {
  return 'Belum dipetakan ke akun';
}

export function importAppSwitchLabel(appName: string, on: boolean): string {
  return `${appName}, ${on ? 'aktif' : 'mati'}`;
}

export function importOnlyEnabledNote(): string {
  return 'Hanya aplikasi yang menyala di atas yang dibaca. Tiap aplikasi dihubungkan ke satu akun MONO.';
}

export function importProblemsHeader(): string {
  return 'Kalau ada masalah';
}

export function importProblemAccessOffTitle(): string {
  return 'Akses notifikasi mati.';
}

export function importProblemAccessOffBody(): string {
  return 'MONO tidak bisa membaca notifikasi baru.';
}

export function importOpenGuide(): string {
  return 'Buka panduan izin';
}

export function importProblemStoppedTitle(): string {
  return 'MONO berhenti membaca.';
}

export function importProblemStoppedBody(): string {
  return 'Android menghentikan layanan notifikasi MONO.';
}

export function importRestartService(): string {
  return 'Hidupkan ulang';
}

export function importBatteryNote(): string {
  return 'Beberapa ponsel menghentikan MONO di latar belakang untuk hemat baterai. Atur MONO ke "Tanpa pembatasan" di pengaturan baterai agar notifikasi tidak terlewat.';
}

export function importOpenBattery(): string {
  return 'Buka pengaturan baterai';
}

export function importNativeMissing(): string {
  return 'Pembaca notifikasi belum ada di build ini. Pasang ulang aplikasi dari build terbaru.';
}

export function importAppError(code: string): string {
  return code === 'needs_account' ? 'Pilih akun MONO tujuan dulu. Tanpa akun, aplikasi tetap mati.' : code === 'account_missing' ? 'Akun itu tidak ditemukan atau sudah diarsipkan.' : code === 'account_not_rupiah' ? 'Impor hanya bisa ke akun rupiah, bukan akun Valas.' : code === 'unknown_app' ? 'Aplikasi ini belum terdeteksi.' : 'Tidak bisa mengubah pengaturan. Tidak ada yang berubah.';
}

export function importGuideTitle(): string {
  return 'Aktifkan akses notifikasi';
}

export function importGuideSubtitle(): string {
  return 'Satu langkah tambahan di Android 13 ke atas';
}

export function importGuideLead(): string {
  return 'MONO hanya membaca notifikasi dari aplikasi bank dan e-wallet yang kamu pilih. Karena MONO dipasang di luar Play Store, Android 13 ke atas meminta satu langkah tambahan:';
}

export function importGuideStepTitle(step: number): string {
  return ['Buka Info aplikasi MONO', 'Ketuk titik tiga di pojok kanan atas', 'Buka Akses notifikasi', 'Nyalakan MONO'][step - 1] ?? '';
}

export function importGuideStepSub(step: number): string {
  return ['Tekan lama ikon MONO, lalu pilih Info aplikasi.', 'Pilih "Izinkan setelan terbatas".', 'Di pengaturan Android: Notifikasi, Akses notifikasi perangkat.', 'Setujui peringatan Android. Kembali ke MONO setelah itu.'][step - 1] ?? '';
}

export function importGuideNote(): string {
  return 'Izin ini bisa kamu cabut kapan saja. MONO tidak membaca notifikasi dari aplikasi yang tidak kamu pilih.';
}

export function importGuideOpen(): string {
  return 'Buka pengaturan Android';
}

export function importGuideLater(): string {
  return 'Nanti saja';
}

export function importGuideDirect(): string {
  return 'Langsung ke Akses notifikasi';
}

export function importSamplerTitle(): string {
  return 'Perekam sampel notifikasi';
}

export function importSamplerHint(): string {
  return 'Hanya di memori. Menampilkan teks mentah notifikasi dari aplikasi yang kamu aktifkan, supaya bisa kamu salin sebagai sampel nyata. Tidak ditulis ke database.';
}

export function importSamplerEmpty(): string {
  return 'Belum ada notifikasi. Nyalakan satu aplikasi di Impor otomatis, lalu pancing notifikasinya.';
}

export function importSamplerCopy(): string {
  return 'Salin';
}

export function importSamplerCopied(): string {
  return 'Tersalin';
}

export function importSamplerClear(): string {
  return 'Kosongkan';
}

export function importSamplerSystemLabel(): string {
  return 'Izinkan aplikasi sistem (khusus dev)';
}

export function importSamplerSystemHint(): string {
  return 'Untuk emulator: notifikasi dari adb datang dari aplikasi sistem. Nyalakan ini, pancing satu notifikasi, nyalakan aplikasinya di Impor otomatis, lalu pancing lagi.';
}

// ---- Backup status strip on More, and the "Buat cadangan" flow ----
export function backupStripTitle(): string {
  return 'Tersimpan hanya di ponsel ini';
}

export function backupNoneLine(): string {
  return 'Belum ada cadangan';
}

export function backupLastLine(unit: string, n: number): string {
  return `Cadangan terakhir ${unit === 'today' ? 'hari ini' : unit === 'yesterday' ? 'kemarin' : unit === 'days' ? `${n} hari lalu` : unit === 'weeks' ? `${n} minggu lalu` : unit === 'months' ? `${n} bulan lalu` : `${n} tahun lalu`}`;
}

export function backupChangedLine(count: number): string {
  return `${count} transaksi berubah sejak itu`;
}

export function backupStripLabel(title: string, line: string, changed: string): string {
  return `${title}. ${line}.${changed ? ` ${changed}.` : ''} Ketuk untuk membuka cadangan.`;
}

export function backupNowLabel(): string {
  return 'Buat cadangan sekarang';
}

export function backupSavedToast(): string {
  return 'Cadangan tersimpan.';
}

export function backupFailedToast(): string {
  return 'Cadangan gagal dibuat. Tidak ada yang berubah.';
}

export function backupShareTitle(): string {
  return 'Simpan cadangan MONO';
}
// ---- Backup screen (I1, I2, I3) ----
export function backupScreenTitle(): string { return 'Cadangan dan pemulihan'; }

export function backupBannerText(): string { return 'Data kamu hanya ada di perangkat ini. Jika ponsel hilang atau rusak, data akan hilang kecuali kamu punya berkas cadangan.'; }

export function backupLastFull(dateTime: string, fileName: string, sizeKb: string, changed: number): string { return `${dateTime} · ${fileName} · ${sizeKb} KB · ${changed} transaksi berubah`; }

export function backupNeverDone(): string { return 'Belum ada cadangan'; }

export function backupCreateNow(): string { return 'Buat cadangan sekarang'; }

export function backupCreating(): string { return 'Membuat cadangan…'; }

export function backupContentsTitle(): string { return 'Isi cadangan'; }

export function backupContentsAccounts(n: number): string { return `${n} akun`; }

export function backupContentsTransactions(n: number): string { return `${n} transaksi`; }

export function backupContentsBudgets(n: number): string { return `${n} anggaran`; }

export function backupContentsGoals(n: number): string { return `${n} target`; }

export function backupContentsCategories(n: number): string { return `${n} kategori`; }

export function backupContentsRecurring(n: number): string { return `${n} pengeluaran tetap`; }

export function backupContentsSettings(): string { return 'Pengaturan'; }

export function backupContentsFormat(): string { return 'JSON, tidak dienkripsi'; }

export function backupRestoreTitle(): string { return 'Pulihkan'; }

export function backupChooseFile(): string { return 'Pilih berkas cadangan'; }

export function backupRecentTitle(): string { return 'Cadangan terbaru'; }

export function backupRecentEmpty(): string { return 'Belum ada cadangan di perangkat ini'; }

export function backupRecentRow(fileName: string, dateTime: string, sizeKb: string): string { return `${fileName} · ${dateTime} · ${sizeKb} KB`; }

export function restoreConfirmTitle(): string { return 'Ganti semua data?'; }

export function restoreFileInfo(fileName: string, dateTime: string, sizeKb: string): string { return `${fileName} · ${dateTime} · ${sizeKb} KB`; }

export function restoreFileSchemaV(v: number): string { return `Skema v${v} · Semua pemeriksaan lolos`; }

export function restoreCompareHeader(): string { return 'Perangkat ini vs berkas cadangan'; }

export function restoreCompareAccounts(device: number, file: number): string { return `Akun: ${device} → ${file}`; }

export function restoreCompareTransactions(device: number, file: number): string { return `Transaksi: ${device} → ${file}`; }

export function restoreCompareBudgets(device: number, file: number): string { return `Anggaran: ${device} → ${file}`; }

export function restoreCompareGoals(device: number, file: number): string { return `Target: ${device} → ${file}`; }

export function restoreCompareCategories(device: number, file: number): string { return `Kategori: ${device} → ${file}`; }

export function restoreCompareRecurring(device: number, file: number): string { return `Pengeluaran tetap: ${device} → ${file}`; }

export function restoreWarning(changedAfter: number, dateTime: string): string { if (changedAfter <= 0) return 'Semua data kamu akan diganti dengan isi berkas cadangan ini. Tindakan ini tidak bisa dibatalkan.'; return `Semua data kamu akan diganti. ${changedAfter} transaksi yang ditambahkan setelah ${dateTime} akan hilang.`; }

export function restoreSafetyBackupLabel(): string { return 'Simpan cadangan pengaman dulu'; }

export function restoreConfirmTick(): string { return 'Saya mengerti data saat ini akan diganti.'; }

export function restoreReplaceButton(): string { return 'Ganti data saya'; }

export function restoreReplacing(): string { return 'Memulihkan…'; }

export function restoreSuccessToast(): string { return 'Data berhasil dipulihkan.'; }

export function restoreFailedToast(): string { return 'Pemulihan gagal. Data tidak berubah.'; }

export function restoreSafetyFailedToast(): string { return 'Gagal menyimpan cadangan pengaman. Data tidak berubah.'; }

export function restoreInvalidTitle(): string { return 'Berkas ini tidak bisa dipulihkan'; }

export function restoreInvalidLead(fileName: string): string { return `${fileName} tidak lolos pemeriksaan. Data di perangkat ini tidak berubah.`; }

export function restoreCheckJson(): string { return 'Bisa dibaca sebagai JSON'; }

export function restoreCheckMarker(): string { return 'Bertanda cadangan MONO'; }

export function restoreCheckVersion(fileV: number, supportedV: number): string { return `Versi skema ${fileV} (aplikasi ini membaca hingga v${supportedV})`; }

export function restoreCheckCounts(): string { return 'Total baris sesuai'; }

export function restoreCheckChecksum(): string { return 'Checksum sesuai'; }

export function restoreCheckRefs(): string { return 'Referensi internal konsisten'; }

export function restoreChooseAnother(): string { return 'Pilih berkas lain'; }

export function restorePickError(): string { return 'Berkas tidak bisa dibuka. Coba berkas lain.'; }


export function currencyName(code: string): string {
  return CURRENCY_NAMES_ID[code] ?? code;
}

export function ratesTitle(): string {
  return 'Kurs';
}

export function ratesAutoTitle(): string {
  return 'Perbarui otomatis';
}

export function ratesAutoHelp(): string {
  return 'Sehari sekali saat MONO terbuka dan online. Nyala secara default.';
}

export function ratesAutoSwitchLabel(on: boolean): string {
  return on ? 'Perbarui otomatis, nyala' : 'Perbarui otomatis, mati';
}

export function ratesUpdateNow(): string {
  return 'Perbarui kurs sekarang';
}

export function ratesUpdating(): string {
  return 'Memperbarui kurs…';
}

export function ratesLastUpdated(dateTime: string): string {
  return `Terakhir diperbarui ${dateTime}`;
}

export function ratesNeverUpdated(): string {
  return 'Belum pernah diperbarui';
}

export function ratesInUseHeader(): string {
  return 'Kurs yang dipakai';
}

export function ratesSourceApi(): string {
  return 'Exchange Rate API';
}

export function ratesSourceManual(): string {
  return 'Kamu ketik sendiri';
}

export function ratesRowSub(source: string, dateTime: string): string {
  return `${source} · ${dateTime}`;
}

export function ratesRowNoRate(): string {
  return 'Belum ada kurs';
}

export function ratesRowSetRate(): string {
  return 'Atur kurs';
}

export function ratesRowPer(rate: string, symbol: string): string {
  return `${rate} per ${symbol}1`;
}

export function ratesRowLabel(code: string, name: string, detail: string): string {
  return `${code}, ${name}, ${detail}. Ketuk untuk mengetik kurs sendiri.`;
}

export function ratesNoCurrencies(): string {
  return 'Belum ada mata uang. Tambahkan mata uang ke akun Valas, lalu kursnya muncul di sini.';
}

export function ratesFailTitle(): string {
  return 'Kurs tidak bisa diperbarui.';
}

export function ratesFailOffline(dateTime: string | null): string {
  return dateTime ? `Tidak ada internet. MONO tetap memakai kurs ${dateTime}. Tidak ada yang berubah atau hilang.` : 'Tidak ada internet. Belum ada kurs tersimpan; ketik sendiri kursnya.';
}

export function ratesFailLimited(minutes: number): string {
  return `Layanan kurs meminta kita menunggu. Coba lagi nanti; tombolnya aktif lagi dalam ${minutes} menit. Kurs yang tersimpan tidak berubah.`;
}

export function ratesFailInvalid(): string {
  return 'Layanan kurs mengirim jawaban yang tidak bisa dipakai. MONO tetap memakai kurs yang tersimpan.';
}

export function ratesCooldown(minutes: number): string {
  return `Kurs baru saja diperbarui. Coba lagi dalam ${minutes} menit.`;
}

export function ratesNoPockets(): string {
  return 'Belum ada mata uang yang dipegang, jadi tidak ada kurs yang perlu diambil.';
}

export function ratesUpdatedToast(): string {
  return 'Kurs diperbarui';
}

export function ratesHowHeader(): string {
  return 'Cara kurs dipakai';
}

export function ratesHowBody(): string {
  return 'Total akun dan kekayaan bersih menilai tiap kantong dengan kurs di atas, ditandai ≈. Tiap transaksi menyimpan nilai rupiah pada hari dicatat, jadi anggaran dan laporan tidak berubah saat kurs berubah.';
}

export function ratesPrivacy(): string {
  return 'Yang dikirim ke layanan hanya satu permintaan tanpa isi. Catatan, saldo, dan nama akunmu tidak pernah ikut.';
}

export function ratesAttribution(): string {
  return 'Kurs oleh Exchange Rate API';
}

export function ratesManualTitle(code: string): string {
  return `Kurs ${code} sendiri`;
}

export function ratesManualSubtitle(name: string): string {
  return `${name}. Dipakai sampai pembaruan berikutnya.`;
}

export function ratesManualLabel(symbol: string): string {
  return `Rupiah per ${symbol}1`;
}

export function ratesManualInvalid(): string {
  return 'Isi kurs rupiah yang masuk akal, misalnya 16.250 atau 16.250,5.';
}

export function ratesManualSave(): string {
  return 'Simpan kurs';
}

export function ratesManualSaved(code: string): string {
  return `Kurs ${code} disimpan`;
}

export function ratesCloseLabel(): string {
  return 'Tutup';
}

export function setRateFirst(code: string): string {
  return `Belum ada kurs untuk ${code}. Atur kurs dulu.`;
}

export function setRateButton(): string {
  return 'Atur kurs';
}

export function valasFormTitleNew(): string {
  return 'Akun Valas baru';
}

export function valasFormTitleEdit(): string {
  return 'Ubah akun Valas';
}

export function valasTypeTile(): string {
  return 'Valas · mata uang asing';
}

export function valasExistsHint(): string {
  return 'Kamu sudah punya akun Valas. Tambahkan mata uangnya di akun itu.';
}

export function valasNameLabel(): string {
  return 'Nama akun';
}

export function valasNamePlaceholder(): string {
  return 'Valas';
}

export function valasCurrenciesLabel(): string {
  return 'Mata uang';
}

export function valasCurrencyNone(): string {
  return 'Belum ada mata uang. Tambahkan minimal satu.';
}

export function valasOpeningLabel(code: string): string {
  return `Saldo awal ${code}`;
}

export function valasRemoveCurrency(code: string): string {
  return `Hapus ${code} dari daftar`;
}

export function valasAddCurrency(): string {
  return 'Tambah mata uang';
}

export function valasOpeningDateLabel(date: string): string {
  return `Saldo awal per ${date}`;
}

export function valasOpeningHelp(): string {
  return 'Saldo awal tiap mata uang dihitung pada tanggal ini. Akun Valas sendiri tidak punya saldo awal.';
}

export function valasCreateButton(): string {
  return 'Buat akun';
}

export function valasSaveButton(): string {
  return 'Simpan';
}

export function valasSavingLabel(): string {
  return 'Menyimpan…';
}

export function valasCreatedToast(name: string): string {
  return `Akun ${name} dibuat`;
}

export function valasSavedToast(): string {
  return 'Perubahan disimpan';
}

export function valasPocketArchivedToast(code: string): string {
  return `Kantong ${code} diarsipkan`;
}

export function valasPocketAddedToast(code: string): string {
  return `Kantong ${code} ditambahkan`;
}

export function valasAmountInvalid(): string {
  return 'Isi saldo awal dengan angka, misalnya 250,00.';
}

export function valasPocketsNeedAmount(): string {
  return 'Periksa saldo awal yang ditandai.';
}

export function valasForexError(code: string): string {
  switch (code) {
    case 'name_invalid':
      return 'Nama akun wajib diisi, maksimal 40 huruf.';
    case 'no_pockets':
      return 'Tambahkan minimal satu mata uang.';
    case 'duplicate_currency':
      return 'Mata uang itu sudah ada di akun Valas.';
    case 'unsupported_currency':
      return 'Mata uang itu belum didukung.';
    case 'amount_invalid':
      return 'Saldo awal tidak valid.';
    case 'not_forex_account':
      return 'Ini bukan akun Valas.';
    default:
      return 'Tidak bisa menyimpan. Tidak ada yang berubah.';
  }
}

export function valasAddSheetTitle(): string {
  return 'Tambah mata uang';
}

export function valasAddSheetSubtitle(): string {
  return 'Pilih mata uang yang mau kamu simpan.';
}

export function valasSearchPlaceholder(): string {
  return 'Cari mata uang';
}

export function valasAlreadyAdded(): string {
  return 'Sudah ditambahkan';
}

export function valasSearchEmpty(): string {
  return 'Tidak ada mata uang yang cocok.';
}

export function valasNeedRateNote(): string {
  return 'Kurs dibutuhkan untuk menampilkan nilai rupiah. Perbarui kurs di layar Kurs, atau ketik sendiri di sana.';
}

export function valasCurrencyRowLabel(code: string, name: string, added: boolean): string {
  return added ? `${code}, ${name}, sudah ditambahkan` : `${code}, ${name}`;
}

export function valasDetailCaption(): string {
  return 'Akun multi-mata uang · nilai hari ini';
}

export function valasDetailApproxNote(dateTime: string): string {
  return `Perkiraan dari kurs ${dateTime}.`;
}

export function valasDetailIncomplete(): string {
  return 'Nilai rupiah belum lengkap: ada mata uang yang belum punya kurs.';
}

export function valasNoPocketsTotal(): string {
  return 'Belum ada mata uang';
}

export function valasPocketsHeader(): string {
  return 'Kantong mata uang';
}

export function valasPocketsEmpty(): string {
  return 'Belum ada kantong mata uang. Tambahkan satu.';
}

export function valasPocketLabel(code: string, name: string, amount: string, detail: string): string {
  return `${code}, ${name}, ${amount}, ${detail}`;
}

export function valasPocketArchive(code: string): string {
  return `Arsipkan ${code}`;
}

export function valasPocketArchiveBlocked(code: string): string {
  return `Kantong ${code} masih berisi uang. Kosongkan dulu sebelum diarsipkan.`;
}

export function valasButtonAdd(): string {
  return 'Tambah';
}

export function valasButtonExchange(): string {
  return 'Tukar';
}

export function valasActivityTitle(month: string): string {
  return `Aktivitas ${month}`;
}

export function valasFilterAll(): string {
  return 'Semua';
}

export function valasActivityEmpty(): string {
  return 'Belum ada aktivitas bulan ini.';
}

export function valasActivityFilterEmpty(code: string): string {
  return `Tidak ada aktivitas ${code} bulan ini.`;
}

export function valasRatesLink(dateTime: string | null): string {
  return dateTime ? `Kurs · ${dateTime}` : 'Kurs';
}

export function valasFrozenNote(): string {
  return 'Setiap transaksi menyimpan nilai rupiah pada hari dicatat, jadi anggaran dan laporan tidak berubah saat kurs berubah.';
}

export function valasViewAll(): string {
  return 'Lihat semua transaksi akun ini';
}

export function valasActivityRowLabel(title: string, kind: string, date: string, amount: string, value: string): string {
  return `${title}, ${kind}, ${date}, ${amount}${value}`;
}

export function valasActivityValue(value: string): string {
  return `, senilai ${value}`;
}

export function valasFieldError(code: string): string {
  switch (code) {
    case 'name_invalid':
      return 'Nama akun wajib diisi, maksimal 40 huruf.';
    case 'name_taken':
      return 'Kamu sudah punya akun dengan nama ini.';
    case 'no_pockets':
      return 'Tambahkan minimal satu mata uang.';
    case 'amount_invalid':
      return 'Isi saldo awal dengan angka, misalnya 250,00.';
    case 'future_date':
      return 'Tanggalnya tidak boleh di masa depan.';
    default:
      return 'Periksa isian ini.';
  }
}

export function valasPocketBalanceLabel(code: string, amount: string): string {
  return `Saldo ${code} sekarang ${amount}`;
}

export function valasPocketsEditHeader(): string {
  return 'Kantong yang ada';
}

export function valasArchiveHelp(): string {
  return 'Kantong hanya bisa diarsipkan saat saldonya tepat 0. Mata uang yang diarsipkan bisa ditambahkan lagi nanti.';
}

export function valasPocketFieldLabel(): string {
  return 'Mata uang';
}

export function valasPocketChipLabel(code: string, name: string, balance: string): string {
  return `${code}, ${name}, saldo ${balance}`;
}

export function valasAmountTitle(code: string): string {
  return `Jumlah dalam ${code}`;
}

export function valasAmountToMoveTitle(code: string): string {
  return `Jumlah yang dipindah (${code})`;
}

export function valasAmountAccessibility(code: string): string {
  return `Jumlah dalam ${code}`;
}

export function valasLiveValue(value: string, ratePer: string): string {
  return `≈ ${value} · ${ratePer}`;
}

export function valasBalanceAfter(amount: string): string {
  return `Saldo setelahnya: ${amount}`;
}

export function valasBudgetNote(category: string, value: string): string {
  return `Dihitung ke anggaran ${category} sebesar sekitar ${value}, nilai pada hari dicatat. Nilainya tetap walau kurs berubah.`;
}

export function valasYouSend(): string {
  return 'Kamu kirim';
}

export function valasYouReceive(): string {
  return 'Kamu terima';
}

export function valasExchangeTitle(): string {
  return 'Tukar mata uang';
}

export function valasExchangeRateYours(): string {
  return 'Kurs kamu';
}

export function valasExchangeRateLatest(): string {
  return 'Kurs tersimpan terbaru';
}

export function valasExchangeDifference(): string {
  return 'Selisih';
}

export function valasExchangeNoLatest(): string {
  return 'Belum ada kurs untuk dibandingkan.';
}

export function valasExchangeNote(): string {
  return 'MONO menyimpan kedua jumlah dan menghitung kurs sendiri. Kekayaan bersih hanya bergerak sebesar selisih itu.';
}

export function valasCrossRate(from: string, perUnit: string, to: string): string {
  return `1 ${from} = ${perUnit} ${to}`;
}

export function valasDifferenceText(percent: string, amount: string): string {
  return `${percent} (${amount})`;
}

export function valasEnterBoth(): string {
  return 'Isi jumlah kirim dan terima untuk melihat kurs.';
}

export function valasGoToRates(): string {
  return 'Atur kurs';
}

export function txValasFieldError(error: { code: string; currency?: string; balance?: number; shortfall?: number; type?: string }, moneyFormat: (n: number) => string): TxErrorMessage {
  const code = error.currency ?? '';
  switch (error.code) {
    case 'pocket_required':
      return { text: 'Pilih mata uang yang dipakai.' };
    case 'missing_fx_rate':
    case 'missing_rate':
      return { text: `Belum ada kurs untuk ${code}. Atur kurs dulu.`, linkText: 'Atur kurs' };
    case 'amount_to_required':
      return { text: 'Isi jumlah yang kamu terima.' };
    case 'same_pocket':
      return { text: 'Pilih dua mata uang yang berbeda.' };
    case 'insufficient_balance': {
      const has = moneyFormat(error.balance ?? 0);
      const wanted = moneyFormat((error.balance ?? 0) + (error.shortfall ?? 0));
      const short = moneyFormat(error.shortfall ?? 0);
      const what = error.type === 'transfer' ? 'Penukaran' : 'Pengeluaran';
      return { text: `Kantong ${code} hanya punya ${has}. ${what} ini ${wanted}. Kurang ${short}.` };
    }
    default:
      return { text: 'Periksa isian ini.' };
  }
}

export function valasSheetMeta(value: string): string {
  return `≈ ${value} · pilih mata uangnya setelah ini`;
}

export function valasPocketFromLabel(): string {
  return 'Mata uang yang dikirim';
}

export function valasPocketToLabel(): string {
  return 'Mata uang yang diterima';
}

export function settingsRatesRowHint(): string {
  return 'Kurs untuk menilai uang asing di akun Valas. Pembaruan otomatis nyala secara default.';
}

// Categories (list, edit form, archive, archived list): CLAUDE.md rule 21.
export const catListAdd = () => `Tambah kategori`;
export const catListExpenseHeader = (count: number) => `Pengeluaran, ${count}`;
export const catListIncomeHeader = (count: number) => `Pemasukan, ${count}`;
export const catListSystemHeader = () => `Sistem, tidak bisa diubah`;
export const catListTransferName = () => `Transfer`;
export const catListTransferSub = () => `Bukan pemasukan, bukan pengeluaran`;
export const catListBudgetTag = () => `Ada anggaran`;
export const catListRowLabel = (name: string) => `${name}, ketuk untuk mengubah`;
export const catListRowLabelWithBudget = (name: string) => `${name}, ada anggaran, ketuk untuk mengubah`;
export const catListArchivedRow = (count: number) => `Diarsipkan, ${count}`;
export const catListLoadError = () => `Kategori tidak bisa dimuat.`;
export const catFormNewTitle = () => `Kategori baru`;
export const catFormEditTitle = () => `Ubah kategori`;
export const catFormKindLabel = () => `Jenis`;
export const catFormKindExpense = () => `Pengeluaran`;
export const catFormKindIncome = () => `Pemasukan`;
export const catFormKindLockedNote = (count: number) => `Jenis tidak bisa diubah karena sudah dipakai di ${count} transaksi.`;
export const catFormKindLockedOther = () => `Jenis tidak bisa diubah karena sudah dipakai anggaran atau pengeluaran tetap.`;
export const catFormKindLockedLabel = (kindLabel: string) => `${kindLabel}, terkunci`;
export const catFormNameLabel = () => `Nama`;
export const catFormNamePlaceholder = () => `Contoh: Kopi`;
export const catFormNameCount = (count: number, max: number) => `${count}/${max}`;
export const catFormRenameNote = () => `Mengganti nama memperbarui transaksi lama dan laporan.`;
export const catFormIconLabel = () => `Ikon`;
export const catFormIconSelected = (name: string) => `${name}, dipilih`;
export const catFormPreviewFallback = () => `Nama kategori`;
export const catFormPreviewSub = () => `Pratinjau di daftar dan pilihan`;
export const catFormUsageTitle = () => `Pemakaian`;
export const catFormUsageTransactions = () => `Transaksi`;
export const catFormUsageLastUsed = () => `Terakhir dipakai`;
export const catFormUsageNever = () => `Belum pernah`;
export const catFormUsageBudget = () => `Anggaran bulan ini`;
export const catFormUsageBudgetYes = () => `Ada`;
export const catFormUsageBudgetNo = () => `Tidak ada`;
export const catFormArchiveButton = () => `Arsipkan kategori`;
export const catFormSave = () => `Simpan kategori`;
export const catFormLoadError = () => `Kategori ini tidak bisa dimuat.`;
export const catArchiveTitle = (name: string) => `Arsipkan ${name}?`;
export const catArchiveBody = (count: number) => `Kategori ini tidak muncul lagi di pilihan transaksi baru. ${count} transaksi lama dan laporan tetap utuh. Anggaran bulan ini ikut tersimpan, tapi tidak dibuat lagi bulan depan.`;
export const catArchiveRestoreHint = () => `Kamu bisa memulihkannya kapan saja dari Kategori → Diarsipkan.`;
export const catArchiveConfirm = () => `Arsipkan`;
export const catArchiveBlockedTitle = () => `Belum bisa diarsipkan`;
export const catArchiveBlockedOk = () => `Mengerti`;
export const catDiscardTitle = () => `Buang perubahan?`;
export const catDiscardBody = () => `Perubahan di kategori ini belum tersimpan.`;
export const catDiscardConfirm = () => `Buang`;
export const catDiscardKeep = () => `Lanjut mengubah`;
export const catSavedToast = () => `Kategori tersimpan.`;
export const catArchivedToast = () => `Kategori diarsipkan.`;
export const catRestoredToast = () => `Kategori dipulihkan.`;
export const catErrorNameEmpty = () => `Isi nama kategorinya.`;
export const catErrorNameTooLong = (max: number) => `Maksimal ${max} karakter.`;
export const catErrorNameTaken = (kindLabel: string) => `Nama ini sudah dipakai di ${kindLabel}. Pakai nama lain.`;
export const catErrorNameTakenArchived = () => `Nama ini dipakai kategori yang diarsipkan. Pulihkan dulu atau pakai nama lain.`;
export const catErrorLastActive = (kindWord: string) => `Harus ada minimal satu kategori ${kindWord} aktif. Tambah kategori lain dulu, lalu arsipkan yang ini.`;
export const catErrorUsedByRecurring = (name: string) => `Dipakai pengeluaran tetap ${name}. Ganti kategorinya dulu.`;
export const catErrorKindLocked = () => `Jenis tidak bisa diubah karena kategori ini sudah dipakai.`;
export const catErrorNotFound = () => `Kategori ini sudah tidak ada.`;
export const catKindWordExpense = () => `pengeluaran`;
export const catKindWordIncome = () => `pemasukan`;
export const catArchivedTitle = () => `Diarsipkan`;
export const catArchivedIntro = () => `Kategori yang diarsipkan tidak muncul di pilihan baru. Transaksi lama dan laporan tetap memakainya.`;
export const catArchivedRowSub = (count: number, lastUsed: string) => `${count} transaksi · ${lastUsed}`;
export const catArchivedRowSubNone = (count: number) => `${count} transaksi`;
export const catArchivedRestore = () => `Pulihkan`;
export const catArchivedRestoreLabel = (name: string) => `Pulihkan ${name}`;
export const catArchivedFootnote = () => `Kategori tidak pernah dihapus, hanya diarsipkan, supaya riwayatmu tidak berubah.`;
export const catIconName = (key: string): string => {
  switch (key) {
    case 'food':
      return 'Makan';
    case 'coffee':
      return 'Kopi';
    case 'car':
      return 'Mobil';
    case 'plane':
      return 'Pesawat';
    case 'bag':
      return 'Belanja';
    case 'shirt':
      return 'Baju';
    case 'bolt':
      return 'Listrik';
    case 'phone':
      return 'Ponsel';
    case 'heart':
      return 'Hati';
    case 'medical':
      return 'Kesehatan';
    case 'film':
      return 'Film';
    case 'home':
      return 'Rumah';
    case 'book':
      return 'Buku';
    case 'education':
      return 'Pendidikan';
    case 'gift':
      return 'Hadiah';
    case 'paw':
      return 'Hewan';
    case 'briefcase':
      return 'Kerja';
    case 'wallet':
      return 'Dompet';
    case 'tag':
      return 'Label';
    case 'dot':
      return 'Titik';
    default:
      return 'Titik';
  }
};
