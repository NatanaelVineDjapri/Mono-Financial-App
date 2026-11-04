import { createAccount, createValasAccount } from '../accounts';
import { insertFxRate } from '../../data/repo/fx';
import { openTestDb } from '../../data/db/openTestDb';
import { getNetWorth, getNetWorthHistory } from '../net-worth';

const NOW = '2026-01-01T00:00:00+07:00';

describe('domain net worth', () => {
  test('sums every IDR account, reproducing the sample total of Rp8.880.000', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-01-01' }, NOW);

    expect(await getNetWorth(db)).toEqual({ netWorth: 8880000, incomplete: false });
  });

  test('a Valas pocket without a rate flags incomplete rather than counting as zero', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const valas = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 25000 }] }, NOW);

    expect(await getNetWorth(db)).toEqual({ netWorth: 1000000, incomplete: true });

    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    expect(await getNetWorth(db)).toEqual({ netWorth: 1000000 + 4062500, incomplete: false });
    expect(valas).toBeGreaterThan(0);
  });

  test('net worth history is one row per month, in order', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const history = await getNetWorthHistory(db);
    expect(history.length).toBeGreaterThan(0);
    const months = history.map(h => h.month);
    expect([...months].sort()).toEqual(months);
  });
});
