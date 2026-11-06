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
  return `Over ${nominal}`;
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

// TabBar / the five (tabs) routes (DESIGN.md section 9): the bottom nav's own labels,
// reused as each tab's temporary app-bar title until its real content lands.
export type TabKey = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'more';

const tabLabels: Record<TabKey, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  accounts: 'Accounts',
  budgets: 'Budgets',
  more: 'More',
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

export function transferAccountsLabel(): string {
  return 'Transfer between accounts';
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