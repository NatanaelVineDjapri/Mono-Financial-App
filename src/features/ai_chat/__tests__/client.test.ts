import { callGemini, extractText, messageLengthProblem, testKey } from '../client';
import { GEMINI_ENDPOINT, GEMINI_MODEL, MAX_CHARS, TIMEOUT_MS } from '../config';
import { buildRequest } from '../prompt';
import { CTX } from './fixtures';

const KEY = 'AIzaSyFAKE-KEY-for-tests-0123456789';
const request = buildRequest('kopi 25rb pake gopay', CTX);

function ok(text: string): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200 });
}

const status = (code: number, body = '{}') => new Response(body, { status: code });
const noSleep = async () => {};

function fetchSequence(...responses: (Response | Error)[]) {
  const queue = [...responses];
  return jest.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra request');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

describe('callGemini', () => {
  test('posts to the model endpoint with the key in a header, never in the URL', async () => {
    const fetchImpl = fetchSequence(ok('{"a":1}'));
    const result = await callGemini(request, KEY, { fetchImpl });
    expect(result).toEqual({ ok: true, text: '{"a":1}' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GEMINI_ENDPOINT);
    expect(url).toContain(GEMINI_MODEL);
    expect(url).not.toContain(KEY);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    expect(init.body as string).not.toContain(KEY);
  });

  test('connection failures and TypeError are no_internet', async () => {
    expect(await callGemini(request, KEY, { fetchImpl: fetchSequence(new TypeError('Network request failed')) })).toEqual({ ok: false, code: 'no_internet' });
  });

  test.each([
    [401, 'key_rejected'],
    [403, 'key_rejected'],
    [429, 'quota'],
    [404, 'generic'],
    [422, 'generic'],
  ])('HTTP %i is %s and is never retried', async (code, expected) => {
    const fetchImpl = fetchSequence(status(code));
    expect(await callGemini(request, KEY, { fetchImpl, sleep: noSleep })).toEqual({ ok: false, code: expected });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a 400 about the key is key_rejected, any other 400 is generic; neither is retried', async () => {
    const keyProblem = fetchSequence(status(400, JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } })));
    expect(await callGemini(request, KEY, { fetchImpl: keyProblem })).toEqual({ ok: false, code: 'key_rejected' });
    expect(keyProblem).toHaveBeenCalledTimes(1);

    const other = fetchSequence(status(400, JSON.stringify({ error: { message: 'Invalid JSON payload' } })));
    expect(await callGemini(request, KEY, { fetchImpl: other })).toEqual({ ok: false, code: 'generic' });
    expect(other).toHaveBeenCalledTimes(1);
  });

  test('a 5xx is tried once more after a second, then it is generic', async () => {
    const sleep = jest.fn(noSleep);
    const recovers = fetchSequence(status(503), ok('{}'));
    expect(await callGemini(request, KEY, { fetchImpl: recovers, sleep })).toEqual({ ok: true, text: '{}' });
    expect(recovers).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);

    const fails = fetchSequence(status(500), status(502));
    expect(await callGemini(request, KEY, { fetchImpl: fails, sleep })).toEqual({ ok: false, code: 'generic' });
    expect(fails).toHaveBeenCalledTimes(2);
  });

  test('a reply that is blocked, cut off, empty or not JSON is unreadable', async () => {
    const bodies = [
      { promptFeedback: { blockReason: 'SAFETY' } },
      { candidates: [] },
      { candidates: [{ content: { parts: [{ text: '{"intent"' }] }, finishReason: 'MAX_TOKENS' }] },
      { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] },
    ];
    for (const body of bodies) {
      const fetchImpl = fetchSequence(new Response(JSON.stringify(body), { status: 200 }));
      expect(await callGemini(request, KEY, { fetchImpl })).toEqual({ ok: false, code: 'unreadable' });
    }
    expect(await callGemini(request, KEY, { fetchImpl: fetchSequence(new Response('<html>', { status: 200 })) })).toEqual({ ok: false, code: 'unreadable' });
  });

  test('thought parts are skipped and the rest is joined', () => {
    const body = { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '{"a":' }, { text: '1}' }] }, finishReason: 'STOP' }] };
    expect(extractText(body)).toBe('{"a":1}');
  });

  test('Batal aborts the request without a retry', async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    const pending = callGemini(request, KEY, { fetchImpl, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ ok: false, code: 'aborted' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('the request times out after the limit', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ) as unknown as jest.MockedFunction<typeof fetch>;
      const pending = callGemini(request, KEY, { fetchImpl });
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS);
      expect(await pending).toEqual({ ok: false, code: 'timeout' });
    } finally {
      jest.useRealTimers();
    }
  });

  test('only one request at a time: a second call while one is in flight is busy', async () => {
    let release: (r: Response) => void = () => {};
    const slow = jest.fn(() => new Promise<Response>(resolve => (release = resolve))) as unknown as jest.MockedFunction<typeof fetch>;
    const first = callGemini(request, KEY, { fetchImpl: slow });
    expect(await callGemini(request, KEY, { fetchImpl: fetchSequence(ok('{}')) })).toEqual({ ok: false, code: 'busy' });
    release(ok('{}'));
    expect((await first).ok).toBe(true);
    expect(await callGemini(request, KEY, { fetchImpl: fetchSequence(ok('{}')) })).toEqual({ ok: true, text: '{}' });
  });
});

describe('testKey', () => {
  test('a 200 is success, and the ping carries no financial data', async () => {
    const fetchImpl = fetchSequence(ok('ok'));
    expect(await testKey(`  ${KEY}  `, { fetchImpl })).toEqual({ ok: true });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(JSON.stringify(body.contents)).toContain('ping');
    expect(body.generationConfig.maxOutputTokens).toBeLessThanOrEqual(32);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
  });

  test('a 200 with an empty reply still means the key works', async () => {
    const fetchImpl = fetchSequence(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { status: 200 }));
    expect(await testKey(KEY, { fetchImpl })).toEqual({ ok: true });
  });

  test('a rejected key, an empty key and no connection', async () => {
    expect(await testKey(KEY, { fetchImpl: fetchSequence(status(401)) })).toEqual({ ok: false, code: 'key_rejected' });
    expect(await testKey('   ', { fetchImpl: fetchSequence() })).toEqual({ ok: false, code: 'key_rejected' });
    expect(await testKey(KEY, { fetchImpl: fetchSequence(new TypeError('offline')) })).toEqual({ ok: false, code: 'no_internet' });
  });
});

describe('messageLengthProblem', () => {
  test('refuses an empty message and one over the limit before anything is sent', () => {
    expect(messageLengthProblem('   ')).toBe('empty');
    expect(messageLengthProblem('a'.repeat(MAX_CHARS))).toBeNull();
    expect(messageLengthProblem('a'.repeat(MAX_CHARS + 1))).toBe('too_long');
  });
});

describe('secrets', () => {
  test('neither the key nor the message reaches the console, even when everything fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    try {
      const secretMessage = 'rahasia-pesan-pengguna 25rb';
      const req = buildRequest(secretMessage, CTX);
      await callGemini(req, KEY, { fetchImpl: fetchSequence(new TypeError(`failed for ${KEY}`)) });
      await callGemini(req, KEY, { fetchImpl: fetchSequence(status(401, `bad ${KEY}`)) });
      await callGemini(req, KEY, { fetchImpl: fetchSequence(ok(`not json ${secretMessage}`)) });
      await testKey(KEY, { fetchImpl: fetchSequence(status(500), status(500)), sleep: noSleep });
      const logged = spies.flatMap(s => s.mock.calls.flat()).map(String).join('\n');
      expect(logged).not.toContain(KEY);
      expect(logged).not.toContain('rahasia-pesan-pengguna');
    } finally {
      spies.forEach(s => s.mockRestore());
    }
  });

  test('no error returned by the client carries the key or the message', async () => {
    const results = [
      await callGemini(request, KEY, { fetchImpl: fetchSequence(new Error(`boom ${KEY}`)) }),
      await callGemini(request, KEY, { fetchImpl: fetchSequence(status(400, `API key ${KEY}`)) }),
    ];
    expect(JSON.stringify(results)).not.toContain(KEY);
  });
});
