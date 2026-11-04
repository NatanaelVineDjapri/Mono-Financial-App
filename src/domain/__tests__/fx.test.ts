import { createValasAccount } from '../accounts';
import { getLatestRate } from '../../data/repo/fx';
import { getSetting, setSetting } from '../../data/repo/settings';
import { openTestDb } from '../../data/db/openTestDb';
import { refreshRates, saveManualRate } from '../fx';

const NOW = '2026-11-04T12:00:00+07:00';

function okJsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const ratesBody = {
  result: 'success',
  rates: { USD: 1, IDR: 16250, SGD: 1.3 },
};

describe('refreshRates', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('no pockets at all: skipped, never calls fetch', async () => {
    const db = openTestDb();
    global.fetch = jest.fn();
    expect(await refreshRates(db, NOW)).toEqual({ status: 'skipped_no_pockets' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('success: saves the rates and records fx_last_success_at', async () => {
    const db = openTestDb();
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }] }, NOW);
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(ratesBody));

    const outcome = await refreshRates(db, NOW);
    expect(outcome).toEqual({ status: 'updated', rates: [{ currency: 'USD', rateE4: 162500000 }] });
    expect(await getLatestRate(db, 'USD')).toMatchObject({ rate_e4: 162500000, source: 'api' });
    expect(await getSetting(db, 'fx_last_success_at')).toBe(NOW);
  });

  test('locked out after a 429: skipped, never calls fetch, and the old rate is untouched', async () => {
    const db = openTestDb();
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }] }, NOW);
    await saveManualRate(db, 'USD', 160000000, '2026-11-04T11:00:00+07:00');
    await setSetting(db, 'fx_rate_limited_at', '2026-11-04T11:55:00+07:00'); // 5 min ago, still locked

    global.fetch = jest.fn();
    const outcome = await refreshRates(db, NOW);
    expect(outcome).toEqual({ status: 'skipped_locked', lockedUntil: '2026-11-04T11:55:00+07:00' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await getLatestRate(db, 'USD')).toMatchObject({ rate_e4: 160000000 });
  });

  test('in cooldown since the last success: skipped, never calls fetch', async () => {
    const db = openTestDb();
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }] }, NOW);
    await setSetting(db, 'fx_last_success_at', '2026-11-04T11:30:00+07:00'); // 30 min ago, still cooling down

    global.fetch = jest.fn();
    const outcome = await refreshRates(db, NOW);
    expect(outcome).toEqual({ status: 'skipped_cooldown', lastSuccessAt: '2026-11-04T11:30:00+07:00' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a 429 records fx_rate_limited_at and leaves old rates alone', async () => {
    const db = openTestDb();
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }] }, NOW);
    await saveManualRate(db, 'USD', 160000000, '2026-11-04T11:00:00+07:00');
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse({}, 429));

    const outcome = await refreshRates(db, NOW);
    expect(outcome).toEqual({ status: 'failed', reason: 'rate_limited', message: expect.any(String) });
    expect(await getSetting(db, 'fx_rate_limited_at')).toBe(NOW);
    expect(await getLatestRate(db, 'USD')).toMatchObject({ rate_e4: 160000000 }); // unchanged
  });

  test('a network failure does not record fx_rate_limited_at (only a real 429 does)', async () => {
    const db = openTestDb();
    await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 0 }] }, NOW);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await refreshRates(db, NOW);
    expect(outcome).toEqual({ status: 'failed', reason: 'network_error', message: 'Failed to fetch' });
    expect(await getSetting(db, 'fx_rate_limited_at')).toBeNull();
  });
});

describe('saveManualRate', () => {
  test('adds a new row (source=manual) without overwriting history', async () => {
    const db = openTestDb();
    await saveManualRate(db, 'USD', 162500000, '2026-11-04T10:00:00+07:00');
    await saveManualRate(db, 'USD', 163000000, '2026-11-04T11:00:00+07:00');
    expect(await getLatestRate(db, 'USD')).toEqual({ currency: 'USD', rate_e4: 163000000, fetched_at: '2026-11-04T11:00:00+07:00', source: 'manual' });
  });
});
