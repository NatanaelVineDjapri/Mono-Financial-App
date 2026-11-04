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

// Every currency with a non-archived pocket somewhere — only these are worth fetching
// a rate for.
export async function listHeldCurrencies(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ currency: string }>(
    'select distinct currency from account_currencies where archived = 0 order by currency',
  );
  return rows.map(r => r.currency);
}

export async function saveFetchedRates(db: Db, rates: { currency: string; rateE4: number }[], fetchedAt: string): Promise<void> {
  for (const rate of rates) {
    await insertFxRate(db, rate.currency, rate.rateE4, fetchedAt, 'api');
  }
}
