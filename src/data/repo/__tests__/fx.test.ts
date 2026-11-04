import { archivePocket, createValasAccount } from '../../../domain/accounts';
import { openTestDb } from '../../db/openTestDb';
import { getLatestRate, insertFxRate, listHeldCurrencies, listLatestRates, saveFetchedRates } from '../fx';

const NOW = '2026-11-04T10:00:00+07:00';

describe('fx repo', () => {
  test('the newest rate wins', async () => {
    const db = openTestDb();
    await insertFxRate(db, 'USD', 162500000, '2026-10-28T09:00:00+07:00', 'api');
    await insertFxRate(db, 'USD', 163000000, '2026-11-02T08:00:00+07:00', 'manual');

    expect(await getLatestRate(db, 'USD')).toEqual({ currency: 'USD', rate_e4: 163000000, fetched_at: '2026-11-02T08:00:00+07:00', source: 'manual' });
  });

  test('no rate yet returns null, not a throw', async () => {
    const db = openTestDb();
    expect(await getLatestRate(db, 'USD')).toBeNull();
  });

  test('listLatestRates returns one row per currency', async () => {
    const db = openTestDb();
    await insertFxRate(db, 'USD', 162500000, '2026-10-28T09:00:00+07:00', 'api');
    await insertFxRate(db, 'SGD', 125000000, '2026-10-28T09:00:00+07:00', 'api');
    expect((await listLatestRates(db)).map(r => r.currency)).toEqual(['SGD', 'USD']);
  });

  test('a rate cannot be stored for IDR', async () => {
    const db = openTestDb();
    await expect(insertFxRate(db, 'IDR', 10000, '2026-10-28T09:00:00+07:00', 'api')).rejects.toThrow();
  });

  test('listHeldCurrencies lists only non-archived pockets, across accounts, deduplicated', async () => {
    const db = openTestDb();
    const valas1 = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }, { currency: 'SGD', openingBalance: 0 }] }, NOW);
    await createValasAccount(db, { name: 'Valas 2', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }, { currency: 'EUR', openingBalance: 0 }] }, NOW);
    expect(await listHeldCurrencies(db)).toEqual(['EUR', 'SGD', 'USD']);

    await archivePocket(db, valas1, 'SGD');
    expect(await listHeldCurrencies(db)).toEqual(['EUR', 'USD']);
  });

  test('no pockets at all: an empty list, not an error', async () => {
    const db = openTestDb();
    expect(await listHeldCurrencies(db)).toEqual([]);
  });

  test('saveFetchedRates inserts each one with source=api', async () => {
    const db = openTestDb();
    await saveFetchedRates(db, [{ currency: 'USD', rateE4: 162500000 }, { currency: 'SGD', rateE4: 125000000 }], '2026-10-28T09:00:00+07:00');
    expect(await getLatestRate(db, 'USD')).toMatchObject({ rate_e4: 162500000, source: 'api' });
    expect(await getLatestRate(db, 'SGD')).toMatchObject({ rate_e4: 125000000, source: 'api' });
  });
});
