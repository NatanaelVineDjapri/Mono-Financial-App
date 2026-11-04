import { openTestDb } from '../../db/openTestDb';
import { getLatestRate, insertFxRate, listLatestRates } from '../fx';

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
});
