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
  type?: PlainAccountType; // one normal type to another; forex is locked by the schema
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

// Why an account cannot be archived or deleted. A fixed expense that still runs and a goal both read the account, so the
// person changes those first. The Valas account is left alone: its records are exchanges that cannot move elsewhere.
export type AccountRemovalError = 'not_found' | 'valas' | 'in_fixed_expense' | 'in_goal' | 'not_archived' | 'needs_replacement' | 'bad_replacement' | 'failed';
export type AccountRemovalResult = { ok: true } | { ok: false; error: AccountRemovalError };

const refuse = (error: AccountRemovalError): AccountRemovalResult => ({ ok: false, error });

export async function archiveAccount(db: Db, id: number): Promise<AccountRemovalResult> {
  const links = await repo.getAccountLinks(db, id);
  if (!links) return refuse('not_found');
  if (links.type === 'forex') return refuse('valas');
  if (links.activeFixedExpenses > 0) return refuse('in_fixed_expense');
  if (links.goals > 0) return refuse('in_goal');
  try {
    await repo.updateAccount(db, id, { archived: true });
  } catch (err) {
    throwDomainError(err);
  }
  return { ok: true };
}

export async function restoreAccount(db: Db, id: number): Promise<void> {
  try {
    await repo.updateAccount(db, id, { archived: false });
  } catch (err) {
    throwDomainError(err);
  }
}

export interface AccountRemoval {
  links: repo.AccountLinks;
  needsReplacement: boolean; // something recorded must move before the account can go
  replacements: { id: number; name: string }[]; // rupiah accounts in use
}

export async function getAccountRemoval(db: Db, id: number): Promise<AccountRemoval | null> {
  const links = await repo.getAccountLinks(db, id);
  if (!links) return null;
  const others = await repo.listAccounts(db);
  return {
    links,
    needsReplacement: links.records > 0 || links.fixedExpenses > 0 || links.goals > 0,
    replacements: others.filter(a => a.id !== id && a.type !== 'forex').map(a => ({ id: a.id, name: a.name })),
  };
}

// Deletes an archived account for good. With a replacement its records and balance move there first; without one it must
// have nothing recorded, and its opening balance leaves net worth. All or nothing.
export async function deleteArchivedAccount(db: Db, id: number, replacementId: number | null, now: string): Promise<AccountRemovalResult> {
  const removal = await getAccountRemoval(db, id);
  if (!removal) return refuse('not_found');
  if (removal.links.type === 'forex') return refuse('valas');
  if (removal.links.archived !== 1) return refuse('not_archived');
  if (replacementId == null && removal.needsReplacement) return refuse('needs_replacement');
  if (replacementId != null && !removal.replacements.some(a => a.id === replacementId)) return refuse('bad_replacement');
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const before = (await txn.getAllAsync('select * from v_integrity_issues')).length;
      await txn.runAsync("update meta set value = '1' where key = 'guards_off'");
      if (replacementId != null) await repo.moveAccount(txn, id, replacementId, now);
      await repo.deleteAccountRow(txn, id);
      await txn.runAsync("update meta set value = '0' where key = 'guards_off'");
      const broken = await txn.getAllAsync('PRAGMA foreign_key_check');
      const after = (await txn.getAllAsync('select * from v_integrity_issues')).length;
      if (broken.length > 0 || after > before) throw new Error('ACCOUNT_DELETE_INTEGRITY_CHECK_FAILED');
    });
  } catch {
    return refuse('failed');
  }
  return { ok: true };
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
