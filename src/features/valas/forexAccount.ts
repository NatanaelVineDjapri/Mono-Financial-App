// The Valas account (docs/DESIGN.md section M): ONE account holding one pocket per foreign
// currency. The schema is the real guard (a CHECK keeps the account's own opening balance at 0, a
// trigger refuses a second forex account and a non-empty pocket being archived); these functions
// check first so the person gets a clear reason, and they make creating the account and its pockets
// one all-or-nothing step.
//
// Nothing here stores a balance: a pocket's balance is a view (v_pocket_balance).
import type { Db } from '../../data/db/types';
import { addPocket as addPocketRow, getPocket } from '../../data/repo/accounts';
import { DomainError } from '../../domain/errors';
import { archivePocket as archiveEmptyPocket, createValasAccount } from '../../domain/accounts';
import { MAX_AMOUNT } from '../../core/tx/validate';
import { isSupportedForexCurrency } from './currencies';

export type ForexErrorCode =
  | 'name_invalid' // empty, or longer than 40
  | 'no_pockets' // an account with no currency yet
  | 'duplicate_currency' // the same currency twice
  | 'unsupported_currency' // not one of the 12
  | 'amount_invalid' // an opening balance that is not a whole number of minor units, or negative
  | 'not_forex_account'; // a pocket for an account that is not the Valas account

export class ForexError extends Error {
  readonly code: ForexErrorCode;
  constructor(code: ForexErrorCode) {
    super(code);
    this.name = 'ForexError';
    this.code = code;
  }
}

export interface PocketInput {
  currency: string;
  openingMinor: number; // minor units of the currency (cents for USD, whole yen for JPY)
}

export interface CreateForexAccountInput {
  name: string;
  pockets: readonly PocketInput[];
  openingDate: string; // 'YYYY-MM-DD'
  icon?: string | null;
}

function checkAmount(minor: number): void {
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_AMOUNT) throw new ForexError('amount_invalid');
}

function checkPockets(pockets: readonly PocketInput[]): void {
  const seen = new Set<string>();
  for (const pocket of pockets) {
    if (!isSupportedForexCurrency(pocket.currency)) throw new ForexError('unsupported_currency');
    if (seen.has(pocket.currency)) throw new ForexError('duplicate_currency');
    seen.add(pocket.currency);
    checkAmount(pocket.openingMinor);
  }
}

async function activeForexAccountId(db: Db): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>("select id from accounts where type = 'forex' and archived = 0 order by id limit 1");
  return row?.id ?? null;
}

// The one Valas account, or null before it is created.
export async function getForexAccountId(db: Db): Promise<number | null> {
  return activeForexAccountId(db);
}

// Creates the Valas account with its first pockets, all or nothing. There is only one: a second is
// refused with `forex_account_exists`. The account's own opening balance is always 0; each
// currency's opening balance belongs to its pocket, dated `openingDate` (not in the future).
export async function createForexAccount(db: Db, input: CreateForexAccountInput, now: string): Promise<number> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 40) throw new ForexError('name_invalid');
  if (input.pockets.length === 0) throw new ForexError('no_pockets');
  checkPockets(input.pockets);
  if (input.openingDate > now.slice(0, 10)) throw new DomainError('future_date');
  if ((await activeForexAccountId(db)) != null) throw new DomainError('forex_account_exists');

  let id = 0;
  await db.withExclusiveTransactionAsync(async txn => {
    id = await createValasAccount(
      txn,
      { name, openingDate: input.openingDate, icon: input.icon, pockets: input.pockets.map(p => ({ currency: p.currency, openingBalance: p.openingMinor })) },
      now,
    );
  });
  return id;
}

// Adds a currency to the Valas account. A currency the account once had and archived comes back
// with the balance it had; one it has now is refused as a duplicate.
export async function addForexPocket(db: Db, accountId: number, pocket: PocketInput, openingDate: string, now: string): Promise<void> {
  const account = await db.getFirstAsync<{ type: string }>('select type from accounts where id = $id', { $id: accountId });
  if (!account || account.type !== 'forex') throw new ForexError('not_forex_account');
  checkPockets([pocket]);
  if (openingDate > now.slice(0, 10)) throw new DomainError('future_date');

  const existing = await getPocket(db, accountId, pocket.currency);
  if (existing && existing.archived === 0) throw new ForexError('duplicate_currency');
  if (existing) {
    await db.runAsync('update account_currencies set archived = 0 where account_id = $accountId and currency = $currency', { $accountId: accountId, $currency: pocket.currency });
    return;
  }
  await addPocketRow(db, accountId, pocket.currency, pocket.openingMinor, openingDate);
}

// Archives a currency, only when its balance is exactly 0: a pocket that still holds money is
// refused (`pocket_not_empty`).
export async function archiveForexPocket(db: Db, accountId: number, currency: string): Promise<void> {
  await archiveEmptyPocket(db, accountId, currency);
}

