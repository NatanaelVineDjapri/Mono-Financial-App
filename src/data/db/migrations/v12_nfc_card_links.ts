// Migration 11 -> 12: scanning an e-money card (docs: the Nfc boards; src/features/nfc, src/domain/cards).
//
//   card_links            which e-money card an e-wallet account is paired with. A card is never stored: only the
//                         issuer, the last 4 digits and a fingerprint (sha256 of a per-install salt + the card
//                         number, made in src/domain/cards). The fingerprint is UNIQUE, so one card can belong to one
//                         account only; account_id is the key, so an account has at most one card.
//                         ON DELETE CASCADE on purpose: the link is an attribute of the account, never a record of
//                         money. (Accounts are archived, not deleted, in the app; a restore that replaces the accounts
//                         empties this table first, see restore.ts, and brings its own rows back.)
//                         Only an e-wallet account can be linked (`card_link_needs_ewallet`), and a linked account
//                         cannot change its type (`account_type_locked`). Both are skipped while a restore runs
//                         (meta.guards_off = '1'), like every other guard.
//   categories            the two system categories of a balance adjustment, one per kind, if the person has none.
//                         Categories are never deleted in this app (only archived, CLAUDE.md rule 21), so they cannot
//                         be removed; the domain also creates them on demand, which covers a restored older backup.
//   transactions.source   also accepts 'nfc', an adjustment recorded after a card scan. Rebuilds `transactions`, see
//                         rebuildTransactions.ts.
//
// The salt (settings.nfc_salt) is not made here: it is made once at the first scan and lives in `settings`, which is
// part of a backup, so a restored phone still recognises its cards. A backup file is not encrypted, so the fingerprint
// is a convenience for recognising a card, not a secret.
import type { Db } from '../types';
import { rebuildTransactions } from './rebuildTransactions';

export const ADJUSTMENT_CATEGORY_NAME = 'Penyesuaian saldo';

export async function addNfcCardLinks(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE card_links (
  account_id  INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  issuer      TEXT    NOT NULL CHECK (issuer IN ('mandiri','flazz','tapcash','brizzi','jakcard')),
  last4       TEXT    NOT NULL CHECK (length(last4) = 4 AND last4 NOT GLOB '*[^0-9]*'),
  fingerprint TEXT    NOT NULL UNIQUE,
  linked_at   TEXT    NOT NULL
);

CREATE TRIGGER trg_card_link_ins BEFORE INSERT ON card_links
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'card_link_needs_ewallet')
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND type = 'ewallet');
END;

CREATE TRIGGER trg_card_link_account_type_upd BEFORE UPDATE OF type ON accounts
WHEN NEW.type <> 'ewallet' AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'account_type_locked')
  WHERE EXISTS (SELECT 1 FROM card_links WHERE account_id = NEW.id);
END;
`);

  for (const kind of ['expense', 'income'] as const) {
    await db.runAsync(
      `insert or ignore into categories (name, kind, icon, sort_order, archived)
       values (?, ?, 'wallet', (select coalesce(max(sort_order), 0) + 1 from categories where kind = ?), 0)`,
      [ADJUSTMENT_CATEGORY_NAME, kind, kind],
    );
  }

  await rebuildTransactions(db, {
    oldCheck: /CHECK \(source IN \('manual','ai','recurring','scan','import'\)\)/,
    newCheck: "CHECK (source IN ('manual','ai','recurring','scan','import','nfc'))",
    marker: "'nfc'",
    label: 'v12',
  });
}
