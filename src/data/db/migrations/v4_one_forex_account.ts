// Migration 3 -> 4: there is ONE Valas account ("one account called Valas", DESIGN.md section M).
// Its currencies are pockets inside it, so a second forex account would only split the same
// money in two. The schema comment always said so; this makes it a guard: inserting a second
// (not archived) forex account, or turning an account into one while another exists, is refused
// with the named code `forex_account_exists`.
//
// Existing data is not touched (a database that already holds two is left alone; only new ones
// are refused), and a restore (meta.guards_off = '1') bypasses it like every other guard.
import type { Db } from '../types';

export async function addOneForexAccountGuard(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TRIGGER IF NOT EXISTS trg_one_forex_ins BEFORE INSERT ON accounts
WHEN NEW.type = 'forex' AND NEW.archived = 0 AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'forex_account_exists') WHERE EXISTS (SELECT 1 FROM accounts WHERE type = 'forex' AND archived = 0);
END;

CREATE TRIGGER IF NOT EXISTS trg_one_forex_upd BEFORE UPDATE OF type, archived ON accounts
WHEN NEW.type = 'forex' AND NEW.archived = 0 AND (OLD.type <> 'forex' OR OLD.archived = 1)
     AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'forex_account_exists') WHERE EXISTS (SELECT 1 FROM accounts WHERE type = 'forex' AND archived = 0 AND id <> NEW.id);
END;
`);
}
