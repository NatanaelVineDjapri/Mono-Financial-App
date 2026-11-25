// Migration 12 -> 13: sub-categories. A category (Food & drink) can have sub-categories the person defines (Alone, Together), and a
// transaction can carry ONE of them, or none: the sub-category is optional everywhere.
//
//   subcategories             id, the category it belongs to, a name, archived, sort_order. The name is unique inside its
//                             category without regard to case, archived ones included (the same rule as categories, rule 21).
//   transactions.subcategory_id   NULL for a transaction without one. Added with ALTER TABLE (a REFERENCES column with a NULL
//                             default is allowed), so `transactions` is not rebuilt. ON DELETE RESTRICT: a sub-category that
//                             a transaction uses cannot be deleted (it is archived instead; an unused one may be deleted).
//   subcategory_category_mismatch   a transaction's sub-category must belong to the transaction's own category. A transfer has
//                             no category, so it can have no sub-category. Skipped while a restore runs (meta.guards_off = '1'),
//                             like every other guard.
//
// Budgets, reports and the category's kind lock are all about the category and are untouched: a sub-category is a label inside
// its category, never a category of its own.
import type { Db } from '../types';

export async function addSubcategories(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE subcategories (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ux_subcategory_name ON subcategories (category_id, lower(name));
CREATE INDEX ix_subcategory_category ON subcategories (category_id, archived, sort_order, id);

ALTER TABLE transactions ADD COLUMN subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE RESTRICT;
CREATE INDEX ix_tx_subcategory ON transactions (subcategory_id) WHERE subcategory_id IS NOT NULL;

CREATE TRIGGER trg_tx_subcategory_ins BEFORE INSERT ON transactions
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'subcategory_category_mismatch')
  WHERE NOT EXISTS (SELECT 1 FROM subcategories WHERE id = NEW.subcategory_id AND category_id IS NEW.category_id);
END;

CREATE TRIGGER trg_tx_subcategory_upd BEFORE UPDATE OF category_id, subcategory_id ON transactions
WHEN NEW.subcategory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'subcategory_category_mismatch')
  WHERE NOT EXISTS (SELECT 1 FROM subcategories WHERE id = NEW.subcategory_id AND category_id IS NEW.category_id);
END;
`);
}
