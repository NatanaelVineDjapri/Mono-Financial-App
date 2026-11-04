import { createHash } from 'crypto';
import { createAccount } from '../../../domain/accounts';
import { addIncome } from '../../../domain/transactions';
import { listCategories } from '../../repo/categories';
import { openTestDb } from '../../db/openTestDb';
import { BACKUP_TABLES, exportBackup } from '../export';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

describe('exportBackup', () => {
  test('eleven tables, no currencies/meta/backup_log', () => {
    expect(BACKUP_TABLES).toHaveLength(11);
    expect(BACKUP_TABLES).not.toContain('currencies');
    expect(BACKUP_TABLES).not.toContain('meta');
    expect(BACKUP_TABLES).not.toContain('backup_log');
  });

  test('counts match the data arrays, schema_version comes from meta', async () => {
    const db = openTestDb();
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const categoryId = (await listCategories(db, { kind: 'income' }))[0].id;
    await addIncome(db, { accountId, currency: 'IDR', categoryId, amount: 500000, occurredOn: '2026-01-05' }, NOW);

    const file = await exportBackup(db, NOW, sha256Hex);

    expect(file.app).toBe('mono-finance');
    expect(file.schema_version).toBe(1);
    expect(file.exported_at).toBe(NOW);
    expect(file.currency).toBe('IDR');
    expect(file.counts.accounts).toBe(1);
    expect(file.counts.transactions).toBe(1);
    expect(file.data.accounts.length).toBe(file.counts.accounts);
    expect(file.data.categories.length).toBe(file.counts.categories); // the 14 seeded categories
    for (const table of BACKUP_TABLES) {
      expect(file.data[table].length).toBe(file.counts[table]);
    }
  });

  test('the checksum is reproducible from the same data', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const file = await exportBackup(db, NOW, sha256Hex);
    const second = await exportBackup(db, NOW, sha256Hex);
    expect(second.checksum).toBe(file.checksum);
    expect(file.checksum.startsWith('sha256:')).toBe(true);
  });
});
