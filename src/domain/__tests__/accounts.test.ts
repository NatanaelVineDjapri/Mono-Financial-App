import { openTestDb } from '../../data/db/openTestDb';
import { listAccounts, listPockets } from '../../data/repo/accounts';
import { DomainError, UnexpectedDbError } from '../errors';
import { addPocket, archiveAccount, archivePocket, createAccount, createValasAccount, updateAccount } from '../accounts';

const NOW = '2026-01-01T00:00:00+07:00';

describe('domain accounts', () => {
  test('createAccount then updateAccount then archiveAccount', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    await updateAccount(db, id, { name: 'BCA Tabungan' });
    await archiveAccount(db, id);

    expect(await listAccounts(db)).toEqual([]);
    expect((await listAccounts(db, { includeArchived: true }))[0].name).toBe('BCA Tabungan');
  });

  test('createValasAccount sets up the account and every starting pocket in one call', async () => {
    const db = openTestDb();
    const id = await createValasAccount(
      db,
      { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 25000 }, { currency: 'SGD', openingBalance: 20000 }] },
      NOW,
    );
    const pockets = await listPockets(db, id);
    expect(pockets.map(p => [p.currency, p.balance])).toEqual([
      ['SGD', 20000],
      ['USD', 25000],
    ]);
  });

  test('addPocket on a non-forex account surfaces as a DomainError', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await expect(addPocket(db, id, 'USD', 0, '2026-01-01')).rejects.toThrow(DomainError);
    await expect(addPocket(db, id, 'USD', 0, '2026-01-01')).rejects.toMatchObject({ code: 'pocket_needs_forex_account' });
  });

  test('archivePocket pre-checks: blocks a non-empty pocket without hitting SQL twice', async () => {
    const db = openTestDb();
    const id = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 25000 }] }, NOW);
    await expect(archivePocket(db, id, 'USD')).rejects.toMatchObject({ code: 'pocket_not_empty' });
    expect((await listPockets(db, id))[0].currency).toBe('USD'); // still there, not archived
  });

  test('archivePocket succeeds for an empty pocket', async () => {
    const db = openTestDb();
    const id = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'EUR', openingBalance: 0 }] }, NOW);
    await archivePocket(db, id, 'EUR');
    expect((await listPockets(db, id))[0].currency).toBe('EUR');
  });

  test('an unrecognised SQL error (duplicate name) surfaces as UnexpectedDbError, not silently dropped', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await expect(createAccount(db, { name: 'gopay', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01' }, NOW)).rejects.toThrow(UnexpectedDbError);
  });
});
