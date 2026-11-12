// Keeping the database and the native listener in step. The native module is mocked; the database
// is the real one. What the listener reports is {package, name, time}, and that is all that is
// written. What is switched on becomes the native allowlist.
import { openMigratedTestDb } from '../../../../data/db/openTestDb';
import type { Db } from '../../../../data/db/types';
import { getImportApp, listImportApps } from '../../../../data/repo/importApps';
import { activateImportApp } from '../../../../domain/importApps';
import * as native from '../native';
import { pushAllowlist, syncImportApps } from '../sync';

jest.mock('../native', () => ({ getSeenApps: jest.fn(), setAllowedPackages: jest.fn() }));

const getSeen = native.getSeenApps as jest.Mock;
const setAllowed = native.setAllowedPackages as jest.Mock;
const NOW = '2026-11-03T10:00:00+07:00';

async function withAccount(): Promise<{ db: Db; account: number }> {
  const db = await openMigratedTestDb();
  const account = (await db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('BCA', 'bank', 0, '2026-01-01', ?)", [NOW])).lastInsertRowId;
  return { db, account };
}

beforeEach(() => {
  getSeen.mockReset();
  setAllowed.mockReset();
});

describe('syncImportApps', () => {
  test('seen apps become rows, off and without an account, with the time converted to WIB', async () => {
    const { db } = await withAccount();
    getSeen.mockReturnValue([{ package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: Date.UTC(2026, 10, 3, 0, 12, 0) }]);

    expect(await syncImportApps(db)).toEqual({ recorded: 1, allowed: [] });
    expect(await getImportApp(db, 'com.bca.mobile')).toEqual({
      package: 'com.bca.mobile',
      app_name: 'BCA mobile',
      enabled: 0,
      account_id: null,
      supported_level: 'generic',
      last_seen_at: '2026-11-03T07:12:00+07:00',
    });
    expect(setAllowed).toHaveBeenCalledWith([]);
  });

  test('nothing but the package, the name and the time is written, even if the listener sent more', async () => {
    const { db } = await withAccount();
    getSeen.mockReturnValue([{ package: 'com.sneaky', appName: 'Sneaky', lastSeenAt: 1_700_000_000_000, title: 'Transfer masuk', text: 'Rp 50.000 dari Budi' }]);
    await syncImportApps(db);
    expect(JSON.stringify(await listImportApps(db))).not.toMatch(/Transfer masuk|50\.000|Budi/);
  });

  test('the allowlist given to native is exactly the apps that are on', async () => {
    const { db, account } = await withAccount();
    getSeen.mockReturnValue([
      { package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: 1_700_000_000_000 },
      { package: 'com.gojek.gopay', appName: 'GoPay', lastSeenAt: 1_700_000_100_000 },
    ]);
    await syncImportApps(db);
    await activateImportApp(db, 'com.bca.mobile', account);

    const result = await syncImportApps(db);
    expect(result.allowed).toEqual(['com.bca.mobile']);
    expect(setAllowed).toHaveBeenLastCalledWith(['com.bca.mobile']);
  });

  test('a build without the native module records nothing and gives native an empty list', async () => {
    const { db } = await withAccount();
    getSeen.mockReturnValue([]);
    expect(await syncImportApps(db)).toEqual({ recorded: 0, allowed: [] });
  });

  test('broken entries from native are skipped, not written', async () => {
    const { db } = await withAccount();
    getSeen.mockReturnValue([{ package: '', appName: 'x', lastSeenAt: 1 }, { package: 'com.ok', appName: 'OK', lastSeenAt: 1_700_000_000_000 }, 'junk']);
    expect((await syncImportApps(db)).recorded).toBe(1);
    expect((await listImportApps(db)).map(a => a.package)).toEqual(['com.ok']);
  });
});

describe('pushAllowlist', () => {
  test('after a switch the new list goes to native at once', async () => {
    const { db, account } = await withAccount();
    getSeen.mockReturnValue([{ package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: 1_700_000_000_000 }]);
    await syncImportApps(db);
    await activateImportApp(db, 'com.bca.mobile', account);
    expect(await pushAllowlist(db)).toEqual(['com.bca.mobile']);
    expect(setAllowed).toHaveBeenLastCalledWith(['com.bca.mobile']);
  });
});
