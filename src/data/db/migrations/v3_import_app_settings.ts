// Migration 2 -> 3: import_app_settings, one row per app whose notifications MONO may read for
// automatic import (docs/IMPORT_PLAN.md). Metadata only: the package, the app's name, whether
// reading is on, the MONO account the app's transactions go to, whether the app has its own parser
// ('full') or is read by the general one ('generic'), and when it last posted a notification.
// There is no column for a notification's title or text, and there never will be.
//
// Switching an app on needs an account: the CHECK makes "enabled without an account" impossible,
// and a trigger refuses a Valas account (imports are rupiah, like fixed expenses). The domain
// pre-checks both for a friendly message (src/domain/importApps.ts); these are the backstop.
//
// Nothing is rebuilt and no existing table changes, so there is nothing to park or restore.
import type { Db } from '../types';

export async function addImportAppSettings(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS import_app_settings (
  package         TEXT    PRIMARY KEY CHECK (length(package) BETWEEN 1 AND 255),
  app_name        TEXT    NOT NULL CHECK (length(app_name) BETWEEN 1 AND 100),
  enabled         INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  account_id      INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
  supported_level TEXT    NOT NULL DEFAULT 'generic' CHECK (supported_level IN ('full','generic')),
  last_seen_at    TEXT    NOT NULL,
  CHECK (enabled = 0 OR account_id IS NOT NULL)
);

CREATE TRIGGER IF NOT EXISTS trg_import_app_idr_ins BEFORE INSERT ON import_app_settings
WHEN NEW.account_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'import_needs_idr_account') WHERE (SELECT type FROM accounts WHERE id = NEW.account_id) = 'forex';
END;

CREATE TRIGGER IF NOT EXISTS trg_import_app_idr_upd BEFORE UPDATE OF account_id ON import_app_settings
WHEN NEW.account_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'import_needs_idr_account') WHERE (SELECT type FROM accounts WHERE id = NEW.account_id) = 'forex';
END;
`);
}
