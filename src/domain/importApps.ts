// The rules for automatic import's per-app settings (docs/IMPORT_PLAN.md). The schema is the real
// guard (a CHECK refuses "on without an account", a trigger refuses a Valas account); this runs
// first so the person gets a clear reason.
//
// An app can be switched on only with a MONO account to send its transactions to: a rupiah account
// that exists and is not archived. Without one it stays off. Taking the account away switches the
// app off. Nothing here reads or stores a notification: only {package, app name, last seen}.
import type { Db } from '../data/db/types';
import { getImportApp, listEnabledPackages, setImportAppState, upsertSeenApp, type ImportAppRow, type SupportedLevel } from '../data/repo/importApps';

export type ImportAppErrorCode = 'unknown_app' | 'needs_account' | 'account_missing' | 'account_not_rupiah';

export class ImportAppError extends Error {
  readonly code: ImportAppErrorCode;
  constructor(code: ImportAppErrorCode) {
    super(code);
    this.name = 'ImportAppError';
    this.code = code;
  }
}

export interface SeenApp {
  package: string;
  appName: string;
  lastSeenAt: string; // ISO instant
}

// What the native listener saw (the apps that posted a notification while off or on), written as
// rows. Nothing else about a notification ever reaches this function.
export async function recordSeenApps(db: Db, seen: readonly SeenApp[], levelOf: (pkg: string) => SupportedLevel): Promise<number> {
  const valid = seen
    .map(s => ({ package: s.package.trim(), appName: (s.appName.trim() || s.package.trim()).slice(0, 100), lastSeenAt: s.lastSeenAt }))
    .filter(s => s.package.length > 0 && s.package.length <= 255 && s.lastSeenAt.length > 0);
  if (valid.length === 0) return 0;
  await db.withExclusiveTransactionAsync(async txn => {
    for (const s of valid) await upsertSeenApp(txn, { ...s, level: levelOf(s.package) });
  });
  return valid.length;
}

async function checkAccount(db: Db, accountId: number): Promise<void> {
  const account = await db.getFirstAsync<{ type: string; archived: number }>('select type, archived from accounts where id = $id', { $id: accountId });
  if (!account || account.archived === 1) throw new ImportAppError('account_missing');
  if (account.type === 'forex') throw new ImportAppError('account_not_rupiah');
}

// Switch an app on, sending its transactions to `accountId`. Refused without an account.
export async function activateImportApp(db: Db, pkg: string, accountId: number | null): Promise<ImportAppRow> {
  const app = await getImportApp(db, pkg);
  if (!app) throw new ImportAppError('unknown_app');
  const target = accountId ?? app.account_id;
  if (target == null) throw new ImportAppError('needs_account');
  await checkAccount(db, target);
  await setImportAppState(db, pkg, { enabled: true, accountId: target });
  return { ...app, enabled: 1, account_id: target };
}

// Switch an app off. Its account is kept, so switching it back on needs no choice.
export async function deactivateImportApp(db: Db, pkg: string): Promise<void> {
  const app = await getImportApp(db, pkg);
  if (!app) throw new ImportAppError('unknown_app');
  await setImportAppState(db, pkg, { enabled: false, accountId: app.account_id });
}

// Change an app's account. A new account keeps the app's switch as it was; taking the account away
// (null) switches the app off, because an app without an account stays off.
export async function setImportAppAccount(db: Db, pkg: string, accountId: number | null): Promise<void> {
  const app = await getImportApp(db, pkg);
  if (!app) throw new ImportAppError('unknown_app');
  if (accountId == null) {
    await setImportAppState(db, pkg, { enabled: false, accountId: null });
    return;
  }
  await checkAccount(db, accountId);
  await setImportAppState(db, pkg, { enabled: app.enabled === 1, accountId });
}

// The allowlist the native listener is given: exactly the apps that are on.
export async function allowedPackages(db: Db): Promise<string[]> {
  return listEnabledPackages(db);
}

// "N transaksi menunggu tinjauan": there is no review queue yet, so it is always zero for now.
export async function pendingReviewCount(_db: Db): Promise<number> {
  return 0;
}
