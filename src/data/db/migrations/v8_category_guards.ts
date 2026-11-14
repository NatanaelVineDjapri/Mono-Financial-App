// Migration 7 -> 8: Categories are never deleted, only archived (CLAUDE.md rule 21), and three rules
// move into the database so no code path can break them:
//   category_kind_locked          a category's kind cannot change once a transaction, a budget or a
//                                 fixed expense uses it (it would turn old rows into mismatches).
//   last_active_category          the last active category of a kind cannot be archived.
//   category_in_active_recurring  a category used by an active fixed expense cannot be archived.
// The domain layer pre-checks all three for friendly messages (src/features/categories); these
// triggers are the real guard. A restore (meta.guards_off = '1') bypasses them like every other guard.
//
// It also fills `icon` for the seeded categories that still have none, with the keys of the icon
// registry (src/features/categories/icons.ts). A category whose icon is already set is left alone.
import type { Db } from '../types';

const SEED_ICONS: readonly (readonly [string, 'expense' | 'income', string])[] = [
  ['Food & drink', 'expense', 'food'],
  ['Transport', 'expense', 'car'],
  ['Shopping', 'expense', 'bag'],
  ['Bills', 'expense', 'bolt'],
  ['Health', 'expense', 'heart'],
  ['Leisure', 'expense', 'film'],
  ['Housing', 'expense', 'home'],
  ['Education', 'expense', 'book'],
  ['Gifts', 'expense', 'gift'],
  ['Other', 'expense', 'dot'],
  ['Salary', 'income', 'wallet'],
  ['Freelance', 'income', 'briefcase'],
  ['Interest and dividends', 'income', 'tag'],
  ['Other income', 'income', 'dot'],
];

export async function addCategoryGuards(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TRIGGER IF NOT EXISTS trg_category_kind_locked BEFORE UPDATE OF kind ON categories
WHEN NEW.kind <> OLD.kind AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'category_kind_locked')
  WHERE EXISTS (SELECT 1 FROM transactions WHERE category_id = OLD.id)
     OR EXISTS (SELECT 1 FROM budgets      WHERE category_id = OLD.id)
     OR EXISTS (SELECT 1 FROM recurring    WHERE category_id = OLD.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_category_archive_last BEFORE UPDATE OF archived ON categories
WHEN NEW.archived = 1 AND OLD.archived = 0 AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'last_active_category')
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE kind = OLD.kind AND archived = 0 AND id <> OLD.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_category_archive_recurring BEFORE UPDATE OF archived ON categories
WHEN NEW.archived = 1 AND OLD.archived = 0 AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'category_in_active_recurring')
  WHERE EXISTS (SELECT 1 FROM recurring WHERE category_id = OLD.id AND archived = 0);
END;
`);
  for (const [name, kind, icon] of SEED_ICONS) {
    await db.runAsync("update categories set icon = ? where name = ? and kind = ? and (icon is null or icon = '')", [icon, name, kind]);
  }
}
