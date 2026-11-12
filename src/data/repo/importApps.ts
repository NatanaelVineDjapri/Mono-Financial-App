// import_app_settings (docs/IMPORT_PLAN.md): which apps' notifications MONO may read for automatic
// import, and the MONO account each one's transactions go to. SQL in, plain objects out; the rules
// (an app needs an account to be switched on, a rupiah one) live in src/domain/importApps.ts.
// Metadata only: there is no place here for a notification's title or text.
import type { Db } from '../db/types';

export type SupportedLevel = 'full' | 'generic';

export interface ImportAppRow {
  package: string;
  app_name: string;
  enabled: number; // 0 or 1
  account_id: number | null;
  supported_level: SupportedLevel;
  last_seen_at: string;
}

// Switched-on apps first, then the most recently seen.
export async function listImportApps(db: Db): Promise<ImportAppRow[]> {
  return db.getAllAsync<ImportAppRow>('select * from import_app_settings order by enabled desc, last_seen_at desc, app_name collate nocase');
}

export async function getImportApp(db: Db, pkg: string): Promise<ImportAppRow | null> {
  return db.getFirstAsync<ImportAppRow>('select * from import_app_settings where package = $pkg', { $pkg: pkg });
}

// A newly seen app starts off with no account. One already known keeps its switch and its account;
// only its name, level and last-seen time move (the latest time wins).
export async function upsertSeenApp(db: Db, app: { package: string; appName: string; level: SupportedLevel; lastSeenAt: string }): Promise<void> {
  await db.runAsync(
    `insert into import_app_settings (package, app_name, enabled, account_id, supported_level, last_seen_at)
     values ($pkg, $name, 0, null, $level, $seen)
     on conflict(package) do update set
       app_name = excluded.app_name,
       supported_level = excluded.supported_level,
       last_seen_at = max(import_app_settings.last_seen_at, excluded.last_seen_at)`,
    { $pkg: app.package, $name: app.appName, $level: app.level, $seen: app.lastSeenAt },
  );
}

export async function setImportAppState(db: Db, pkg: string, state: { enabled: boolean; accountId: number | null }): Promise<void> {
  await db.runAsync('update import_app_settings set enabled = $enabled, account_id = $accountId where package = $pkg', {
    $pkg: pkg,
    $enabled: state.enabled ? 1 : 0,
    $accountId: state.accountId,
  });
}

export async function listEnabledPackages(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ package: string }>('select package from import_app_settings where enabled = 1 order by package');
  return rows.map(r => r.package);
}
