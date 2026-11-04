import { openTestDb } from '../../db/openTestDb';
import { addPocket, archivePocket, createAccount, getAccount, getPocket, listAccounts, listPockets, updateAccount } from '../accounts';

const NOW = '2026-01-01T00:00:00+07:00';

describe('accounts repo', () => {
  test('create, read and update a plain account', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    expect(await getAccount(db, id)).toEqual({ id, name: 'BCA', type: 'bank', archived: 0, balance: 1000000, missing_rates: 0 });

    await updateAccount(db, id, { name: 'BCA Tabungan' });
    expect((await getAccount(db, id))?.name).toBe('BCA Tabungan');
  });

  test('listAccounts excludes archived by default', async () => {
    const db = openTestDb();
    const a = await createAccount(db, { name: 'A', type: 'cash', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'B', type: 'cash', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await updateAccount(db, a, { archived: true });

    expect((await listAccounts(db)).map(x => x.name)).toEqual(['B']);
    expect((await listAccounts(db, { includeArchived: true })).map(x => x.name)).toEqual(['A', 'B']);
  });

  test('forex account pockets: add, value with no rate yet', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'Valas', type: 'forex', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await addPocket(db, id, 'USD', 25000, '2026-01-01');

    const pockets = await listPockets(db, id);
    expect(pockets).toEqual([{ account_id: id, currency: 'USD', balance: 25000, rate_e4: null, rate_at: null, value_idr: null }]);
  });

  test('a pocket that still holds money cannot be archived (pocket_not_empty)', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'Valas', type: 'forex', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await addPocket(db, id, 'USD', 25000, '2026-01-01');
    await expect(archivePocket(db, id, 'USD')).rejects.toThrow(/pocket_not_empty/);
  });

  test('an empty pocket can be archived', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'Valas', type: 'forex', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await addPocket(db, id, 'EUR', 0, '2026-01-01');
    await archivePocket(db, id, 'EUR');
    expect((await listPockets(db, id))[0].currency).toBe('EUR');
  });

  test('getPocket reads opening balance/date from v_pocket, including the implicit IDR pocket', async () => {
    const db = openTestDb();
    const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    expect(await getPocket(db, bca, 'IDR')).toEqual({ account_id: bca, currency: 'IDR', opening_balance: 1000000, opening_date: '2026-01-01', archived: 0 });

    const valas = await createAccount(db, { name: 'Valas', type: 'forex', openingBalance: 0, openingDate: '2026-02-01' }, NOW);
    await addPocket(db, valas, 'USD', 25000, '2026-03-01');
    expect(await getPocket(db, valas, 'USD')).toEqual({ account_id: valas, currency: 'USD', opening_balance: 25000, opening_date: '2026-03-01', archived: 0 });
    expect(await getPocket(db, valas, 'SGD')).toBeNull();
  });
});
