// Migration 2 -> 3 on a database with data: the new table appears, nothing that was there changes,
// and a backup restore still works when import settings exist (they are cleared, not restored).
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { createAccount } from '../../../../domain/accounts';
import { exportBackup } from '../../../backup/export';
import { restoreBackup } from '../../../backup/restore';
import { openMigratedTestDb, openTestDb } from '../../openTestDb';
import { runMigrations } from '../index';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../../tools/sample_data.sql'), 'utf8');
const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

describe('migration 2 -> 3: import_app_settings', () => {
  test('a database with data gets the table and keeps every number', async () => {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);
    const before = await db.getAllAsync('select * from v_account_balance order by 1');
    const netWorth = await db.getFirstAsync('select * from v_net_worth');

    await expect(runMigrations(db, 1)).resolves.toBe(6);

    expect(await db.getAllAsync('select * from v_account_balance order by 1')).toEqual(before);
    expect(await db.getFirstAsync('select * from v_net_worth')).toEqual(netWorth);
    expect(await db.getAllAsync('select * from import_app_settings')).toEqual([]);
  });

  test('it creates no column for message text', async () => {
    const db = await openMigratedTestDb();
    const columns = (await db.getAllAsync<{ name: string }>('pragma table_info(import_app_settings)')).map(c => c.name);
    expect(columns).not.toEqual(expect.arrayContaining(['text']));
    expect(columns.some(c => /title|text|body|message|content/i.test(c))).toBe(false);
  });

  test('running it twice changes nothing', async () => {
    const db = await openMigratedTestDb();
    const { addImportAppSettings } = jest.requireActual('../v3_import_app_settings');
    await expect(addImportAppSettings(db)).resolves.toBeUndefined();
  });
});

describe('restore with import settings present', () => {
  test('the settings are cleared (they map this phone\'s apps to accounts) and the restore succeeds', async () => {
    const source = await openMigratedTestDb();
    await createAccount(source, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const file = await exportBackup(source, NOW, sha256Hex);
    expect(Object.keys(file.data)).not.toContain('import_app_settings');

    const target = await openMigratedTestDb();
    const account = await createAccount(target, { name: 'Local', type: 'cash', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await target.runAsync("insert into import_app_settings (package, app_name, enabled, account_id, last_seen_at) values ('com.bca.mobile', 'BCA mobile', 1, ?, ?)", [account, NOW]);

    const result = await restoreBackup(target, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.getAllAsync('select * from import_app_settings')).toEqual([]);
    expect(await target.getFirstAsync("select name from accounts where name = 'BCA'")).toEqual({ name: 'BCA' });
  });
});
