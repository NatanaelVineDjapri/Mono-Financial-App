import type { Db } from '../types';

import { addScanSource } from './v2_scan_source';
import { addImportAppSettings } from './v3_import_app_settings';
import { addOneForexAccountGuard } from './v4_one_forex_account';
import { addMoreCurrencies } from './v5_more_currencies';
import { turnOnFxAutoUpdate } from './v6_fx_auto_update_on';
import { clampGoalProgressView } from './v7_goal_progress_clamp';
import { addCategoryGuards } from './v8_category_guards';
import { addTransactionLocations } from './v9_transaction_locations';
import { addNotifications } from './v10_notifications';
import { addImportQueue } from './v11_import_queue';
import { addNfcCardLinks } from './v12_nfc_card_links';
import { addSubcategories } from './v13_subcategories';

export type Migration = (db: Db) => Promise<void>;

// Keyed by the schema_version a migration moves FROM: migrations[1] runs on a database
// still at version 1 and takes it to version 2, and so on. Schema v1
// (CLAUDE.md: src/data/db/mono_schema_v1.sql) is the baseline; a database created from it is
// brought up to date by these, on creation as well as on every later open (open.ts).
//   1 -> 2: transactions.source also accepts 'scan' (receipt scan).
//   2 -> 3: import_app_settings (which apps' notifications may be read for automatic import).
//   3 -> 4: one Valas (forex) account only (trigger forex_account_exists).
//   4 -> 5: every foreign currency the rate service serves can be held (more rows in `currencies`).
//   5 -> 6: "Perbarui otomatis" is on from the start (an older database's seeded '0' becomes '1').
//   6 -> 7: goal progress is clamped and no longer smoothed around 50%.
//   7 -> 8: categories are archived, never deleted: kind locked once used, last active category and a
//           category of an active fixed expense cannot be archived; seeded categories get their icon key.
//   8 -> 9: private, foreground-captured transaction locations; disabled by default.
//   9 -> 10: notifications inbox table + 12 new settings keys; maps backup_reminder -> notif_backup,
//            recurring_reminders -> notif_bill_h1 + notif_bill_overdue; cancels all old scheduled notifs.
//   10 -> 11: import_queue + import_merchant_memory (review queue of the notification import, parsed fields only);
//            transactions.source also accepts 'import'.
//   11 -> 12: card_links (an e-money card paired with an e-wallet account: issuer, last 4 digits, fingerprint) and the two
//            system categories of a balance adjustment; transactions.source also accepts 'nfc'.
//   12 -> 13: subcategories (optional labels inside a category) and transactions.subcategory_id.
export const migrations: Record<number, Migration> = {
  1: addScanSource,
  2: addImportAppSettings,
  3: addOneForexAccountGuard,
  4: addMoreCurrencies,
  5: turnOnFxAutoUpdate,
  6: clampGoalProgressView,
  7: addCategoryGuards,
  8: addTransactionLocations,
  9: addNotifications,
  10: addImportQueue,
  11: addNfcCardLinks,
  12: addSubcategories,
};

// The schema_version a database reaches once every migration above has run (never written by hand).
export const LATEST_SCHEMA_VERSION = Math.max(...Object.keys(migrations).map(Number)) + 1;

// Brings `db` from its current meta.schema_version up to the newest version this build
// knows about, one migration per exclusive transaction, oldest first. A safety backup
// before each step is src/data/backup's job once it exists (not yet — step 5).
// Returns the resulting schema_version.
// `stopAt` (tests only): stop once the database is at that version, instead of running every migration.
export async function runMigrations(db: Db, currentVersion: number, stopAt: number = Number.POSITIVE_INFINITY): Promise<number> {
  let version = currentVersion;
  while (migrations[version] && version < stopAt) {
    const migrate = migrations[version];
    const nextVersion = version + 1;
    await db.withExclusiveTransactionAsync(async txn => {
      await migrate(txn);
      await txn.runAsync("update meta set value = ? where key = 'schema_version'", [String(nextVersion)]);
    });
    version = nextVersion;
  }
  return version;
}
