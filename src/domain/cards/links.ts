// Pairing an e-money card with an account, and making an account from a card. One card belongs to one account (the
// fingerprint is unique); one account has at most one card; only an e-wallet account in rupiah can be paired. These are
// checked here for a clear reason, and again by the schema (migration 11 -> 12) as the real guard.
import type { Db } from '../../data/db/types';
import { createAccount } from '../../data/repo/accounts';
import {
  accountNameTaken,
  deleteCardLink,
  getAccountForLink,
  getCardLinkByAccount,
  getCardLinkByFingerprint,
  insertCardLink,
} from '../../data/repo/cardLinks';
import { getSetting } from '../../data/repo/settings';
import { throwDomainError } from '../errors';
import { saltFromBytes } from './fingerprint';
import type { CardInfo } from './types';

export type LinkFailure =
  | 'already_linked' // this card already belongs to an account
  | 'account_has_card' // the account already has a card
  | 'not_ewallet' // only an e-wallet account can be paired (a Valas or other account cannot)
  | 'account_not_found'
  | 'name_invalid' // empty, or longer than 40 characters
  | 'name_taken' // another account has this name
  | 'balance_invalid'; // not a whole amount of at least 0

export type LinkResult<T> = { ok: true; value: T } | { ok: false; reason: LinkFailure };

const NAME_MAX = 40;

// The salt of the fingerprints: made once, at the first scan, from random bytes the caller provides (expo-crypto in the
// app) and kept in settings, which is part of a backup. Reading it again never makes a second one.
export async function ensureNfcSalt(db: Db, randomBytes: () => Promise<Uint8Array>): Promise<string> {
  const existing = await getSetting(db, 'nfc_salt');
  if (existing) return existing;
  const salt = saltFromBytes(await randomBytes());
  await db.runAsync("insert or ignore into settings (key, value) values ('nfc_salt', $salt)", { $salt: salt });
  return (await getSetting(db, 'nfc_salt')) ?? salt;
}

// The account a scanned card is paired with, if any.
export async function findCardAccount(db: Db, fingerprint: string) {
  return getCardLinkByFingerprint(db, fingerprint);
}

export interface NewAccountFromCard {
  card: CardInfo;
  name: string;
  openingBalance: number; // starts as the card's balance, the person may change it
  now: string; // ISO instant; the opening date is its day
}

// A new e-wallet account for a card that is not known yet, with its link, in ONE transaction: both happen or neither.
export async function createAccountFromCard(db: Db, input: NewAccountFromCard): Promise<LinkResult<{ accountId: number }>> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) return { ok: false, reason: 'name_invalid' };
  if (!Number.isSafeInteger(input.openingBalance) || input.openingBalance < 0) return { ok: false, reason: 'balance_invalid' };

  let result: LinkResult<{ accountId: number }> = { ok: false, reason: 'account_not_found' };
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      if (await getCardLinkByFingerprint(txn, input.card.fingerprint)) {
        result = { ok: false, reason: 'already_linked' };
        return;
      }
      if (await accountNameTaken(txn, name)) {
        result = { ok: false, reason: 'name_taken' };
        return;
      }
      const accountId = await createAccount(txn, { name, type: 'ewallet', openingBalance: input.openingBalance, openingDate: input.now.slice(0, 10) }, input.now);
      await insertCardLink(txn, { account_id: accountId, issuer: input.card.issuer, last4: input.card.last4, fingerprint: input.card.fingerprint, linked_at: input.now });
      result = { ok: true, value: { accountId } };
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/accounts\.name/.test(message)) return { ok: false, reason: 'name_taken' };
    if (/card_links\.fingerprint/.test(message)) return { ok: false, reason: 'already_linked' };
    throwDomainError(err);
  }
}

export interface LinkToAccount {
  accountId: number;
  card: CardInfo;
  now: string;
}

// An account that already exists, paired with the card. Only an e-wallet account in use that has no card yet.
export async function linkCardToAccount(db: Db, input: LinkToAccount): Promise<LinkResult<{ accountId: number }>> {
  let result: LinkResult<{ accountId: number }> = { ok: false, reason: 'account_not_found' };
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      const account = await getAccountForLink(txn, input.accountId);
      if (!account || account.archived === 1) return; // account_not_found
      if (account.type !== 'ewallet') {
        result = { ok: false, reason: 'not_ewallet' };
        return;
      }
      if (await getCardLinkByAccount(txn, account.id)) {
        result = { ok: false, reason: 'account_has_card' };
        return;
      }
      if (await getCardLinkByFingerprint(txn, input.card.fingerprint)) {
        result = { ok: false, reason: 'already_linked' };
        return;
      }
      await insertCardLink(txn, { account_id: account.id, issuer: input.card.issuer, last4: input.card.last4, fingerprint: input.card.fingerprint, linked_at: input.now });
      result = { ok: true, value: { accountId: account.id } };
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/card_links\.fingerprint/.test(message)) return { ok: false, reason: 'already_linked' };
    if (/card_links\.account_id/.test(message)) return { ok: false, reason: 'account_has_card' };
    throwDomainError(err);
  }
}

// "Lepas tautan kartu": only the link goes. The account and every transaction stay as they are.
export async function unlinkCard(db: Db, accountId: number): Promise<boolean> {
  return (await deleteCardLink(db, accountId)) > 0;
}
