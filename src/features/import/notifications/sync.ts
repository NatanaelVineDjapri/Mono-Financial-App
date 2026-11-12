// Keeping the database and the native listener in step (docs/IMPORT_PLAN.md, section 3):
//   - the apps the listener has seen (name, time; never text) become rows of import_app_settings,
//     off and without an account until the person sets them up;
//   - the apps that are switched on become the native allowlist, so the service forwards exactly
//     those.
// Run when the app opens, when it comes back to the front, and after every change of settings.
import { isoFromMillis } from '../../../core/clock';
import type { Db } from '../../../data/db/types';
import { allowedPackages, recordSeenApps } from '../../../domain/importApps';
import { supportLevel } from '../parsers/registry';
import { sanitizeSeenApps } from './allowlist';
import * as native from './native';

export async function syncImportApps(db: Db): Promise<{ recorded: number; allowed: string[] }> {
  const seen = sanitizeSeenApps(native.getSeenApps());
  const recorded = await recordSeenApps(
    db,
    seen.map(s => ({ package: s.package, appName: s.appName, lastSeenAt: isoFromMillis(s.lastSeenAt) })),
    supportLevel,
  );
  const allowed = await allowedPackages(db);
  native.setAllowedPackages(allowed);
  return { recorded, allowed };
}

// After a switch or an account changed: tell the listener the new allowlist at once.
export async function pushAllowlist(db: Db): Promise<string[]> {
  const allowed = await allowedPackages(db);
  native.setAllowedPackages(allowed);
  return allowed;
}
