import { createHash } from 'crypto';
import { createAccount, createValasAccount } from '../../../domain/accounts';
import { getAccountBalance } from '../../../domain/balances';
import { getNetWorth } from '../../../domain/net-worth';
import { addExpense, addIncome, addTransfer } from '../../../domain/transactions';
import { listCategories } from '../../repo/categories';
import { insertFxRate } from '../../repo/fx';
import { openTestDb } from '../../db/openTestDb';
import { canonicalDataJson, exportBackup } from '../export';
import { restoreBackup } from '../restore';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

async function richFixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago', type: 'savings', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (n: string) => categories.find(c => c.name === n)!.id;

  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, occurredOn: '2026-01-10' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 300000, occurredOn: '2026-01-15' }, NOW);
  await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: jago, amount: 500000, occurredOn: '2026-01-20' }, NOW);

  const valas = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 10000 }] }, NOW);
  await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');

  return { db, bca, jago, valas };
}

describe('restoreBackup: roundtrip', () => {
  test('exporting then restoring onto a different, pre-existing database gives the same numbers back', async () => {
    const source = await richFixture();
    const sourceNetWorth = await getNetWorth(source.db);
    const sourceBca = await getAccountBalance(source.db, source.bca);
    const file = await exportBackup(source.db, NOW, sha256Hex);

    // A different database, with its own unrelated data, standing in for "the device
    // being restored onto".
    const target = openTestDb();
    await createAccount(target, { name: 'Unrelated account', type: 'cash', openingBalance: 999, openingDate: '2026-01-01' }, NOW);

    const result = await restoreBackup(target, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);

    expect(await getNetWorth(target)).toEqual(sourceNetWorth);
    const restoredBca = await target.getFirstAsync("select id from accounts where name = 'BCA'");
    expect(restoredBca).not.toBeNull();
    const restoredBalance = await getAccountBalance(target, (restoredBca as { id: number }).id);
    expect(restoredBalance?.balance).toBe(sourceBca?.balance);
    // the unrelated account from before the restore is gone — the file is a full snapshot
    expect(await target.getFirstAsync("select 1 from accounts where name = 'Unrelated account'")).toBeNull();
  });
});

describe('restoreBackup: a bad file never touches the database', () => {
  test('not valid JSON', async () => {
    const db = openTestDb();
    const before = await getNetWorth(db);
    const result = await restoreBackup(db, '{not json', NOW, sha256Hex);
    expect(result).toMatchObject({ ok: false, reason: 'invalid', detail: { reason: 'not_json' } });
    expect(await getNetWorth(db)).toEqual(before);
  });

  test('a newer schema version is rejected before anything is touched', async () => {
    const { db } = await richFixture();
    const before = await getNetWorth(db);
    const file = await exportBackup(db, NOW, sha256Hex);
    const result = await restoreBackup(db, JSON.stringify({ ...file, schema_version: 99 }), NOW, sha256Hex);
    expect(result).toMatchObject({ ok: false, reason: 'invalid', detail: { reason: 'newer_schema_version' } });
    expect(await getNetWorth(db)).toEqual(before);
  });
});

describe('restoreBackup: rolls back entirely when the post-load integrity audit finds something', () => {
  test('a row that would leave a negative balance is rolled back, not partially restored', async () => {
    const db = openTestDb();
    const accountId = await createAccount(db, { name: 'A', type: 'cash', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
    const file = await exportBackup(db, NOW, sha256Hex);

    // A well-formed row (every reference resolves) whose amount the account cannot
    // actually cover — validateBackup's reference check cannot catch this; only the
    // post-load v_integrity_issues audit can.
    const badTransaction = {
      id: 1, kind: 'expense', account_id: accountId, currency: 'IDR', to_account_id: null, to_currency: null,
      category_id: categoryId, amount: 100000, amount_to: null, amount_idr: 100000, occurred_on: '2026-01-05',
      description: '', note: null, source: 'manual', created_at: NOW, updated_at: NOW,
    };
    const tamperedData = { ...file.data, transactions: [badTransaction] };
    const tamperedCounts = { ...file.counts, transactions: 1 };
    const checksum = `sha256:${await sha256Hex(canonicalDataJson(tamperedData))}`;
    const bad = { ...file, data: tamperedData, counts: tamperedCounts, checksum };

    const backupLogBefore = await db.getAllAsync('select * from backup_log');
    const result = await restoreBackup(db, JSON.stringify(bad), NOW, sha256Hex);

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'integrity_check_failed') {
      expect(result.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error(`expected integrity_check_failed, got ${JSON.stringify(result)}`);
    }

    // rolled back completely: still the original empty state, guards back on
    expect(await getAccountBalance(db, accountId)).toMatchObject({ balance: 0 });
    expect(await db.getAllAsync('select * from transactions')).toEqual([]);
    expect(await db.getFirstAsync("select value from meta where key = 'guards_off'")).toEqual({ value: '0' });
    expect(await db.getAllAsync('select * from backup_log')).toEqual(backupLogBefore);
  });
});

describe('restoreBackup: never touches backup_log', () => {
  test('a successful restore leaves backup_log exactly as it was', async () => {
    const source = await richFixture();
    const file = await exportBackup(source.db, NOW, sha256Hex);

    const target = openTestDb();
    await target.runAsync(
      "insert into backup_log (created_at, file_name, size_bytes, tx_count, kind) values ($createdAt, $fileName, $sizeBytes, $txCount, $kind)",
      { $createdAt: NOW, $fileName: 'pre-existing.json', $sizeBytes: 10, $txCount: 0, $kind: 'manual' },
    );
    const before = await target.getAllAsync('select * from backup_log');

    const result = await restoreBackup(target, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.getAllAsync('select * from backup_log')).toEqual(before);
  });

  test('requesting a safety backup returns it to the caller instead of logging it', async () => {
    const { db } = await richFixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    const before = await db.getAllAsync('select * from backup_log');

    const result = await restoreBackup(db, JSON.stringify(file), NOW, sha256Hex, { takeSafetyBackup: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.safetyBackup).not.toBeNull();
      expect(result.safetyBackup?.app).toBe('mono-finance');
    }
    expect(await db.getAllAsync('select * from backup_log')).toEqual(before);
  });
});
