// The pairing of an e-money card with an e-wallet account (table card_links, migration 11 -> 12). SQL in, plain objects
// out; the rules (who may be linked, one card per account) live in src/domain/cards and, as the real guard, in the
// schema. Only the issuer, the last 4 digits and a fingerprint are ever stored (never the card number).
import type { Db } from '../db/types';

export type CardIssuer = 'mandiri' | 'flazz' | 'tapcash' | 'brizzi' | 'jakcard';

export interface CardLinkRow {
  account_id: number;
  issuer: CardIssuer;
  last4: string;
  fingerprint: string;
  linked_at: string;
}

export interface CardLinkWithAccount extends CardLinkRow {
  account_name: string;
  archived: number;
}

export interface LinkableAccount {
  id: number;
  name: string;
  balance: number;
}

export async function getCardLinkByFingerprint(db: Db, fingerprint: string): Promise<CardLinkWithAccount | null> {
  return db.getFirstAsync<CardLinkWithAccount>(
    `select l.account_id, l.issuer, l.last4, l.fingerprint, l.linked_at, a.name as account_name, a.archived
       from card_links l join accounts a on a.id = l.account_id
      where l.fingerprint = $fingerprint`,
    { $fingerprint: fingerprint },
  );
}

export async function getCardLinkByAccount(db: Db, accountId: number): Promise<CardLinkRow | null> {
  return db.getFirstAsync<CardLinkRow>('select account_id, issuer, last4, fingerprint, linked_at from card_links where account_id = $id', { $id: accountId });
}

export async function insertCardLink(db: Db, link: CardLinkRow): Promise<void> {
  await db.runAsync(
    'insert into card_links (account_id, issuer, last4, fingerprint, linked_at) values ($accountId, $issuer, $last4, $fingerprint, $linkedAt)',
    { $accountId: link.account_id, $issuer: link.issuer, $last4: link.last4, $fingerprint: link.fingerprint, $linkedAt: link.linked_at },
  );
}

export async function deleteCardLink(db: Db, accountId: number): Promise<number> {
  const result = await db.runAsync('delete from card_links where account_id = $id', { $id: accountId });
  return result.changes;
}

// E-wallet accounts that are in use and have no card yet.
export async function listLinkableAccounts(db: Db): Promise<LinkableAccount[]> {
  return db.getAllAsync<LinkableAccount>(
    `select b.id, b.name, b.balance
       from v_account_balance b
      where b.type = 'ewallet' and b.archived = 0
        and not exists (select 1 from card_links l where l.account_id = b.id)
      order by b.name`,
  );
}

// The balance of an account as the views know it (never stored).
export async function getAccountBalanceNow(db: Db, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = $id', { $id: accountId });
  return row ? row.balance : null;
}

export interface AccountForLink {
  id: number;
  name: string;
  type: string;
  archived: number;
}

export async function getAccountForLink(db: Db, accountId: number): Promise<AccountForLink | null> {
  return db.getFirstAsync<AccountForLink>('select id, name, type, archived from accounts where id = $id', { $id: accountId });
}

export async function accountNameTaken(db: Db, name: string): Promise<boolean> {
  return (await db.getFirstAsync('select 1 as x from accounts where name = $name', { $name: name })) != null;
}

// The system category of a balance adjustment of one kind; null when there is none yet.
export async function findCategoryByName(db: Db, name: string, kind: 'income' | 'expense'): Promise<{ id: number; archived: number } | null> {
  return db.getFirstAsync<{ id: number; archived: number }>('select id, archived from categories where name = $name and kind = $kind', { $name: name, $kind: kind });
}

export async function insertSystemCategory(db: Db, name: string, kind: 'income' | 'expense'): Promise<number> {
  const result = await db.runAsync(
    `insert into categories (name, kind, icon, sort_order, archived)
     values ($name, $kind, 'wallet', (select coalesce(max(sort_order), 0) + 1 from categories where kind = $kind), 0)`,
    { $name: name, $kind: kind },
  );
  return result.lastInsertRowId;
}

export async function unarchiveCategory(db: Db, id: number): Promise<void> {
  await db.runAsync('update categories set archived = 0 where id = $id', { $id: id });
}
