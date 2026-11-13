// What the Rates screen (/settings/rates) reads: one row per currency the person holds in a
// pocket, with the rate in use (or none), plus the switch and the fetch status. A currency with no
// rate has a null rate: never 0.
import type { Db } from '@/data/db/types';
import { listHeldCurrencies, listLatestRates, type FxSource } from '@/data/repo/fx';
import { getFxAutoUpdate, getFxStatus } from '@/domain/fx';
import { SUPPORTED_FOREX_CURRENCIES } from '@/features/valas/currencies';

export interface RateRow {
  currency: string;
  rateE4: number | null;
  fetchedAt: string | null;
  source: FxSource | null;
}

export interface RatesOverview {
  rows: RateRow[];
  autoUpdate: boolean;
  lastSuccessAt: string | null;
  nextUpdateAt: string | null;
  rateLimitedAt: string | null;
}

export async function getRatesOverview(db: Db): Promise<RatesOverview> {
  const [held, latest, autoUpdate, status] = await Promise.all([listHeldCurrencies(db), listLatestRates(db), getFxAutoUpdate(db), getFxStatus(db)]);
  const byCode = new Map(latest.map(r => [r.currency, r] as const));
  const order = (code: string) => {
    const i = (SUPPORTED_FOREX_CURRENCIES as readonly string[]).indexOf(code);
    return i < 0 ? 99 : i;
  };
  const rows = [...held]
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map<RateRow>(currency => {
      const r = byCode.get(currency);
      return { currency, rateE4: r?.rate_e4 ?? null, fetchedAt: r?.fetched_at ?? null, source: r?.source ?? null };
    });
  return { rows, autoUpdate, ...status };
}
