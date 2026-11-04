// Read-only: every balance comes straight from the views (CLAUDE.md rule 2 — no stored
// balances, nothing computed outside SQL). This file exists so screens import from
// src/domain, not a mix of domain and repo.
import * as repo from '../data/repo/accounts';
import type { AccountBalance, PocketBalance, PocketValue } from '../data/repo/accounts';
import type { Db } from '../data/db/types';

export type { AccountBalance, PocketBalance, PocketValue };

export function getAccountBalance(db: Db, accountId: number): Promise<AccountBalance | null> {
  return repo.getAccount(db, accountId);
}

export function listAccountBalances(db: Db, opts: { includeArchived?: boolean } = {}): Promise<AccountBalance[]> {
  return repo.listAccounts(db, opts);
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
