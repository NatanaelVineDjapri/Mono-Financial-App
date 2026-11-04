// Account and pocket business rules on top of src/data/repo/accounts.ts. Plain reads
// (balances) are not re-wrapped here — call the repo or src/domain/balances.ts for
// those; this file is for writes and the rules around them.
import * as repo from '../data/repo/accounts';
import type { AccountType } from '../data/repo/accounts';
import type { Db } from '../data/db/types';
import { DomainError, throwDomainError } from './errors';

export type PlainAccountType = Exclude<AccountType, 'forex'>;

export interface CreateAccountInput {
  name: string;
  type: PlainAccountType;
  openingBalance: number;
  openingDate: string;
  icon?: string | null;
}

export async function createAccount(db: Db, input: CreateAccountInput, now: string): Promise<number> {
  try {
    return await repo.createAccount(db, input, now);
  } catch (err) {
    throwDomainError(err);
  }
}

export interface RenameAccountInput {
  name?: string;
  openingBalance?: number;
  openingDate?: string;
  icon?: string | null;
}

export async function updateAccount(db: Db, id: number, patch: RenameAccountInput): Promise<void> {
  try {
    await repo.updateAccount(db, id, patch);
  } catch (err) {
    throwDomainError(err);
  }
}

export async function archiveAccount(db: Db, id: number): Promise<void> {
  try {
    await repo.updateAccount(db, id, { archived: true });
  } catch (err) {
    throwDomainError(err);
  }
}

export interface CreateValasAccountInput {
  name: string;
  openingDate: string;
  icon?: string | null;
  pockets: { currency: string; openingBalance: number }[];
}

// Creates a 'forex' account and every one of its starting pockets. A forex account's
// own opening_balance is always 0 (CHECK in the schema) — the money lives in pockets.
export async function createValasAccount(db: Db, input: CreateValasAccountInput, now: string): Promise<number> {
  try {
    const accountId = await repo.createAccount(
      db,
      { name: input.name, type: 'forex', openingBalance: 0, openingDate: input.openingDate, icon: input.icon },
      now,
    );
    for (const pocket of input.pockets) {
      await repo.addPocket(db, accountId, pocket.currency, pocket.openingBalance, input.openingDate);
    }
    return accountId;
  } catch (err) {
    throwDomainError(err);
  }
}

export async function addPocket(db: Db, accountId: number, currency: string, openingBalance: number, openingDate: string): Promise<void> {
  try {
    await repo.addPocket(db, accountId, currency, openingBalance, openingDate);
  } catch (err) {
    throwDomainError(err);
  }
}

// Friendly pre-check (a non-empty pocket is always blocked) before the SQL guard, which
// stays the real authority.
export async function archivePocket(db: Db, accountId: number, currency: string): Promise<void> {
  const pockets = await repo.listPocketBalances(db, accountId);
  const pocket = pockets.find(p => p.currency === currency);
  if (pocket && pocket.balance !== 0) {
    throw new DomainError('pocket_not_empty');
  }
  try {
    await repo.archivePocket(db, accountId, currency);
  } catch (err) {
    throwDomainError(err);
  }
}
