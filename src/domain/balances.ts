// Read-only: every balance comes straight from the views (CLAUDE.md rule 2 — no stored
// balances, nothing computed outside SQL). This file exists so screens import from
// src/domain, not a mix of domain and repo.
import * as repo from '../data/repo/accounts';
import type { AccountBalance, AccountGroupSubtotal, AccountOverviewRow, AccountType, PocketBalance, PocketValue } from '../data/repo/accounts';
import type { Db } from '../data/db/types';
import { getNetWorth } from './net-worth';

export type { AccountBalance, AccountGroupSubtotal, AccountOverviewRow, PocketBalance, PocketValue };

export function getAccountBalance(db: Db, accountId: number): Promise<AccountBalance | null> {
  return repo.getAccount(db, accountId);
}

export function listAccountBalances(db: Db, opts: { includeArchived?: boolean } = {}): Promise<AccountBalance[]> {
  return repo.listAccounts(db, opts);
}

export function listAccountsForOverview(db: Db): Promise<AccountOverviewRow[]> {
  return repo.listAccountsForOverview(db);
}

export function listAccountGroupSubtotals(db: Db): Promise<AccountGroupSubtotal[]> {
  return repo.listAccountGroupSubtotals(db);
}

// The pocket's own balance, not valued in rupiah (minor units of its own currency).
export function listPocketBalances(db: Db, accountId: number): Promise<PocketBalance[]> {
  return repo.listPocketBalances(db, accountId);
}

// Valued in rupiah at the newest rate. value_idr is null when a pocket has no rate yet
// — never silently treated as zero.
export function listPocketValues(db: Db, accountId: number): Promise<PocketValue[]> {
  return repo.listPockets(db, accountId);
}

export function getPocketValue(db: Db, accountId: number, currency: string): Promise<PocketValue | null> {
  return repo.getPocketValue(db, accountId, currency);
}

// Accounts tab (DESIGN.md "D. Accounts" / "Account cards"): every account, grouped by
// type in display order, each group's rupiah subtotal, the overall net worth and
// incomplete flag, and — forex accounts only — each pocket's own currency amount and
// rupiah value. Nothing here recomputes a balance; it only groups and joins rows that
// v_account_balance, v_pocket_balance and v_pocket_value already computed.
const GROUP_ORDER: AccountType[] = ['bank', 'cash', 'ewallet', 'savings', 'forex'];

export interface AccountsOverviewPocket {
  currency: string;
  balance: number; // minor units of `currency`
  minorFactor: number;
  valueIdr: number | null; // null when this pocket has no fx rate yet
}

export interface AccountsOverviewAccount {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  balance: number; // rupiah; for a forex account, the sum of its pockets
  missingRates: number;
  pockets?: AccountsOverviewPocket[]; // forex accounts only
}

export interface AccountsOverviewGroup {
  type: AccountType;
  subtotal: number; // rupiah
  accounts: AccountsOverviewAccount[];
}

export interface AccountsOverview {
  netWorth: number;
  incomplete: boolean;
  accountCount: number;
  groups: AccountsOverviewGroup[]; // only types with at least one account, in GROUP_ORDER
}

async function withPockets(db: Db, row: AccountOverviewRow): Promise<AccountsOverviewAccount> {
  if (row.type !== 'forex') {
    return { id: row.id, name: row.name, type: row.type, icon: row.icon, balance: row.balance, missingRates: row.missing_rates };
  }
  const [balances, values] = await Promise.all([repo.listPocketBalances(db, row.id), repo.listPockets(db, row.id)]);
  const valueByCurrency = new Map(values.map(v => [v.currency, v.value_idr]));
  const pockets = balances
    .filter(p => !p.archived)
    .map(p => ({ currency: p.currency, balance: p.balance, minorFactor: p.minor_factor, valueIdr: valueByCurrency.get(p.currency) ?? null }));
  return { id: row.id, name: row.name, type: row.type, icon: row.icon, balance: row.balance, missingRates: row.missing_rates, pockets };
}

export async function getAccountsOverview(db: Db): Promise<AccountsOverview> {
  const [rows, subtotalRows, netWorth] = await Promise.all([
    repo.listAccountsForOverview(db),
    repo.listAccountGroupSubtotals(db),
    getNetWorth(db),
  ]);

  const accounts = await Promise.all(rows.map(row => withPockets(db, row)));
  const subtotalByType = new Map(subtotalRows.map(s => [s.type, s.subtotal]));

  const groups = GROUP_ORDER.map(type => ({
    type,
    subtotal: subtotalByType.get(type) ?? 0,
    accounts: accounts.filter(a => a.type === type),
  })).filter(g => g.accounts.length > 0);

  return {
    netWorth: netWorth.netWorth,
    incomplete: netWorth.incomplete,
    accountCount: accounts.length,
    groups,
  };
}
