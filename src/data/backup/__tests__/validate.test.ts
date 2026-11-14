import { createHash } from 'crypto';
import { createAccount } from '../../../domain/accounts';
import { addIncome } from '../../../domain/transactions';
import { listCategories } from '../../repo/categories';
import { openTestDb } from '../../db/openTestDb';
import { canonicalDataJson, exportBackup } from '../export';
import { validateBackup } from '../validate';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

async function validFile() {
  const db = openTestDb();
  await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const file = await exportBackup(db, NOW, sha256Hex);
  return file;
}

describe('validateBackup', () => {
  test('a freshly exported file validates', async () => {
    const file = await validFile();
    const result = await validateBackup(JSON.stringify(file), sha256Hex);
    expect(result.ok).toBe(true);
  });

  test('not valid JSON', async () => {
    expect(await validateBackup('{not json', sha256Hex)).toEqual({ ok: false, reason: 'not_json' });
  });

  test('wrong app marker', async () => {
    const file = await validFile();
    expect(await validateBackup(JSON.stringify({ ...file, app: 'some-other-app' }), sha256Hex)).toEqual({ ok: false, reason: 'wrong_app' });
  });

  test('a newer schema version is rejected', async () => {
    const file = await validFile();
    expect(await validateBackup(JSON.stringify({ ...file, schema_version: 9 }), sha256Hex)).toEqual({
      ok: false,
      reason: 'newer_schema_version',
      fileVersion: 9,
      supportedVersion: 8,
    });
  });

  test('a count that does not match its data array', async () => {
    const file = await validFile();
    const bad = { ...file, counts: { ...file.counts, accounts: file.counts.accounts + 1 } };
    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'count_mismatch', table: 'accounts' });
  });

  test('a tampered row that keeps the count but changes the checksum', async () => {
    const file = await validFile();
    const bad = { ...file, data: { ...file.data, accounts: [{ ...file.data.accounts[0], name: 'Tampered' }] } };
    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'checksum_mismatch' });
  });

  test('a missing table array', async () => {
    const file = await validFile();
    const bad = JSON.parse(JSON.stringify(file));
    delete bad.data.settings;
    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'missing_table', table: 'settings' });
  });

  test('a broken internal reference (a transaction pointing at an account not in the file)', async () => {
    const db = openTestDb();
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const categoryId = (await listCategories(db, { kind: 'income' }))[0].id;
    await addIncome(db, { accountId, currency: 'IDR', categoryId, amount: 500000, occurredOn: '2026-01-05' }, NOW);
    const file = await exportBackup(db, NOW, sha256Hex);

    // Recompute the checksum over tampered data so this specifically tests the
    // reference check, not the (already-covered) checksum check.
    const tamperedData = { ...file.data, transactions: [{ ...file.data.transactions[0], account_id: 999999 }] };
    const checksum = `sha256:${await sha256Hex(canonicalDataJson(tamperedData))}`;
    const bad = { ...file, data: tamperedData, checksum };

    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'broken_reference', table: 'transactions' });
  });
});
