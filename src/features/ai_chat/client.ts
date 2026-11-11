// The only network code of the AI chat (CLAUDE.md rules 8 and 9): one plain `fetch` to
// Gemini's generateContent with the key in a header (never in the URL), a 20 s timeout, one
// request at a time, no SDK. Nothing here logs: not the key, not the message, not the reply,
// and an error is reduced to a code before it leaves this file.
import { GEMINI_ENDPOINT, MAX_CHARS, PING_MAX_OUTPUT_TOKENS, SERVER_RETRY_DELAY_MS, TIMEOUT_MS } from './config';
import type { GeminiRequest } from './prompt';

export type AiErrorCode =
  | 'no_internet'
  | 'key_rejected'
  | 'quota'
  | 'unreadable'
  | 'generic'
  | 'timeout'
  | 'aborted' // the person tapped Batal
  | 'busy' // a request is already in flight
  | 'too_long'
  | 'empty';

export type SendResult = { ok: true; body: unknown } | { ok: false; code: AiErrorCode };
export type GeminiResult = { ok: true; text: string } | { ok: false; code: AiErrorCode };

export interface CallOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch; // tests
  sleep?: (ms: number) => Promise<void>; // tests
}

let inFlight = false;

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// A 400 that means "this key is not valid" (older API behaviour) versus any other bad request.
async function isKeyProblem(response: Response): Promise<boolean> {
  try {
    const text = await response.text();
    return /api[ _-]?key|API_KEY_INVALID/i.test(text);
  } catch {
    return false;
  }
}

// One HTTP exchange with the status mapping. 5xx is tried once more after a second; no 4xx is
// ever retried.
async function send(request: GeminiRequest, key: string, options: CallOptions): Promise<SendResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) controller.abort();

    let response: Response;
    try {
      response = await doFetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      if (options.signal?.aborted) return { ok: false, code: 'aborted' };
      if (timedOut) return { ok: false, code: 'timeout' };
      return { ok: false, code: 'no_internet' };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    if (response.ok) {
      try {
        return { ok: true, body: await response.json() };
      } catch {
        return { ok: false, code: 'unreadable' };
      }
    }
    const status = response.status;
    if (status === 401 || status === 403) return { ok: false, code: 'key_rejected' };
    if (status === 400) return { ok: false, code: (await isKeyProblem(response)) ? 'key_rejected' : 'generic' };
    if (status === 429) return { ok: false, code: 'quota' };
    if (status >= 500 && status < 600) {
      if (attempt === 0) {
        await sleep(SERVER_RETRY_DELAY_MS);
        if (options.signal?.aborted) return { ok: false, code: 'aborted' };
        continue;
      }
      return { ok: false, code: 'generic' };
    }
    return { ok: false, code: 'generic' };
  }
  return { ok: false, code: 'generic' };
}

interface Part {
  text?: string;
  thought?: boolean;
}

// The reply's text: the non-thought parts of the first candidate, joined. A blocked prompt, a
// reply cut off at the token limit, or an empty one is "unreadable".
export function extractText(body: unknown): string | null {
  const data = body as { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } } | null;
  if (!data || data.promptFeedback?.blockReason) return null;
  const candidate = data.candidates?.[0];
  if (!candidate) return null;
  if (candidate.finishReason && candidate.finishReason !== 'STOP') return null;
  const text = (candidate.content?.parts ?? [])
    .filter(p => !p.thought && typeof p.text === 'string')
    .map(p => p.text as string)
    .join('');
  return text.length > 0 ? text : null;
}

export async function callGemini(request: GeminiRequest, key: string, options: CallOptions = {}): Promise<GeminiResult> {
  if (inFlight) return { ok: false, code: 'busy' };
  inFlight = true;
  try {
    const result = await send(request, key, options);
    if (!result.ok) return result;
    const text = extractText(result.body);
    return text == null ? { ok: false, code: 'unreadable' } : { ok: true, text };
  } finally {
    inFlight = false;
  }
}

// "Simpan dan tes kunci": one short message with no financial data. Success is a 200.
export async function testKey(key: string, options: CallOptions = {}): Promise<{ ok: true } | { ok: false; code: AiErrorCode }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, code: 'key_rejected' };
  if (inFlight) return { ok: false, code: 'busy' };
  inFlight = true;
  try {
    const result = await send(
      {
        systemInstruction: { parts: [{ text: 'Reply with one word.' }] },
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: PING_MAX_OUTPUT_TOKENS },
      },
      trimmed,
      options,
    );
    return result.ok ? { ok: true } : result;
  } finally {
    inFlight = false;
  }
}

export function messageLengthProblem(message: string): 'empty' | 'too_long' | null {
  if (message.trim().length === 0) return 'empty';
  if (message.length > MAX_CHARS) return 'too_long';
  return null;
}
