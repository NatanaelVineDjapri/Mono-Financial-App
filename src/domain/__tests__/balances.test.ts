import { createAccount, createValasAccount } from '../accounts';
import { insertFxRate } from '../../data/repo/fx';
import { openTestDb } from '../../data/db/openTestDb';
import { getAccountBalance, getPocketValue, listAccountBalances, listPocketBalances, listPocketValues } from '../balances';

const NOW = '2026-01-01T00:00:00+07:00';

describe('domain balances', () => {
  test('getAccountBalance / listAccountBalances read from the view, not a stored column', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
    expect(await getAccountBalance(db, id)).toEqual({ id, name: 'BCA', type: 'bank', archived: 0, balance: 1200000, missing_rates: 0 });
    expect(await listAccountBalances(db)).toEqual([{ id, name: 'BCA', type: 'bank', archived: 0, balance: 1200000, missing_rates: 0 }]);
  });

  test('pocket balances: raw balance vs rupiah value, before and after a rate exists', async () => {
    const db = openTestDb();
    const id = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 25000 }] }, NOW);

    expect(await listPocketBalances(db, id)).toEqual([{ account_id: id, currency: 'USD', minor_factor: 100, archived: 0, balance: 25000 }]);
    expect(await getPocketValue(db, id, 'USD')).toEqual({ account_id: id, currency: 'USD', balance: 25000, rate_e4: null, rate_at: null, value_idr: null });

    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    expect((await listPocketValues(db, id))[0].value_idr).toBe(4062500);
  });
});
