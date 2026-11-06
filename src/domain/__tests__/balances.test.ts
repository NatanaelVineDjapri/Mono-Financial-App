import { createAccount, createValasAccount } from '../accounts';
import { insertFxRate } from '../../data/repo/fx';
import { openTestDb } from '../../data/db/openTestDb';
import { getAccountBalance, getAccountsOverview, getPocketValue, listAccountBalances, listPocketBalances, listPocketValues } from '../balances';

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

describe('getAccountsOverview (Accounts tab)', () => {
  async function buildIdrAccounts(db: ReturnType<typeof openTestDb>) {
    const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
    const cash = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
    const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
    const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-01-01' }, NOW);
    return { bca, cash, gopay, jago };
  }

  test('4 accounts, net worth Rp8.880.000, one group per type with the sample subtotals', async () => {
    const db = openTestDb();
    await buildIdrAccounts(db);

    const overview = await getAccountsOverview(db);

    expect(overview.netWorth).toBe(8880000);
    expect(overview.incomplete).toBe(false);
    expect(overview.accountCount).toBe(4);
    expect(overview.groups.map(g => ({ type: g.type, subtotal: g.subtotal, count: g.accounts.length }))).toEqual([
      { type: 'bank', subtotal: 6842500, count: 1 },
      { type: 'cash', subtotal: 450000, count: 1 },
      { type: 'ewallet', subtotal: 312500, count: 1 },
      { type: 'savings', subtotal: 1275000, count: 1 },
    ]);
  });

  test('a Valas account becomes its own forex group with per-pocket amounts and values', async () => {
    const db = openTestDb();
    await buildIdrAccounts(db);
    const valas = await createValasAccount(
      db,
      { name: 'Valas', openingDate: '2026-10-01', pockets: [{ currency: 'USD', openingBalance: 25000 }, { currency: 'SGD', openingBalance: 18000 }] },
      NOW,
    );
    await insertFxRate(db, 'USD', 162500000, '2026-10-28T09:00:00+07:00', 'api');
    await insertFxRate(db, 'SGD', 125000000, '2026-10-28T09:00:00+07:00', 'api');

    const overview = await getAccountsOverview(db);

    expect(overview.netWorth).toBe(8880000 + 4062500 + 2250000); // ≈ 15.192.500
    expect(overview.incomplete).toBe(false);
    expect(overview.accountCount).toBe(5);
    const forex = overview.groups.find(g => g.type === 'forex');
    expect(forex?.subtotal).toBe(4062500 + 2250000);
    const valasAccount = forex?.accounts.find(a => a.id === valas);
    expect(valasAccount?.pockets).toEqual(
      expect.arrayContaining([
        { currency: 'USD', balance: 25000, minorFactor: 100, valueIdr: 4062500 },
        { currency: 'SGD', balance: 18000, minorFactor: 100, valueIdr: 2250000 },
      ]),
    );
  });

  test('a pocket with no fx rate yet marks the overview incomplete', async () => {
    const db = openTestDb();
    await buildIdrAccounts(db);
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-10-01', pockets: [{ currency: 'USD', openingBalance: 25000 }] }, NOW);

    const overview = await getAccountsOverview(db);

    expect(overview.incomplete).toBe(true);
    const valasAccount = overview.groups.find(g => g.type === 'forex')?.accounts[0];
    expect(valasAccount?.pockets).toEqual([{ currency: 'USD', balance: 25000, minorFactor: 100, valueIdr: null }]);
  });
});
