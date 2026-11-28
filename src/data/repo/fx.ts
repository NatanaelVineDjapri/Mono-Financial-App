import type { Db } from '../db/types';

export type FxSource = 'api' | 'manual';

export async function insertFxRate(db: Db, currency: string, rateE4: number, fetchedAt: string, source: FxSource): Promise<void> {
  // A new row, never an overwrite (CLAUDE.md: history is kept; v_latest_fx picks the newest).
  await db.runAsync('insert into fx_rates (currency, rate_e4, fetched_at, source) values ($currency, $rateE4, $fetchedAt, $source)', {
    $currency: currency,
    $rateE4: rateE4,
    $fetchedAt: fetchedAt,
    $source: source,
  });
}

export interface LatestFxRow {
  currency: string;
  rate_e4: number;
  fetched_at: string;
  source: FxSource;
}

export async function getLatestRate(db: Db, currency: string): Promise<LatestFxRow | null> {
  return db.getFirstAsync<LatestFxRow>('select * from v_latest_fx where currency = $currency', { $currency: currency });
}

export async function listLatestRates(db: Db): Promise<LatestFxRow[]> {
  return db.getAllAsync<LatestFxRow>('select * from v_latest_fx order by currency');
}

// Every currency with a non-archived pocket somewhere, or a stock position in it: only these are worth fetching a rate for.
export async function listHeldCurrencies(db: Db): Promise<string[]> {
  const pockets = await db.getAllAsync<{ currency: string }>('select distinct currency from account_currencies where archived = 0');
  // (a database that has not reached the portfolio migration has no positions)
  const hasPositions = await db.getFirstAsync("select 1 as x from sqlite_master where type = 'table' and name = 'positions'");
  const stocks = hasPositions ? await db.getAllAsync<{ currency: string }>("select distinct currency from positions where currency <> 'IDR'") : [];
  return [...new Set([...pockets, ...stocks].map(r => r.currency))].sort();
}

export async function saveFetchedRates(db: Db, rates: { currency: string; rateE4: number }[], fetchedAt: string): Promise<void> {
  for (const rate of rates) {
    await insertFxRate(db, rate.currency, rate.rateE4, fetchedAt, 'api');
  }
}
