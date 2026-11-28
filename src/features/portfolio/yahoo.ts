// Stock search and prices from Yahoo Finance's public endpoints (free, no key, unofficial: it may change or stop).
// CLAUDE.md rule 8: one of the places allowed to reach the network, only while a portfolio screen is used. What leaves
// the phone is the words searched for and the symbols held; never quantities, prices paid or anything else.
// Prices can be delayed (about 10 to 15 minutes on some exchanges). Float maths only here, at the boundary.
import type { Quote } from '@/data/repo/portfolio';

const BASE = 'https://query1.finance.yahoo.com';
const TIMEOUT_MS = 20_000;
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

export type StockError = 'offline' | 'rate_limited' | 'not_found' | 'invalid';
export type StockResult<T> = { ok: true; value: T } | { ok: false; error: StockError };

export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange: string;
}

async function getJson(url: string): Promise<StockResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: HEADERS });
    if (response.status === 429) return { ok: false, error: 'rate_limited' };
    if (response.status === 404) return { ok: false, error: 'not_found' };
    if (!response.ok) return { ok: false, error: 'invalid' };
    return { ok: true, value: await response.json() };
  } catch (err) {
    return { ok: false, error: err instanceof SyntaxError ? 'invalid' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchSymbols(query: string): Promise<StockResult<SymbolMatch[]>> {
  const result = await getJson(`${BASE}/v1/finance/search?q=${encodeURIComponent(query.trim())}&quotesCount=15&newsCount=0`);
  if (!result.ok) return result;
  const quotes = (result.value as { quotes?: Record<string, unknown>[] }).quotes;
  if (!Array.isArray(quotes)) return { ok: false, error: 'invalid' };
  const matches = quotes
    .filter(q => typeof q.symbol === 'string' && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND'))
    .map(q => ({ symbol: q.symbol as string, name: String(q.longname ?? q.shortname ?? q.symbol), exchange: String(q.exchDisp ?? q.exchange ?? '') }));
  return { ok: true, value: matches };
}

// Prices some exchanges quote in a hundredth of their currency (London in pence, Johannesburg in cents).
const HUNDREDTHS: Record<string, string> = { GBp: 'GBP', GBX: 'GBP', ZAc: 'ZAR', ZAC: 'ZAR', ILA: 'ILS' };

export function quoteFromChart(symbol: string, body: unknown): Quote | null {
  const meta = (body as { chart?: { result?: { meta?: Record<string, unknown> }[] } }).chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number' || typeof meta.currency !== 'string') return null;
  const divide = HUNDREDTHS[meta.currency] ? 100 : 1;
  const e4 = (value: unknown) => (typeof value === 'number' && value > 0 ? Math.round((value / divide) * 10000) : null);
  const priceE4 = e4(meta.regularMarketPrice);
  if (!priceE4) return null;
  const time = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : Date.now();
  return {
    symbol,
    currency: HUNDREDTHS[meta.currency] ?? meta.currency,
    priceE4,
    prevCloseE4: e4(meta.chartPreviousClose ?? meta.previousClose),
    asOf: new Date(time).toISOString(),
  };
}

export async function fetchQuote(symbol: string): Promise<StockResult<Quote>> {
  const result = await getJson(`${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`);
  if (!result.ok) return result;
  const quote = quoteFromChart(symbol, result.value);
  return quote ? { ok: true, value: quote } : { ok: false, error: 'invalid' };
}

// One symbol at a time; stops early when there is no connection or the service says to slow down.
export async function fetchQuotes(symbols: readonly string[]): Promise<{ quotes: Quote[]; failed: StockError | null }> {
  const quotes: Quote[] = [];
  let failed: StockError | null = null;
  for (const symbol of symbols) {
    const result = await fetchQuote(symbol);
    if (result.ok) {
      quotes.push(result.value);
      continue;
    }
    failed = result.error;
    if (result.error === 'offline' || result.error === 'rate_limited') break;
  }
  return { quotes, failed };
}
