// Reads and writes of the Rates screen. Every write goes through src/domain/fx.ts (the throttle and
// the "keep the old rates on failure" rule live there) and then invalidates the reads, so the
// Accounts tab, net worth and the Valas detail pick the new rates up.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { nowIso } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { refreshRates, saveManualRate, setFxAutoUpdate, type RefreshOutcome } from '@/domain/fx';

import { parseRateInput } from '../valas/rates';
import { getRatesOverview, type RatesOverview } from './ratesOverview';

export const ratesKey = [...queryKeys.fx, 'overview'] as const;

export function useRatesOverview() {
  const db = useDb();
  return useQuery<RatesOverview>({ queryKey: ratesKey, queryFn: () => getRatesOverview(db), staleTime: 0 });
}

export function useRatesActions() {
  const db = useDb();
  const queryClient = useQueryClient();

  const setAuto = useCallback(
    async (on: boolean) => {
      await setFxAutoUpdate(db, on);
      await invalidateAfterWrite(queryClient);
    },
    [db, queryClient],
  );

  const refresh = useCallback(async (): Promise<RefreshOutcome> => {
    const outcome = await refreshRates(db, nowIso());
    await invalidateAfterWrite(queryClient);
    return outcome;
  }, [db, queryClient]);

  // The person's own rate for one currency, typed as rupiah per 1 unit ("16.250"). False when the
  // text is not a usable rate; nothing is written then.
  const saveManual = useCallback(
    async (currency: string, text: string): Promise<boolean> => {
      const rateE4 = parseRateInput(text);
      if (rateE4 == null) return false;
      await saveManualRate(db, currency, rateE4, nowIso());
      await invalidateAfterWrite(queryClient);
      return true;
    },
    [db, queryClient],
  );

  return { setAuto, refresh, saveManual };
}
