// A backup that holds a scanned receipt (source 'scan', schema v2) exports and restores whole, and a
// v1 backup (made before the migration) still restores onto the current database.
import { createHash } from 'crypto';

import { createAccount } from '../../../domain/accounts';
import { addExpense } from '../../../domain/transactions';
import { openMigratedTestDb } from '../../db/openTestDb';
import { listCategories } from '../../repo/categories';
import { canonicalDataJson, exportBackup } from '../export';
import { restoreBackup } from '../restore';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture() {
  const db = await openMigratedTestDb();
  const account = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
  const shopping = (await listCategories(db)).find(c => c.name === 'Shopping')!.id;
  await addExpense(db, { accountId: account, currency: 'IDR', categoryId: shopping, amount: 48000, occurredOn: '2026-10-28', description: 'Toko Sumber Rejeki', source: 'scan' }, NOW);
  return { db, account };
}

describe('backups and source scan', () => {
  test('the file records schema version 4 and the scan source', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    expect(file.schema_version).toBe(6);
    expect((file.data.transactions as { source: string }[]).map(t => t.source)).toEqual(['scan']);
  });

  test('exporting then restoring onto another current database keeps the scanned record and its numbers', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);

    const target = await openMigratedTestDb();
    const result = await restoreBackup(target, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.getFirstAsync('select source, amount, description from transactions')).toEqual({ source: 'scan', amount: 48000, description: 'Toko Sumber Rejeki' });
    expect(await target.getFirstAsync("select balance from v_account_balance where name = 'Cash wallet'")).toEqual({ balance: 402000 });
  });

  test('a backup made on schema v1 (no scan records) still restores', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    // What a v1 build wrote: its own version number and no scan source.
    const v1Data = { ...file.data, transactions: (file.data.transactions as { source: string }[]).map(t => ({ ...t, source: 'manual' })) };
    const { checksum: _drop, ...rest } = file;
    void _drop;
    const v1 = { ...rest, schema_version: 1, data: v1Data, checksum: `sha256:${await sha256Hex(canonicalDataJson(v1Data as never))}` };

    const target = await openMigratedTestDb();
    const result = await restoreBackup(target, JSON.stringify(v1), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.getFirstAsync('select source from transactions')).toEqual({ source: 'manual' });
  });
});
