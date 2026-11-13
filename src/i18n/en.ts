// English strings: the same exports as id.ts (the Indonesian ones), one function per sentence.
// Everything before the AI chat block is English in both files; from there on this file holds the
// English wording. A test (src/i18n/__tests__/parity.test.ts) keeps the two files' exports identical.
// Every user-facing string lives here (CLAUDE.md working agreement: one module, so a
// second language stays possible later). This file currently only has the 13 guard-code
// messages — the rest of the app's copy is written screen by screen, later phases.
import type { AccountType } from '../data/repo/accounts';
import type { TxSource } from '../data/repo/transactions';
import type { GuardCode } from '../domain/errors';
import { CURRENCY_NAMES_EN } from '../core/currencyList';

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
  forex_account_exists: () => 'A Valas account already exists. Add the currency to that account.',
};

export function guardMessage(code: GuardCode, ctx: GuardMessageContext = {}): string {
  return guardMessages[code](ctx);
}

export const recurringTitle = () => 'Fixed expenses';
export const recurringIntro = () => 'Scheduled recurring costs. Nothing is recorded until you confirm.';
export const recurringEmpty = () => 'No fixed expenses yet. Add a gym, internet, or subscription.';
export const recurringAdd = () => 'Add fixed expense';
export const recurringMonthly = () => 'Per month, estimated';
export const recurringDueToday = () => 'Due today';
export const recurringNeedsConfirmation = () => 'Needs confirmation';
export const recurringComingUp = () => 'Coming up';
export const recurringRecordNow = () => 'Record now';
export const recurringSkip = () => 'Skip this month';
export const recurringVaries = () => 'Amount varies';
export const recurringAbout = (amount: string) => `about ${amount}`;
export const recurringDay = (day: number) => `every month on the ${day}`;
export const recurringToday = () => 'Due today';
export const recurringOverdue = (days: number) => `${days} days overdue`;
export const recurringReminderNote = () => 'Reminders are sent a day before and on the due date. Missed months wait here, oldest first.';
export const recurringNewTitle = () => 'New fixed expense';
export const recurringEditTitle = () => 'Edit fixed expense';
export const recurringName = () => 'Name';
export const recurringNameHint = () => 'Example: Gym membership';
export const recurringAmount = () => 'Amount';
export const recurringAmountVaries = () => 'Amount varies each month';
export const recurringAmountVariesHint = () => 'Turn this on for bills like electricity. The amount above becomes an estimate and you enter the actual amount when confirming.';
export const recurringCategory = () => 'Category';
export const recurringPayFrom = () => 'Pay from';
export const recurringRepeats = () => 'Repeats';
export const recurringFirstDue = () => 'First due date';
export const recurringEnds = () => 'Ends';
export const recurringNoEnd = () => 'No end date';
export const recurringClampHint = () => 'Days 29 to 31 fall on the last day of shorter months.';
export const recurringRemind = () => 'Remind me';
export const recurringRemindHint = () => 'Notification at 09:00, a day before and on the due date';
export const recurringStop = () => 'Stop fixed expense';
export const recurringStopTitle = (name: string) => `Stop ${name}?`;
export const recurringStopBody = () => 'Recorded transactions remain.';
export const recurringSave = () => 'Save';
export const recurringNameRequired = () => 'Enter a fixed expense name.';
export const recurringAmountRequired = () => 'Enter an amount above Rp0.';
export const recurringAccountRequired = () => 'Choose the paying account.';
export const recurringEndInvalid = () => 'The end date cannot be before the first due date.';
export const recurringConfirmTitle = (name: string) => `Record ${name}?`;
export const recurringConfirmDue = (date: string) => `Due today, ${date} · repeats monthly`;
export const recurringUsualAmount = () => 'Usual amount. Change it if this month differs.';
export const recurringDate = () => 'Date';
export const recurringAfter = (account: string, amount: string) => `${account} after ${amount}`;
export const recurringRecord = () => 'Record expense';
export const recurringRemindTomorrow = () => 'Remind me tomorrow';
export const recurringSkipNote = (date: string) => `Skipping records nothing. The next due date is ${date}.`;
export const recurringSavedToast = (account: string, amount: string) => `Expense saved. ${account} is now ${amount}.`;

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
  return 'Incomplete: some currencies are missing exchange rates.';
}

export function accountsNoLoginNote(): string {
  return 'A balance is the opening balance plus every recorded movement. Accounts are labels you keep on this device. MONO never asks for bank logins or links to a bank.';
}

// The card stack's total card (Fase 4.2c), when a forex account has a rate (so the total
// is an estimate, not a warning) — distinct from accountsIncompleteNote above, which is
// for when a pocket has NO rate at all and the total is genuinely missing data.
export function accountsForexEstimateNote(dateTimeFormatted: string): string {
  return `Foreign currency uses your latest rates (${dateTimeFormatted}), so the total is an estimate.`;
}

export function exchangeRatesLabel(): string {
  return 'Exchange rates';
}

export function exchangeRatesUpdatedLabel(dateTimeFormatted: string): string {
  return `updated ${dateTimeFormatted}`;
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

export function goalChooseMonthTitle(): string { return 'Choose month'; }
export function goalChooseMonthSubtitle(): string { return 'Choose target month'; }

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

// The line on Overview: by the time of day, or "How are you, Nael?" once the app was opened several
// times that day.
export function welcomeGreeting(nickname: string | null, kind: GreetingKind): string {
  const words: Record<GreetingKind, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    late_afternoon: 'Good afternoon',
    evening: 'Good evening',
    checkin: 'How are you',
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
  return 'Fixed expenses';
}

export function reviewAndRecordLabel(): string {
  return 'Review and record';
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
  return 'Due today';
}

export function noDueExpensesMessage(): string {
  return 'Nothing is due.';
}

export function recurringAllLabel(): string { return 'All'; }
export function recurringOverdueOverview(days: number): string { return `${days} days overdue`; }
export function recurringNextOverview(name: string, date: string): string { return `Next: ${name} · ${date}`; }
export function recurringOthersWaiting(count: number): string { return `+ ${count} more waiting`; }
export function recurringReviewAndRecord(): string { return 'Review and record'; }

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
  return 'Achieved';
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
  scan: 'Receipt scan',
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
  return 'Scan a receipt';
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
  return 'Record by chat';
}

export function aiSetupBadge(): string {
  return 'OPTIONAL FEATURE';
}

export function aiSetupDescription(): string {
  return 'Type "coffee 25k with GoPay" and the AI prepares the transaction as a draft. You check it, then save. This feature stays off until you enter your own Gemini API key.';
}

export function aiSetupSentToGemini(): string {
  return 'SENT TO GEMINI';
}

export function aiSetupNotSent(): string {
  return 'NOT SENT';
}

export function aiSetupSentItem1(): string {
  return 'The message you type';
}

export function aiSetupSentItem2(): string {
  return 'Account and category names, so drafts match your data';
}

export function aiSetupSentItem3(): string {
  return "Today's date";
}

export function aiSetupNotSentItem1(): string {
  return 'Balances, transaction history, budgets and goals';
}

export function aiSetupNotSentItem2(): string {
  return 'Backup files';
}

export function aiSetupApiKeyLabel(): string {
  return 'GEMINI API KEY';
}

export function aiSetupWhatsThisLabel(): string {
  return 'What key?';
}

export function aiSetupPasteButton(): string {
  return 'Paste';
}

export function aiSetupKeyNote(): string {
  return 'Created in Google AI Studio. Stored only on this phone (Android Keystore). MONO has no server that receives it.';
}

export function aiSetupBillingWarning(): string {
  return 'Your messages are processed through your API key. Usage follows that key\'s quota or billing. This feature needs the internet; the rest of MONO stays offline.';
}

export function aiSetupSaveAndTest(): string {
  return 'Save and test key';
}

export function aiSetupLaterButton(): string {
  return 'Not now';
}

export function aiSetupTestNote(): string {
  return 'The test sends one short message. No financial data is in it.';
}

export function aiChatGreeting(): string {
  return 'Hi! Type your transaction, for example "coffee 25k with GoPay".';
}

export function aiChatFooterWarning(): string {
  return 'AI can be wrong. Always check the draft before saving.';
}

export function aiChatInputPlaceholder(): string {
  return 'Type a transaction…';
}

export function aiDraftSaveButton(): string {
  return 'Save';
}

export function aiDraftEditButton(): string {
  return 'Edit';
}

export function aiDraftCancelButton(): string {
  return 'Cancel';
}

export function aiDraftExpenseKind(): string {
  return 'EXPENSE';
}

export function aiDraftIncomeKind(): string {
  return 'INCOME';
}

export function aiDraftTransferKind(): string {
  return 'TRANSFER';
}

// ---------------------------------------------------------------- AI chat: fixed sentences
// Every sentence the person reads in the chat is written here, by the app. The model never
// supplies one (CLAUDE.md rule 9). src/features/ai_chat/messages.ts assembles them.
export function aiMsgOutOfScope(): string {
  return 'I can only record transactions. Try typing something like “coffee 25k with gopay”.';
}

export function aiMsgDataLookup(): string {
  return "I don't read your balances, I only record. Balances are in the Accounts tab.";
}

export function aiMsgOpenAccounts(): string {
  return 'Open Accounts';
}

export function aiMsgExamples(): string[] {
  return ['Coffee 25k with gopay', 'Transfer 500k BCA to Jago'];
}

export function aiMsgAskAccountAndCategory(): string {
  return 'Which account, and what for? One tap is enough.';
}

export function aiMsgAskAccount(): string {
  return 'Which account?';
}

export function aiMsgAskCategory(): string {
  return 'What for?';
}

export function aiMsgAskAmount(): string {
  return 'How much was it?';
}

export function aiMsgAskToAccount(): string {
  return 'Move it to which account?';
}

export function aiMsgAskType(): string {
  return 'Is this an expense, an income, or a transfer?';
}

export function aiMsgUnknownTransferTarget(name: string): string {
  return `I couldn't find an account named “${name}”. Transfers only work between your own accounts. Record it as an expense instead?`;
}

export function aiMsgRecordAsExpense(): string {
  return 'Record as expense';
}

export function aiMsgCheckAmount(typedText: string | null, typedFormatted: string | null, draftFormatted: string): string {
  if (typedText == null || typedFormatted == null) {
    return `Check the amount. The draft says ${draftFormatted}, but that number doesn't match your message.`;
  }
  return `Check the amount. You typed “${typedText}” (${typedFormatted}), the draft says ${draftFormatted}.`;
}

export function aiMsgUseAmount(formatted: string): string {
  return `Use ${formatted}`;
}

export function aiMsgDraftsReady(count: number): string {
  return count > 1 ? `I found ${count} transactions. Take a look.` : "Okay, here's the draft. Nothing is saved yet.";
}

export function aiMsgBlockedLead(): string {
  return "The draft was made, but it can't be saved.";
}

export function aiMsgBlockedShortfall(shortfallFormatted: string): string {
  return `Short by ${shortfallFormatted}. Change the account, lower the amount, or move money in first.`;
}

export function aiMsgBlockedReason(code: string): string {
  switch (code) {
    case 'future_date':
      return "That date hasn't happened yet. Change the date.";
    case 'before_opening_date':
      return "This account didn't exist yet on that date. Change the account or the date.";
    case 'same_account':
      return 'The source and destination are the same account. Pick two different accounts.';
    case 'category_kind_mismatch':
      return "The category doesn't match the transaction type. Pick another category.";
    case 'forex_not_supported':
      return "Valas accounts aren't supported in the chat yet. Pick a rupiah account.";
    default:
      return 'Something needs fixing. Tap Edit to check it.';
  }
}

export function aiMsgChangeAccount(): string {
  return 'Change account';
}

export function aiMsgChangeAmount(): string {
  return 'Change amount';
}

export interface AiMsgBlock {
  title: string;
  detail: string;
}

export function aiMsgError(code: string): AiMsgBlock {
  switch (code) {
    case 'no_internet':
      return { title: 'No internet.', detail: 'The chat needs a connection. You can still record manually.' };
    case 'key_rejected':
      return { title: 'Gemini key rejected.', detail: 'Check the key in Settings. No transaction was created.' };
    case 'quota':
      return { title: 'Key quota used up.', detail: 'Try again later, or record manually. Your message is still in the box.' };
    case 'unreadable':
      return { title: "Couldn't read the reply.", detail: 'The AI sent an answer that could not be used. Try a shorter sentence. Nothing was saved.' };
    case 'timeout':
      return { title: 'Took too long.', detail: 'Nothing changed. Try again, or record manually. Your message is still in the box.' };
    case 'too_long':
      return { title: 'Message too long.', detail: 'At most 500 characters. Shorten it first. Nothing changed.' };
    case 'empty':
      return { title: 'The message is empty.', detail: 'Type the transaction first.' };
    case 'busy':
      return { title: 'The last message is still being processed.', detail: 'Wait a moment. Nothing changed.' };
    default:
      return { title: "Couldn't process that.", detail: 'Nothing changed.' };
  }
}

export function aiMsgErrorManualAction(): string {
  return 'Record manually';
}

export function aiMsgErrorSettingsAction(): string {
  return 'Open AI settings';
}

export function aiMsgSaved(kind: 'income' | 'expense' | 'transfer', accountName: string, balanceFormatted: string, toAccountName?: string, toBalanceFormatted?: string): string {
  if (kind === 'transfer' && toAccountName && toBalanceFormatted) {
    return `Transfer saved. ${accountName} is now ${balanceFormatted}, ${toAccountName} ${toBalanceFormatted}.`;
  }
  const label = kind === 'income' ? 'Income' : kind === 'transfer' ? 'Transfer' : 'Expense';
  return `${label} saved. ${accountName} is now ${balanceFormatted}.`;
}

export function aiMsgSavedMany(count: number): string {
  return `${count} transactions saved.`;
}

export function aiMsgNotReady(): string {
  return 'Some drafts are not ready to save. Complete them first. Nothing was saved.';
}

// ---------------------------------------------------------------- AI chat: screens (AI-2)
// Setup (K1), chat (K2), states (K3) and edit one by one (K4). The sentences the assistant
// "says" are in the aiMsg* block above; these are the screens' own labels.
export function aiBackLabel(): string {
  return 'Back';
}

export function aiCloseLabel(): string {
  return 'Close';
}

export function aiUndoLabel(): string {
  return 'Undo';
}

export function aiRetryLabel(): string {
  return 'Try again';
}

export function aiSetupRejectedHelpLabel(): string {
  return 'Key rejected?';
}

export function aiSetupRejectedHelp(): string {
  return 'Create a new key in Google AI Studio, copy it whole without spaces, then paste it here. Make sure the key is active and its quota is not used up.';
}

export function aiSetupGetKeyLink(): string {
  return "Don't have a key? Create one in Google AI Studio";
}

export function aiSetupGetKeyLinkLabel(): string {
  return 'Open Google AI Studio in the browser to create an API key';
}

export function aiSetupShowKeyLabel(): string {
  return 'Show key';
}

export function aiSetupHideKeyLabel(): string {
  return 'Hide key';
}

export function aiSetupTesting(): string {
  return 'Testing key…';
}

export function aiSetupKeySavedTitle(): string {
  return 'Key saved';
}

export function aiSetupKeySavedHint(): string {
  return 'The key is only on this phone. To replace it, paste a new key below.';
}

export function aiSetupReplaceKeyLabel(): string {
  return 'REPLACE KEY';
}

export function aiSettingsSwitchLabel(): string {
  return 'Record by chat (AI)';
}

export function aiSettingsSwitchNeedsKeyHint(): string {
  return 'Save and test a key first.';
}

export function aiSettingsKeyRowLabel(): string {
  return 'Gemini API key';
}

export function aiSettingsKeyRowValue(hasKey: boolean): string {
  return hasKey ? 'Saved' : 'None';
}

export function aiDeleteKeyLabel(): string {
  return 'Delete key';
}

export function aiDeleteKeyTitle(): string {
  return 'Delete the key?';
}

export function aiDeleteKeyMessage(): string {
  return 'The key is removed from this phone and Record by chat is turned off. Transactions you already saved do not change.';
}

export function aiDeleteKeyConfirm(): string {
  return 'Delete';
}

export function aiKeyDeletedToast(): string {
  return 'Key deleted.';
}

export function aiChatHeaderHint(): string {
  return 'Drafts only';
}

export function aiChatManualButton(): string {
  return 'Record manually';
}

export function aiChatSettingsLabel(): string {
  return 'AI settings';
}

export function aiChatOpening(name: string): string {
  const greeting = name.trim() ? `Hi ${name.trim()}!` : 'Hi!';
  return `${greeting} Type your transactions the way you'd say them, for example “coffee 25k with GoPay”. I'll prepare the draft, you tap Save.`;
}

export function aiChatSuggestions(): string[] {
  return ['Gas 40k', 'Transfer 500k BCA to Jago', 'Lunch 48k cash, parking 5k'];
}

export function aiChatSendLabel(): string {
  return 'Send';
}

export function aiChatCounter(count: number, max: number): string {
  return `${count}/${max}`;
}

export function aiChatProcessing(): string {
  return 'Preparing the draft…';
}

export function aiChatCancelRequest(): string {
  return 'Cancel';
}

export function aiChatYouLabel(text: string): string {
  return `You: ${text}`;
}

export function aiChatAssistantLabel(text: string): string {
  return `MONO: ${text}`;
}

export function aiChatMascotLabel(): string {
  return 'MONO mascot';
}

export function aiDraftKindWord(kind: 'income' | 'expense' | 'transfer'): string {
  return kind === 'income' ? 'income' : kind === 'transfer' ? 'transfer' : 'expense';
}

export function aiDraftTag(kind: 'income' | 'expense' | 'transfer'): string {
  return `DRAFT · ${aiDraftKindWord(kind).toUpperCase()}`;
}

export function aiDraftUnsaved(): string {
  return 'Not saved yet';
}

export function aiDraftSavedBadge(): string {
  return 'Saved';
}

export function aiDraftCategoryRow(): string {
  return 'Category';
}

export function aiDraftAccountRow(): string {
  return 'Account';
}

export function aiDraftFromRow(): string {
  return 'From';
}

export function aiDraftToRow(): string {
  return 'To';
}

export function aiDraftDateRow(): string {
  return 'Date';
}

export function aiDraftBalanceAfterRow(accountName: string): string {
  return `${accountName} balance after`;
}

export function aiDraftUntitled(kind: 'income' | 'expense' | 'transfer'): string {
  return kind === 'income' ? 'Income' : kind === 'transfer' ? 'Transfer' : 'Expense';
}

export function aiDraftNotSet(): string {
  return 'Not chosen';
}

export function aiDraftsHeading(count: number): string {
  return `${count} DRAFTS`;
}

export function aiDraftsTotalRow(): string {
  return 'Total';
}

export function aiDraftsSaveN(count: number): string {
  return `Save ${count} transactions`;
}

export function aiDraftsEditEach(): string {
  return 'Edit one by one';
}

export function aiDraftLockedNeeds(): string {
  return 'Incomplete';
}

export function aiDraftLockedCheckAmount(): string {
  return 'Check the amount';
}

export function aiDraftLockedBlocked(): string {
  return "Can't be saved";
}

export function aiDraftCheckboxLabel(title: string, checked: boolean, locked: string | null): string {
  if (locked) return `${title}, ${locked}`;
  return `${title}, ${checked ? 'selected' : 'not selected'}`;
}

export function aiDraftSavingLabel(): string {
  return 'Saving…';
}

export function aiDraftA11y(kind: 'income' | 'expense' | 'transfer', title: string, amountSpoken: string, details: string[], saved: boolean): string {
  const state = saved ? 'saved' : 'not saved yet';
  return [`${aiDraftKindWord(kind)} draft`, title, amountSpoken, ...details, state].join(', ');
}

export function aiDraftsA11y(count: number, totalSpoken: string): string {
  return `${count} transaction drafts, total ${totalSpoken}, not saved yet`;
}

export function aiDraftAmountSpoken(kind: 'income' | 'expense' | 'transfer', formatted: string): string {
  return kind === 'expense' ? `minus ${formatted}` : kind === 'income' ? `plus ${formatted}` : formatted;
}

export function aiEditTitle(): string {
  return 'Edit draft';
}

export function aiEditProgress(index: number, total: number): string {
  return `${index} of ${total}`;
}

export function aiEditFromMessage(): string {
  return 'From your message';
}

export function aiEditSaveContinue(): string {
  return 'Save and continue';
}

export function aiEditSkip(): string {
  return 'Skip';
}

export function aiEditDiscardTitle(): string {
  return 'Discard changes?';
}

export function aiEditDiscardMessage(): string {
  return "Drafts you haven't saved will be lost. Ones you already saved stay saved.";
}

export function aiEditDiscardConfirm(): string {
  return 'Discard';
}

export function aiEditKeepEditing(): string {
  return 'Keep editing';
}

export function aiEditNothingToEdit(): string {
  return 'There are no drafts to edit.';
}

export function aiLoadErrorMessage(): string {
  return "Couldn't read your data. Nothing changed.";
}

export function aiUndoFailed(): string {
  return "Couldn't undo that. Nothing changed.";
}

// ---------------------------------------------------------------- More (pushed from the Overview avatar)
export function moreScreenTitle(): string {
  return 'More';
}

export function moreBackText(): string {
  return 'Overview';
}

export function moreBackLabel(): string {
  return 'Back to Overview';
}

export function moreGroupMoney(): string {
  return 'MONEY';
}

export function moreGroupData(): string {
  return 'DATA AND APP';
}

export function moreGoalsTitle(): string {
  return 'Financial goals';
}

export function moreGoalsSub(): string {
  return 'Targets measured from real balances';
}

export function moreRecurringTitle(): string {
  return 'Fixed expenses';
}

export function moreRecurringSub(dueCount: number): string {
  const base = 'Gym, internet, subscriptions';
  return dueCount > 0 ? `${base} · ${dueCount} due` : base;
}

export function moreReportsTitle(): string {
  return 'Reports';
}

export function moreReportsSub(): string {
  return 'Cash flow, spending, net worth, CSV export';
}

export function moreCategoriesTitle(): string {
  return 'Categories';
}

export function moreCategoriesSub(): string {
  return 'Income and expense categories';
}

export function moreBackupRestoreTitle(): string {
  return 'Backup and restore';
}

export function moreBackupRestoreSub(): string {
  return 'Export or restore a JSON backup, export CSV';
}

export function moreSettingsTitle(): string {
  return 'Settings';
}

export function moreSettingsSub(): string {
  return 'Currency, privacy, format, about';
}

export function moreFooterLine(version: string | null): string {
  const parts = [version ? `Version ${version}` : null, 'Works offline', 'No account, no sync'];
  return parts.filter(Boolean).join(' · ');
}

export function moreRowLabel(title: string, sub: string): string {
  return `${title}, ${sub}`;
}

export function moreComingSoon(): string {
  return 'This screen is not built yet.';
}

export function moreLogoLabel(): string {
  return 'MONO Finance';
}

// ---------------------------------------------------------------- Database
export function dbOpenFailedMessage(): string {
  return 'The database could not be opened.';
}

export function dbRetryLabel(): string {
  return 'Try again';
}

// ---------------------------------------------------------------- Language
export function moreGroupLanguage(): string {
  return 'LANGUAGE';
}

export function languageEnglishLabel(): string {
  return 'English';
}

export function languageIndonesianLabel(): string {
  return 'Bahasa Indonesia';
}

export function languageSelectorLabel(): string {
  return 'Language';
}

// ---------------------------------------------------------------- Goals (synced from id.ts)
// Goals list screen & edit form (DESIGN.md "G. Goals").
export function goalNeededPaceLabel(amountFormatted: string): string {
  return `Needed pace, estimate`;
}

export function goalNoTargetDate(): string { return 'No target date'; }
export function goalBackLabel(): string { return 'Back to More'; }
export function goalBackText(): string { return 'More'; }
export function goalPastDueLabel(): string { return 'Target date has passed'; }
export function goalTargetAccessibilityLabel(name: string, current: string, target: string, progress: string): string {
  return `${name}, ${current} of ${target}, ${progress} achieved, tap to edit`;
}

export function goalNeededPaceValue(amountFormatted: string): string {
  return `${amountFormatted} / month`;
}

export function goalAccountLinkedLabel(accountName: string): string {
  return `Linked account: ${accountName}`;
}

export function goalNotLinkedLabel(): string {
  return 'Not linked to an account yet';
}

export function goalCalculatedLabel(): string {
  return 'Calculated: all accounts added together';
}

export function goalsEmptyTitle(): string {
  return 'No goals yet';
}

export function goalsEmptyBody(): string {
  return 'Add a goal to track your progress toward a target.';
}

export function addGoalLabel(): string {
  return 'Add goal';
}

export function goalsFooterNote(): string {
  return 'Progress is never typed in. It is computed from the accounts a goal is linked to, so it matches your records.';
}

// Goal edit form.
export function newGoalTitle(): string {
  return 'New goal';
}

export function editGoalTitle(): string {
  return 'Edit goal';
}

export function goalNameLabel(): string {
  return 'NAME';
}

export function goalNamePlaceholder(): string {
  return 'e.g. Emergency fund';
}

export function goalProgressSourceLabel(): string {
  return 'PROGRESS IS CALCULATED FROM';
}

export function goalModeOneAccountLabel(): string {
  return 'One account';
}

export function goalModeOneAccountSub(): string {
  return 'Balance of a linked account';
}

export function goalModeTotalAssetsLabel(): string {
  return 'Total assets';
}

export function goalModeTotalAssetsSub(): string {
  return 'All accounts added together';
}

export function goalLinkedAccountLabel(): string {
  return 'LINKED ACCOUNT';
}

export function goalCurrentBalanceNote(amountFormatted: string): string {
  return `Current balance ${amountFormatted} — read from your records, not typed in.`;
}

export function goalTargetAmountLabel(): string {
  return 'TARGET AMOUNT';
}

export function goalTargetDateLabel2(): string {
  return 'TARGET DATE, OPTIONAL';
}

export function goalPreviewLabel(): string {
  return 'PREVIEW FROM STORED RECORDS';
}

export function goalPreviewSavedSoFar(): string {
  return 'Saved so far';
}

export function goalPreviewRemaining(): string {
  return 'Remaining';
}

export function goalPreviewMonthsLeft(monthsLeft: number, dateFormatted: string): string {
  return `Months left, to ${dateFormatted}`;
}

export function goalPreviewMonthsLeftValue(monthsLeft: number): string {
  return `${monthsLeft}`;
}

export function goalPreviewNeededPace(): string {
  return 'Needed pace, estimate';
}

export function goalDeleteNote(): string {
  return 'Deleting a goal never changes accounts or transactions.';
}

export function goalDeleteLabel(): string { return 'Delete goal'; }
export function goalDeleteConfirmTitle(name: string): string { return `Delete ${name}?`; }
export function goalDeleteConfirmBody(): string { return 'Accounts and transactions do not change.'; }
export function goalDeletedToast(): string { return 'Goal deleted.'; }
export function goalAchievedPreview(): string { return 'This goal is already achieved with the current balance.'; }
export function goalChooseDate(): string { return 'Choose date'; }
export function goalMonthlyValue(amountFormatted: string): string { return `${amountFormatted} / month`; }

export function saveGoalLabel(): string {
  return 'Save goal';
}

export function goalLinkAccountPickerTitle(): string {
  return 'Link an account';
}

export function goalNameTooLong(): string {
  return 'Name must be 40 characters or fewer.';
}

export function goalNameRequired(): string {
  return 'Name is required.';
}

export function goalAmountRequired(): string {
  return 'Target amount must be greater than zero.';
}

export function goalAccountRequired(): string {
  return 'Choose an account to link.';
}

export function goalLinkCTA(): string {
  return 'Link an account or log contributions to start tracking.';
}

// ---- Receipt scan (/tx/scan, /tx/scan/review): the camera, its error states and the review ----
export function receiptFrameHint(): string {
  return 'Fit the whole receipt inside the frame. Make sure the text is readable and not blurry.';
}

export function receiptCloseLabel(): string {
  return 'Close';
}

export function receiptFlashLabel(on: boolean): string {
  return on ? 'Turn flash off' : 'Turn flash on';
}

export function receiptGalleryLabel(): string {
  return 'Choose from gallery';
}

export function receiptShutterLabel(): string {
  return 'Take photo';
}

export function receiptManualLabel(): string {
  return 'Enter manually';
}

export function receiptReadingLabel(): string {
  return 'Reading the receipt…';
}

export function receiptPermissionTitle(): string {
  return 'Camera access is off';
}

export function receiptPermissionBody(): string {
  return 'Allow the camera so MONO can photograph a receipt. The picture is read on your phone, not saved and not sent anywhere. You can also choose a photo from your gallery.';
}

export function receiptOpenSettingsLabel(): string {
  return 'Open settings';
}

export function receiptAllowCameraLabel(): string {
  return 'Allow camera';
}

export function receiptUnreadableMessage(): string {
  return 'The receipt could not be read. Try another photo or enter it manually.';
}

export function receiptForeignMessage(): string {
  return 'Receipts in a foreign currency cannot be read here yet. Enter it manually.';
}

export function receiptRetakeLabel(): string {
  return 'Retake photo';
}

export function receiptReviewTitle(): string {
  return 'Scan result';
}

export function receiptBackLabel(): string {
  return 'Back';
}

export function receiptOnDeviceTitle(): string {
  return 'Read on your phone';
}

export function receiptOnDeviceNote(): string {
  return 'The picture is not saved and not sent. Check it before saving.';
}

export function receiptDraftTag(): string {
  return 'DRAFT · EXPENSE';
}

export function receiptNotSavedLabel(): string {
  return 'Not saved yet';
}

export function receiptDateLine(dateText: string, fromReceipt: boolean): string {
  return fromReceipt ? `${dateText} · from the receipt` : `${dateText} · today`;
}

export function receiptShopLabel(): string {
  return 'Shop';
}

export function receiptTotalPick(): string {
  return 'Total, pick the right one';
}

export function receiptTotalTypeOwn(): string {
  return 'Type it';
}

export function receiptTotalOwnLabel(): string {
  return 'Total (Rp)';
}

export function receiptCategoryLabel(): string {
  return 'Category';
}

export function receiptChooseCategory(): string {
  return 'Choose a category';
}

export function receiptAccountLabel(): string {
  return 'Account';
}

export function receiptDateLabel(): string {
  return 'Date';
}

export function receiptBalanceAfter(amountText: string): string {
  return `Balance after ${amountText}`;
}

export function receiptSimilarNotice(dateText: string, amountText: string, name: string): string {
  return `Looks like the transaction on ${dateText}: ${amountText}${name ? `, ${name}` : ''}. You can still save it.`;
}

export function receiptCancelLabel(): string {
  return 'Cancel';
}

export function receiptSaveLabel(): string {
  return 'Save expense';
}

export function receiptSavingLabel(): string {
  return 'Saving…';
}

export function receiptNothingToReview(): string {
  return 'There is no scan result to review.';
}

export function receiptScanAgainLabel(): string {
  return 'Scan again';
}

export function receiptLoadError(): string {
  return 'Your accounts and categories could not be loaded.';
}

// ---- Receipt scan: "Rapikan dengan AI" and its consent dialog ----
export function receiptAiButton(): string {
  return 'Tidy up with AI';
}

export function receiptAiBusy(): string {
  return 'Tidying up…';
}

export function receiptAiNote(): string {
  return 'Only the recognized text is sent to Gemini, not the picture.';
}

export function receiptAiAdjusted(): string {
  return 'Adjusted by AI';
}

export function receiptAiNothingChanged(): string {
  return 'The AI found nothing to tidy up.';
}

export function receiptCategoryByAi(name: string): string {
  return `${name} ✓`;
}

export function receiptConsentTitle(): string {
  return 'Send the receipt text to Google?';
}

export function receiptConsentLead(): string {
  return 'Sent with your own Gemini key: ';
}

export function receiptConsentStrong(): string {
  return 'the recognized text';
}

export function receiptConsentRest(): string {
  return ' (shop name and items), account and category names, and today\'s date.\n\nNot sent: the receipt picture, balances, transaction history. You will be asked every time.';
}

export function receiptConsentCancel(): string {
  return 'Don\'t send';
}

export function receiptConsentConfirm(): string {
  return 'Send';
}

// ---- Automatic import from notifications: Settings entry, Import-Setup, Import-Settings, Import-Permission, dev sampler ----
export function settingsAssistantGroup(): string {
  return 'Assistant';
}

export function importAutoTitle(): string {
  return 'Automatic import';
}

export function importAutoRowHint(): string {
  return 'Prepare transactions from bank and e-wallet notifications';
}

export function importAutoRowValue(count: number): string {
  return count === 0 ? 'Off' : `${count} ${count === 1 ? 'app' : 'apps'} on`;
}

export function importIntro(): string {
  return 'Cut down on typing. MONO can prepare transactions from your bank or e-wallet notifications. You review them first; nothing is saved until you tap Save.';
}

export function importNotifTitle(): string {
  return 'Android notifications';
}

export function importPillOff(): string {
  return 'Not on yet';
}

export function importPillOn(): string {
  return 'On';
}

export function importNotifDesc(): string {
  return 'Reads notifications from the bank and e-wallet apps you choose. Processed on your phone, with no internet.';
}

export function importEnableAccess(): string {
  return 'Turn on notification access';
}

export function importReadsHeader(): string {
  return 'What MONO reads';
}

export function importReads1(): string {
  return 'Only notifications from the apps you choose.';
}

export function importReads2(): string {
  return 'Amount, type, time, merchant, and the bank or e-wallet name.';
}

export function importNotReadHeader(): string {
  return 'What is not read or kept';
}

export function importNotRead1(): string {
  return 'Other notifications, from apps you did not choose.';
}

export function importNotRead2(): string {
  return 'The full message text. Only what was read from it is kept.';
}

export function importNotRead3(): string {
  return 'Passwords or PINs. MONO never asks for them.';
}

export function importOptionalNote(): string {
  return 'Optional and off by default. You can turn it off any time; transactions you already saved stay.';
}

export function importPendingLink(count: number): string {
  return count === 0 ? 'No transactions waiting for review' : `${count} ${count === 1 ? 'transaction' : 'transactions'} waiting for review`;
}

export function importPendingSub(): string {
  return 'Nothing is saved yet';
}

export function importAccessRow(): string {
  return 'Notification access';
}

export function importLastRead(dateTime: string): string {
  return `Last read ${dateTime}`;
}

export function importNeverRead(): string {
  return 'No notification read yet';
}

export function importAccessOn(): string {
  return 'On';
}

export function importAccessOff(): string {
  return 'Off';
}

export function importFullGroup(): string {
  return 'Fully supported';
}

export function importFullEmpty(): string {
  return 'None yet. An app is listed here once it has its own reader, tested with real texts.';
}

export function importDetectedGroup(): string {
  return 'Detected apps';
}

export function importDetectedHelp(): string {
  return 'Read with the general reader. You always need to check the result.';
}

export function importDetectedEmpty(): string {
  return 'No apps detected yet. Once your bank or e-wallet app sends a notification, its name shows up here.';
}

export function importAppToAccount(name: string): string {
  return `To account ${name}`;
}

export function importAppUnmapped(): string {
  return 'Not linked to an account yet';
}

export function importAppSwitchLabel(appName: string, on: boolean): string {
  return `${appName}, ${on ? 'on' : 'off'}`;
}

export function importOnlyEnabledNote(): string {
  return 'Only the apps switched on above are read. Each app is linked to one MONO account.';
}

export function importProblemsHeader(): string {
  return 'If something is wrong';
}

export function importProblemAccessOffTitle(): string {
  return 'Notification access is off.';
}

export function importProblemAccessOffBody(): string {
  return 'MONO cannot read new notifications.';
}

export function importOpenGuide(): string {
  return 'Open the permission guide';
}

export function importProblemStoppedTitle(): string {
  return 'MONO stopped reading.';
}

export function importProblemStoppedBody(): string {
  return 'Android stopped the MONO notification service.';
}

export function importRestartService(): string {
  return 'Restart it';
}

export function importBatteryNote(): string {
  return 'Some phones stop MONO in the background to save battery. Set MONO to "Unrestricted" in the battery settings so notifications are not missed.';
}

export function importOpenBattery(): string {
  return 'Open battery settings';
}

export function importNativeMissing(): string {
  return 'The notification reader is not in this build. Reinstall the app from the latest build.';
}

export function importAppError(code: string): string {
  return code === 'needs_account' ? 'Choose the MONO account first. Without an account the app stays off.' : code === 'account_missing' ? 'That account was not found or is archived.' : code === 'account_not_rupiah' ? 'Import only goes to a rupiah account, not a Valas account.' : code === 'unknown_app' ? 'This app has not been detected yet.' : 'Could not change the setting. Nothing changed.';
}

export function importGuideTitle(): string {
  return 'Turn on notification access';
}

export function importGuideSubtitle(): string {
  return 'One extra step on Android 13 and up';
}

export function importGuideLead(): string {
  return 'MONO only reads notifications from the bank and e-wallet apps you choose. Because MONO is installed outside the Play Store, Android 13 and up asks for one extra step:';
}

export function importGuideStepTitle(step: number): string {
  return ['Open the MONO app info', 'Tap the three dots at the top right', 'Open Notification access', 'Turn MONO on'][step - 1] ?? '';
}

export function importGuideStepSub(step: number): string {
  return ['Long-press the MONO icon, then choose App info.', 'Choose "Allow restricted settings".', 'In Android settings: Notifications, Device notification access.', 'Accept the Android warning. Come back to MONO afterwards.'][step - 1] ?? '';
}

export function importGuideNote(): string {
  return 'You can take this permission back any time. MONO does not read notifications from apps you did not choose.';
}

export function importGuideOpen(): string {
  return 'Open Android settings';
}

export function importGuideLater(): string {
  return 'Not now';
}

export function importGuideDirect(): string {
  return 'Go straight to Notification access';
}

export function importSamplerTitle(): string {
  return 'Notification sampler';
}

export function importSamplerHint(): string {
  return 'Memory only. Shows the raw text of notifications from the apps you switched on, so you can copy them as real samples. Nothing is written to the database.';
}

export function importSamplerEmpty(): string {
  return 'No notifications yet. Switch an app on in Automatic import, then trigger one.';
}

export function importSamplerCopy(): string {
  return 'Copy';
}

export function importSamplerCopied(): string {
  return 'Copied';
}

export function importSamplerClear(): string {
  return 'Clear';
}

export function importSamplerSystemLabel(): string {
  return 'Allow system apps (dev only)';
}

export function importSamplerSystemHint(): string {
  return 'For the emulator: notifications from adb come from a system app. Turn this on, trigger one, switch the app on in Automatic import, then trigger again.';
}

// ---- Backup status strip on More, and the "Buat cadangan" flow ----
export function backupStripTitle(): string {
  return 'Stored only on this device';
}

export function backupNoneLine(): string {
  return 'No backup yet';
}

export function backupLastLine(unit: string, n: number): string {
  return `Last backup ${unit === 'today' ? 'today' : unit === 'yesterday' ? 'yesterday' : unit === 'days' ? `${n} days ago` : unit === 'weeks' ? `${n} ${n === 1 ? 'week' : 'weeks'} ago` : unit === 'months' ? `${n} ${n === 1 ? 'month' : 'months'} ago` : `${n} ${n === 1 ? 'year' : 'years'} ago`}`;
}

export function backupChangedLine(count: number): string {
  return `${count} ${count === 1 ? 'transaction' : 'transactions'} changed since then`;
}

export function backupStripLabel(title: string, line: string, changed: string): string {
  return `${title}. ${line}.${changed ? ` ${changed}.` : ''} Tap to open backups.`;
}

export function backupNowLabel(): string {
  return 'Back up now';
}

export function backupSavedToast(): string {
  return 'Backup saved.';
}

export function backupFailedToast(): string {
  return 'The backup could not be made. Nothing changed.';
}

export function backupShareTitle(): string {
  return 'Save the MONO backup';
}

export function currencyName(code: string): string {
  return CURRENCY_NAMES_EN[code] ?? code;
}

export function ratesTitle(): string {
  return 'Exchange rates';
}

export function ratesAutoTitle(): string {
  return 'Update automatically';
}

export function ratesAutoHelp(): string {
  return 'Once a day when MONO is open and online. On by default.';
}

export function ratesAutoSwitchLabel(on: boolean): string {
  return on ? 'Update automatically, on' : 'Update automatically, off';
}

export function ratesUpdateNow(): string {
  return 'Update rates now';
}

export function ratesUpdating(): string {
  return 'Updating rates…';
}

export function ratesLastUpdated(dateTime: string): string {
  return `Last updated ${dateTime}`;
}

export function ratesNeverUpdated(): string {
  return 'Never updated';
}

export function ratesInUseHeader(): string {
  return 'Rates in use';
}

export function ratesSourceApi(): string {
  return 'Exchange Rate API';
}

export function ratesSourceManual(): string {
  return 'Typed by you';
}

export function ratesRowSub(source: string, dateTime: string): string {
  return `${source} · ${dateTime}`;
}

export function ratesRowNoRate(): string {
  return 'No rate yet';
}

export function ratesRowSetRate(): string {
  return 'Set a rate';
}

export function ratesRowPer(rate: string, symbol: string): string {
  return `${rate} per ${symbol}1`;
}

export function ratesRowLabel(code: string, name: string, detail: string): string {
  return `${code}, ${name}, ${detail}. Tap to type your own rate.`;
}

export function ratesNoCurrencies(): string {
  return 'No currencies yet. Add a currency to the Valas account and its rate shows up here.';
}

export function ratesFailTitle(): string {
  return 'Couldn\'t update rates.';
}

export function ratesFailOffline(dateTime: string | null): string {
  return dateTime ? `No internet. MONO keeps using the ${dateTime} rates. Nothing changed or was lost.` : 'No internet. No rate is stored yet; type one yourself.';
}

export function ratesFailLimited(minutes: number): string {
  return `The rate service asked us to wait. Try again later; the button is back in ${minutes} minutes. Your stored rates did not change.`;
}

export function ratesFailInvalid(): string {
  return 'The rate service sent an answer we cannot use. MONO keeps the rates it has stored.';
}

export function ratesCooldown(minutes: number): string {
  return `Rates were just updated. Try again in ${minutes} minutes.`;
}

export function ratesNoPockets(): string {
  return 'No currency is held yet, so there is no rate to fetch.';
}

export function ratesUpdatedToast(): string {
  return 'Rates updated';
}

export function ratesHowHeader(): string {
  return 'How rates are used';
}

export function ratesHowBody(): string {
  return 'Account totals and net worth value each pocket at the rates above, marked ≈. Every transaction stores its rupiah value on the day it was recorded, so budgets and reports do not change when rates change.';
}

export function ratesPrivacy(): string {
  return 'Only one request with no content goes to the service. Your notes, balances and account names never go with it.';
}

export function ratesAttribution(): string {
  return 'Rates by Exchange Rate API';
}

export function ratesManualTitle(code: string): string {
  return `Your own ${code} rate`;
}

export function ratesManualSubtitle(name: string): string {
  return `${name}. Used until the next update.`;
}

export function ratesManualLabel(symbol: string): string {
  return `Rupiah per ${symbol}1`;
}

export function ratesManualInvalid(): string {
  return 'Enter a sensible rupiah rate, for example 16.250 or 16.250,5.';
}

export function ratesManualSave(): string {
  return 'Save rate';
}

export function ratesManualSaved(code: string): string {
  return `${code} rate saved`;
}

export function ratesCloseLabel(): string {
  return 'Close';
}

export function setRateFirst(code: string): string {
  return `There is no rate for ${code} yet. Set the rate first.`;
}

export function setRateButton(): string {
  return 'Set rate';
}

export function valasFormTitleNew(): string {
  return 'New Valas account';
}

export function valasFormTitleEdit(): string {
  return 'Edit Valas account';
}

export function valasTypeTile(): string {
  return 'Valas · foreign currency';
}

export function valasExistsHint(): string {
  return 'You already have a Valas account. Add the currency to that account.';
}

export function valasNameLabel(): string {
  return 'Account name';
}

export function valasNamePlaceholder(): string {
  return 'Valas';
}

export function valasCurrenciesLabel(): string {
  return 'Currencies';
}

export function valasCurrencyNone(): string {
  return 'No currency yet. Add at least one.';
}

export function valasOpeningLabel(code: string): string {
  return `${code} opening balance`;
}

export function valasRemoveCurrency(code: string): string {
  return `Remove ${code} from the list`;
}

export function valasAddCurrency(): string {
  return 'Add currency';
}

export function valasOpeningDateLabel(date: string): string {
  return `Opening balance as of ${date}`;
}

export function valasOpeningHelp(): string {
  return 'Each currency starts with its opening balance on this date. The Valas account itself has no opening balance.';
}

export function valasCreateButton(): string {
  return 'Create account';
}

export function valasSaveButton(): string {
  return 'Save';
}

export function valasSavingLabel(): string {
  return 'Saving…';
}

export function valasCreatedToast(name: string): string {
  return `${name} account created`;
}

export function valasSavedToast(): string {
  return 'Changes saved';
}

export function valasPocketArchivedToast(code: string): string {
  return `${code} pocket archived`;
}

export function valasPocketAddedToast(code: string): string {
  return `${code} pocket added`;
}

export function valasAmountInvalid(): string {
  return 'Enter the opening balance as a number, for example 250,00.';
}

export function valasPocketsNeedAmount(): string {
  return 'Check the opening balances that are marked.';
}

export function valasForexError(code: string): string {
  switch (code) {
    case 'name_invalid':
      return 'The account needs a name, 40 letters at most.';
    case 'no_pockets':
      return 'Add at least one currency.';
    case 'duplicate_currency':
      return 'That currency is already in the Valas account.';
    case 'unsupported_currency':
      return 'That currency is not supported yet.';
    case 'amount_invalid':
      return 'The opening balance is not valid.';
    case 'not_forex_account':
      return 'This is not the Valas account.';
    default:
      return 'Could not save. Nothing changed.';
  }
}

export function valasAddSheetTitle(): string {
  return 'Add currency';
}

export function valasAddSheetSubtitle(): string {
  return 'Pick the currency you want to hold.';
}

export function valasSearchPlaceholder(): string {
  return 'Search currencies';
}

export function valasAlreadyAdded(): string {
  return 'Already added';
}

export function valasSearchEmpty(): string {
  return 'No currency matches.';
}

export function valasNeedRateNote(): string {
  return 'A rate is needed to show the rupiah value. Update the rates on the Exchange rates screen, or type your own there.';
}

export function valasCurrencyRowLabel(code: string, name: string, added: boolean): string {
  return added ? `${code}, ${name}, already added` : `${code}, ${name}`;
}

export function valasDetailCaption(): string {
  return 'Multi-currency account · value today';
}

export function valasDetailApproxNote(dateTime: string): string {
  return `An estimate from the ${dateTime} rates.`;
}

export function valasDetailIncomplete(): string {
  return 'The rupiah value is incomplete: a currency has no rate yet.';
}

export function valasNoPocketsTotal(): string {
  return 'No currency yet';
}

export function valasPocketsHeader(): string {
  return 'Currency pockets';
}

export function valasPocketsEmpty(): string {
  return 'No currency pockets yet. Add one.';
}

export function valasPocketLabel(code: string, name: string, amount: string, detail: string): string {
  return `${code}, ${name}, ${amount}, ${detail}`;
}

export function valasPocketArchive(code: string): string {
  return `Archive ${code}`;
}

export function valasPocketArchiveBlocked(code: string): string {
  return `The ${code} pocket still holds money. Empty it before archiving.`;
}

export function valasButtonAdd(): string {
  return 'Add';
}

export function valasButtonExchange(): string {
  return 'Exchange';
}

export function valasActivityTitle(month: string): string {
  return `${month} activity`;
}

export function valasFilterAll(): string {
  return 'All';
}

export function valasActivityEmpty(): string {
  return 'No activity this month.';
}

export function valasActivityFilterEmpty(code: string): string {
  return `No ${code} activity this month.`;
}

export function valasRatesLink(dateTime: string | null): string {
  return dateTime ? `Exchange rates · ${dateTime}` : 'Exchange rates';
}

export function valasFrozenNote(): string {
  return 'Every transaction stores its rupiah value on the day it was recorded, so budgets and reports do not change when rates change.';
}

export function valasViewAll(): string {
  return 'View all transactions for this account';
}

export function valasActivityRowLabel(title: string, kind: string, date: string, amount: string, value: string): string {
  return `${title}, ${kind}, ${date}, ${amount}${value}`;
}

export function valasActivityValue(value: string): string {
  return `, worth ${value}`;
}

export function valasFieldError(code: string): string {
  switch (code) {
    case 'name_invalid':
      return 'The account needs a name, 40 letters at most.';
    case 'name_taken':
      return 'You already have an account with this name.';
    case 'no_pockets':
      return 'Add at least one currency.';
    case 'amount_invalid':
      return 'Enter the opening balance as a number, for example 250,00.';
    case 'future_date':
      return 'The date cannot be in the future.';
    default:
      return 'Check this field.';
  }
}

export function valasPocketBalanceLabel(code: string, amount: string): string {
  return `${code} balance is now ${amount}`;
}

export function valasPocketsEditHeader(): string {
  return 'Existing pockets';
}

export function valasArchiveHelp(): string {
  return 'A pocket can be archived only when its balance is exactly 0. An archived currency can be added again later.';
}

export function valasPocketFieldLabel(): string {
  return 'Currency';
}

export function valasPocketChipLabel(code: string, name: string, balance: string): string {
  return `${code}, ${name}, balance ${balance}`;
}

export function valasAmountTitle(code: string): string {
  return `Amount in ${code}`;
}

export function valasAmountToMoveTitle(code: string): string {
  return `Amount to move (${code})`;
}

export function valasAmountAccessibility(code: string): string {
  return `Amount in ${code}`;
}

export function valasLiveValue(value: string, ratePer: string): string {
  return `≈ ${value} · ${ratePer}`;
}

export function valasBalanceAfter(amount: string): string {
  return `Balance after: ${amount}`;
}

export function valasBudgetNote(category: string, value: string): string {
  return `Counted toward the ${category} budget as about ${value}, the value on the day it is recorded. It stays the same if rates change.`;
}

export function valasYouSend(): string {
  return 'You send';
}

export function valasYouReceive(): string {
  return 'You receive';
}

export function valasExchangeTitle(): string {
  return 'Exchange currency';
}

export function valasExchangeRateYours(): string {
  return 'Your rate';
}

export function valasExchangeRateLatest(): string {
  return 'Latest stored rate';
}

export function valasExchangeDifference(): string {
  return 'Difference';
}

export function valasExchangeNoLatest(): string {
  return 'There is no rate to compare with yet.';
}

export function valasExchangeNote(): string {
  return 'MONO keeps both amounts and works out the rate itself. Net worth only moves by that difference.';
}

export function valasCrossRate(from: string, perUnit: string, to: string): string {
  return `1 ${from} = ${perUnit} ${to}`;
}

export function valasDifferenceText(percent: string, amount: string): string {
  return `${percent} (${amount})`;
}

export function valasEnterBoth(): string {
  return 'Enter both amounts to see the rate.';
}

export function valasGoToRates(): string {
  return 'Set rate';
}

export function txValasFieldError(error: { code: string; currency?: string; balance?: number; shortfall?: number; type?: string }, moneyFormat: (n: number) => string): TxErrorMessage {
  const code = error.currency ?? '';
  switch (error.code) {
    case 'pocket_required':
      return { text: 'Choose the currency to use.' };
    case 'missing_fx_rate':
    case 'missing_rate':
      return { text: `There is no rate for ${code} yet. Set the rate first.`, linkText: 'Set the rate' };
    case 'amount_to_required':
      return { text: 'Enter the amount you receive.' };
    case 'same_pocket':
      return { text: 'Pick two different currencies.' };
    case 'insufficient_balance': {
      const has = moneyFormat(error.balance ?? 0);
      const wanted = moneyFormat((error.balance ?? 0) + (error.shortfall ?? 0));
      const short = moneyFormat(error.shortfall ?? 0);
      const what = error.type === 'transfer' ? 'This exchange' : 'This expense';
      return { text: `The ${code} pocket has ${has}. ${what} is ${wanted}. Short by ${short}.` };
    }
    default:
      return { text: 'Check this field.' };
  }
}

export function valasSheetMeta(value: string): string {
  return `≈ ${value} · pick the currency next`;
}

export function valasPocketFromLabel(): string {
  return 'Currency you send';
}

export function valasPocketToLabel(): string {
  return 'Currency you receive';
}

export function settingsRatesRowHint(): string {
  return 'Rates that value the foreign money in the Valas account. Automatic updates are on by default.';
}
