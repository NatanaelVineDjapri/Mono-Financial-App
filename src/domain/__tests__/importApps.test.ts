// Per-app import settings: activation needs a rupiah account, the schema is the backstop, seen apps
// are written without anything but their name, and the database has no place for message text.
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { getImportApp, listImportApps } from '../../data/repo/importApps';
import { activateImportApp, allowedPackages, deactivateImportApp, ImportAppError, pendingReviewCount, recordSeenApps, setImportAppAccount } from '../importApps';

const NOW = '2026-11-03T10:00:00+07:00';
const level = () => 'generic' as const;

async function fixture(): Promise<{ db: Db; bca: number; gopay: number; valas: number }> {
  const db = await openMigratedTestDb();
  const add = async (name: string, type: string) =>
    (await db.runAsync('insert into accounts (name, type, opening_balance, opening_date, created_at) values (?, ?, 0, ?, ?)', [name, type, '2026-01-01', NOW])).lastInsertRowId;
  const bca = await add('BCA Tabungan', 'bank');
  const gopay = await add('GoPay', 'ewallet');
  const valas = await add('Valas', 'forex');
  await recordSeenApps(
    db,
    [
      { package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: '2026-11-03T07:12:00+07:00' },
      { package: 'com.gojek.gopay', appName: 'GoPay', lastSeenAt: '2026-11-03T08:00:00+07:00' },
    ],
    level,
  );
  return { db, bca, gopay, valas };
}

describe('recordSeenApps', () => {
  test('a seen app starts off, with no account, at the general level', async () => {
    const { db } = await fixture();
    expect(await getImportApp(db, 'com.bca.mobile')).toEqual({
      package: 'com.bca.mobile',
      app_name: 'BCA mobile',
      enabled: 0,
      account_id: null,
      supported_level: 'generic',
      last_seen_at: '2026-11-03T07:12:00+07:00',
    });
  });

  test('seen again: the name and time move, the switch and the account stay', async () => {
    const { db, bca } = await fixture();
    await activateImportApp(db, 'com.bca.mobile', bca);
    await recordSeenApps(db, [{ package: 'com.bca.mobile', appName: 'BCA mobile v2', lastSeenAt: '2026-11-04T09:00:00+07:00' }], level);
    expect(await getImportApp(db, 'com.bca.mobile')).toMatchObject({ app_name: 'BCA mobile v2', enabled: 1, account_id: bca, last_seen_at: '2026-11-04T09:00:00+07:00' });
  });

  test('an older sighting never moves the time backwards', async () => {
    const { db } = await fixture();
    await recordSeenApps(db, [{ package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: '2026-10-01T00:00:00+07:00' }], level);
    expect((await getImportApp(db, 'com.bca.mobile'))?.last_seen_at).toBe('2026-11-03T07:12:00+07:00');
  });

  test('the level comes from the parser registry the caller passes', async () => {
    const { db } = await fixture();
    await recordSeenApps(db, [{ package: 'id.dana', appName: 'DANA', lastSeenAt: NOW }], pkg => (pkg === 'id.dana' ? 'full' : 'generic'));
    expect((await getImportApp(db, 'id.dana'))?.supported_level).toBe('full');
  });

  test('empty packages are skipped and a missing name falls back to the package', async () => {
    const { db } = await fixture();
    expect(await recordSeenApps(db, [{ package: '  ', appName: 'x', lastSeenAt: NOW }, { package: 'com.x.y', appName: '', lastSeenAt: NOW }], level)).toBe(1);
    expect((await getImportApp(db, 'com.x.y'))?.app_name).toBe('com.x.y');
  });

  test('only a package, a name and a time are written: the table has no column for message text', async () => {
    const { db } = await fixture();
    const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(import_app_settings)')).map(c => c.name).sort();
    expect(columns).toEqual(['account_id', 'app_name', 'enabled', 'last_seen_at', 'package', 'supported_level']);
    // A sighting that carries extra fields (a title, a text) stores none of them.
    const sneaky = { package: 'com.sneaky', appName: 'Sneaky', lastSeenAt: NOW, title: 'Transfer masuk', text: 'Rp 50.000 dari Budi' } as never;
    await recordSeenApps(db, [sneaky], level);
    const row = JSON.stringify(await getImportApp(db, 'com.sneaky'));
    expect(row).not.toMatch(/Transfer masuk|50\.000|Budi/);
  });
});

describe('activation needs an account', () => {
  test('switching an app on with no account is refused and it stays off', async () => {
    const { db } = await fixture();
    await expect(activateImportApp(db, 'com.bca.mobile', null)).rejects.toMatchObject({ code: 'needs_account' });
    expect((await getImportApp(db, 'com.bca.mobile'))?.enabled).toBe(0);
  });

  test('with a rupiah account it turns on and the account is stored', async () => {
    const { db, bca } = await fixture();
    expect(await activateImportApp(db, 'com.bca.mobile', bca)).toMatchObject({ enabled: 1, account_id: bca });
    expect(await getImportApp(db, 'com.bca.mobile')).toMatchObject({ enabled: 1, account_id: bca });
  });

  test('a Valas account is refused', async () => {
    const { db, valas } = await fixture();
    await expect(activateImportApp(db, 'com.bca.mobile', valas)).rejects.toMatchObject({ code: 'account_not_rupiah' });
    expect((await getImportApp(db, 'com.bca.mobile'))?.enabled).toBe(0);
  });

  test('an account that does not exist or is archived is refused', async () => {
    const { db, gopay } = await fixture();
    await expect(activateImportApp(db, 'com.bca.mobile', 9999)).rejects.toMatchObject({ code: 'account_missing' });
    await db.runAsync('update accounts set archived = 1 where id = ?', [gopay]);
    await expect(activateImportApp(db, 'com.gojek.gopay', gopay)).rejects.toMatchObject({ code: 'account_missing' });
  });

  test('an app that was never seen is unknown', async () => {
    const { db, bca } = await fixture();
    await expect(activateImportApp(db, 'com.nobody', bca)).rejects.toBeInstanceOf(ImportAppError);
    await expect(activateImportApp(db, 'com.nobody', bca)).rejects.toMatchObject({ code: 'unknown_app' });
  });

  test('switching off keeps the account, so switching on again needs no choice', async () => {
    const { db, bca } = await fixture();
    await activateImportApp(db, 'com.bca.mobile', bca);
    await deactivateImportApp(db, 'com.bca.mobile');
    expect(await getImportApp(db, 'com.bca.mobile')).toMatchObject({ enabled: 0, account_id: bca });
    expect(await activateImportApp(db, 'com.bca.mobile', null)).toMatchObject({ enabled: 1, account_id: bca });
  });

  test('taking the account away switches the app off; changing it keeps the switch', async () => {
    const { db, bca, gopay } = await fixture();
    await activateImportApp(db, 'com.bca.mobile', bca);
    await setImportAppAccount(db, 'com.bca.mobile', gopay);
    expect(await getImportApp(db, 'com.bca.mobile')).toMatchObject({ enabled: 1, account_id: gopay });
    await setImportAppAccount(db, 'com.bca.mobile', null);
    expect(await getImportApp(db, 'com.bca.mobile')).toMatchObject({ enabled: 0, account_id: null });
  });
});

describe('the schema is the backstop', () => {
  test('a row cannot be on without an account, whatever wrote it', async () => {
    const { db } = await fixture();
    await expect(db.runAsync("update import_app_settings set enabled = 1 where package = 'com.bca.mobile'")).rejects.toThrow(/CHECK constraint failed/);
  });

  test('a row cannot point at a Valas account: import_needs_idr_account', async () => {
    const { db, valas } = await fixture();
    await expect(db.runAsync("update import_app_settings set account_id = ? where package = 'com.bca.mobile'", [valas])).rejects.toThrow('import_needs_idr_account');
    await expect(
      db.runAsync("insert into import_app_settings (package, app_name, account_id, last_seen_at) values ('com.v', 'V', ?, ?)", [valas, NOW]),
    ).rejects.toThrow('import_needs_idr_account');
  });

  test('an account that apps point at cannot be deleted', async () => {
    const { db, bca } = await fixture();
    await activateImportApp(db, 'com.bca.mobile', bca);
    await expect(db.runAsync('delete from accounts where id = ?', [bca])).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('what the native listener is allowed to forward', () => {
  test('exactly the apps that are on', async () => {
    const { db, bca, gopay } = await fixture();
    expect(await allowedPackages(db)).toEqual([]);
    await activateImportApp(db, 'com.gojek.gopay', gopay);
    await activateImportApp(db, 'com.bca.mobile', bca);
    expect(await allowedPackages(db)).toEqual(['com.bca.mobile', 'com.gojek.gopay']);
    await deactivateImportApp(db, 'com.bca.mobile');
    expect(await allowedPackages(db)).toEqual(['com.gojek.gopay']);
  });

  test('switched-on apps are listed first, then the most recently seen', async () => {
    const { db, bca } = await fixture();
    expect((await listImportApps(db)).map(a => a.package)).toEqual(['com.gojek.gopay', 'com.bca.mobile']);
    await activateImportApp(db, 'com.bca.mobile', bca);
    expect((await listImportApps(db)).map(a => a.package)).toEqual(['com.bca.mobile', 'com.gojek.gopay']);
  });

  test('no review queue yet: nothing waits for review', async () => {
    const { db } = await fixture();
    expect(await pendingReviewCount(db)).toBe(0);
  });
});
