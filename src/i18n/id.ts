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
};

export function guardMessage(code: GuardCode, ctx: GuardMessageContext = {}): string {
  return guardMessages[code](ctx);
}

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
export function welcomeGreeting(nickname: string | null): string {
  return nickname ? `Selamat datang, ${nickname}` : 'Selamat datang';
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
  return 'Add account';
}

export function addTransactionStepLabel(): string {
  return 'Add transaction';
}

export function setBudgetStepLabel(): string {
  return 'Set monthly budget';
}

export function createBackupStepLabel(): string {
  return 'Create backup';
}

export function privacyByDesignNote(): string {
  return 'Data only exists on this device. Private by design.';
}

// Recurring due card (PAGES.md A1).
export function dueTodayLabel(): string {
  return 'Due today';
}

export function noDueExpensesMessage(): string {
  return 'No expenses due now.';
}

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

export function lastSixMonthsLabel(): string {
  return 'Last 6 months';
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
