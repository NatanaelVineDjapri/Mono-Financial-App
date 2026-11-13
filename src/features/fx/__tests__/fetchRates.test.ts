import { ATTRIBUTION_TEXT, ATTRIBUTION_URL, fetchRates, fxFailureKind } from '../fetchRates';

// Structurally the same shape as the real open.er-api.com response (verified against a
// real call on 2026-11-04: result "success", rates.IDR present, all 12 supported
// currencies present), with made-up numbers so the fixture doesn't drift daily.
function mockRatesResponse() {
  return {
    result: 'success',
    rates: {
      USD: 1,
      IDR: 16250,
      SGD: 1.3,
      EUR: 0.9,
      JPY: 150,
    } as Record<string, number>,
  };
}

function okJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fetchRates', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  test('success: computes rate_e4 = round((rates.IDR / rates[code]) * 10000) for each held currency', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(mockRatesResponse()));

    const result = await fetchRates(['USD', 'SGD']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // USD: 16250 / 1 = 16250 -> 162500000
    // SGD: 16250 / 1.3 = 12500 -> 125000000
    expect(result.rates).toEqual([
      { currency: 'USD', rateE4: 162500000 },
      { currency: 'SGD', rateE4: 125000000 },
    ]);
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
  });

  test('an empty held-currency list fetches nothing', async () => {
    global.fetch = jest.fn();
    const result = await fetchRates([]);
    expect(result).toEqual({ ok: true, fetchedAt: expect.any(String), rates: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('HTTP 429 is reported as rate_limited', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse({}, 429));
    const result = await fetchRates(['USD']);
    expect(result).toEqual({ ok: false, reason: 'rate_limited', message: expect.any(String) });
  });

  test('a non-OK, non-429 status is reported as http_error', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse({}, 503));
    const result = await fetchRates(['USD']);
    expect(result).toEqual({ ok: false, reason: 'http_error', message: expect.any(String) });
  });

  test('offline / a network failure is reported as network_error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await fetchRates(['USD']);
    expect(result).toEqual({ ok: false, reason: 'network_error', message: 'Failed to fetch' });
  });

  test('no response within 20s is reported as timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const pending = fetchRates(['USD']);
    await jest.advanceTimersByTimeAsync(20000);
    const result = await pending;

    expect(result).toEqual({ ok: false, reason: 'timeout', message: expect.any(String) });
  });

  test('a response missing rates.IDR is reported as bad_response', async () => {
    const body = mockRatesResponse();
    delete body.rates.IDR;
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body));
    const result = await fetchRates(['USD']);
    expect(result).toEqual({ ok: false, reason: 'bad_response', message: expect.any(String) });
  });

  test('a held currency missing from the response is reported as missing_currency', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(mockRatesResponse()));
    const result = await fetchRates(['USD', 'THB']); // THB not in the fixture
    expect(result).toEqual({ ok: false, reason: 'missing_currency', message: expect.stringContaining('THB') });
  });

  test('result !== "success" is reported as bad_response', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse({ result: 'error', rates: { IDR: 16250, USD: 1 } }));
    const result = await fetchRates(['USD']);
    expect(result).toEqual({ ok: false, reason: 'bad_response', message: expect.any(String) });
  });

  test('exposes the required attribution for the Rates screen', () => {
    expect(ATTRIBUTION_TEXT).toBe('Rates By Exchange Rate API');
    expect(ATTRIBUTION_URL).toBe('https://www.exchangerate-api.com');
  });
});

describe('fetchRates: what the service says and how it fails', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const body = (extra: Record<string, unknown> = {}) => ({ result: 'success', rates: { USD: 1, IDR: 16250, SGD: 1.3 }, ...extra });

  test('the unix next-update time becomes a +07:00 instant', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body({ time_next_update_unix: 1793000000 })));
    const result = await fetchRates(['USD']);
    expect(result.ok && result.nextUpdateAt).toBe('2026-10-26T14:33:20+07:00');
  });

  test('without the unix field the UTC string is read; unreadable or missing gives null', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body({ time_next_update_utc: 'Thu, 29 Oct 2026 00:00:01 +0000' })));
    const a = await fetchRates(['USD']);
    expect(a.ok && a.nextUpdateAt).toBe('2026-10-29T07:00:01+07:00');
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body({ time_next_update_utc: 'soon' })));
    const b = await fetchRates(['USD']);
    expect(b.ok && b.nextUpdateAt).toBeNull();
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body()));
    const c = await fetchRates(['USD']);
    expect(c.ok && c.nextUpdateAt).toBeNull();
  });

  test('result other than success is a failure (bad_response)', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse({ result: 'error', 'error-type': 'unsupported-code' }));
    const result = await fetchRates(['USD']);
    expect(result).toMatchObject({ ok: false, reason: 'bad_response' });
  });

  test('a held currency the service does not list is missing_currency', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJsonResponse(body()));
    const result = await fetchRates(['USD', 'KRW']);
    expect(result).toMatchObject({ ok: false, reason: 'missing_currency' });
  });

  test('failure kinds: offline, rate_limited, invalid', () => {
    expect(fxFailureKind('network_error')).toBe('offline');
    expect(fxFailureKind('timeout')).toBe('offline');
    expect(fxFailureKind('rate_limited')).toBe('rate_limited');
    expect(fxFailureKind('http_error')).toBe('invalid');
    expect(fxFailureKind('bad_response')).toBe('invalid');
    expect(fxFailureKind('missing_currency')).toBe('invalid');
  });
});
