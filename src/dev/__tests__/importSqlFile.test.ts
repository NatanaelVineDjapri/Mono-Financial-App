// Replacing the data with a .sql file: all or nothing, checked by the same integrity view a restore uses.
import { createAccount } from '../../domain/accounts';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { ImportIntegrityError, importSqlText } from '../importSqlFile';

// expo-file-system has no native side under Jest; only the file picker (not tested here) uses it.
jest.mock('expo-file-system', () => ({ File: { pickFileAsync: jest.fn() } }));

const NOW = '2026-11-03T10:00:00+07:00';

const GOOD = `
BEGIN;
UPDATE meta SET value = '1' WHERE key = 'guards_off';
INSERT INTO accounts (name, type, opening_balance, opening_date, icon, sort_order, archived, created_at) VALUES ('Dompet', 'cash', 5000, '2026-01-01', NULL, 0, 0, '2026-01-01T00:00:00+07:00');
INSERT OR IGNORE INTO categories (name, kind, icon, sort_order, archived) VALUES ('Jajan', 'expense', 'food', 100, 0);
INSERT INTO transactions (kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at)
  VALUES ('expense', (SELECT id FROM accounts WHERE name = 'Dompet'), 'IDR', NULL, NULL, (SELECT id FROM categories WHERE name = 'Jajan' AND kind = 'expense'), 2000, NULL, 2000, '2026-02-01', 'Bakso', NULL, 'manual', '2026-02-01T12:00:00+07:00', '2026-02-01T12:00:00+07:00');
UPDATE meta SET value = '0' WHERE key = 'guards_off';
COMMIT;
`;

// Spends more than the account holds, with the guards off: only the integrity check can notice.
const OVERSPENT = GOOD.replace("2000, NULL, 2000,", "9000, NULL, 9000,");

const balances = (db: Db) => db.getAllAsync<{ name: string; balance: number }>('select name, balance from v_account_balance order by name');

async function withOldData(): Promise<Db> {
  const db = await openMigratedTestDb();
  await createAccount(db, { name: 'Old account', type: 'bank', openingBalance: 100000, openingDate: '2026-01-01' }, NOW);
  return db;
}

describe('importSqlText', () => {
  test('replaces what was there with the file, and says how much came in', async () => {
    const db = await withOldData();
    const summary = await importSqlText(db, GOOD);
    expect(summary).toEqual({ accounts: 1, transactions: 1 });
    expect(await balances(db)).toEqual([{ name: 'Dompet', balance: 3000 }]);
  });

  test('the script\'s own BEGIN and COMMIT are dropped, the guards end up back on, and a transaction is not left open', async () => {
    const db = await withOldData();
    await importSqlText(db, GOOD);
    expect(await db.getFirstAsync("select value from meta where key = 'guards_off'")).toEqual({ value: '0' });
    await expect(importSqlText(db, GOOD)).resolves.toEqual({ accounts: 1, transactions: 1 }); // a second run is not blocked
  });

  test('a file that fails the integrity check is refused whole: the old data is still there', async () => {
    const db = await withOldData();
    await expect(importSqlText(db, OVERSPENT)).rejects.toBeInstanceOf(ImportIntegrityError);
    expect(await balances(db)).toEqual([{ name: 'Old account', balance: 100000 }]);
    expect(await db.getFirstAsync("select value from meta where key = 'guards_off'")).toEqual({ value: '0' });
  });

  test('a file with an error in it is refused whole too', async () => {
    const db = await withOldData();
    await expect(importSqlText(db, GOOD.replace('INSERT INTO transactions', 'INSERT INTO no_such_table'))).rejects.toThrow(/no such table/);
    expect(await balances(db)).toEqual([{ name: 'Old account', balance: 100000 }]);
  });

  test('the error says what is wrong in words that name the problem, not a stack', async () => {
    const db = await withOldData();
    await expect(importSqlText(db, OVERSPENT)).rejects.toThrow(/integrity check.*negative_balance/);
  });
});
