// Reads and writes of the Valas screens. The screens only read through these hooks; every figure comes
// from valasDetail.ts (views underneath) and is refetched after any write.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { nowIso, today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { autoUpdateRates } from '@/domain/fx';
import { activityKindLabel } from '@/i18n';

import type { CreateForexAccountInput, PocketInput } from './forexAccount';
import { saveNewPocket, saveNewValasAccount, savePocketArchived, saveValasName } from './save';
import { getValasDetail, listValasActivity } from './valasDetail';

export function useValasDetail(id: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'valas', id],
    queryFn: () => getValasDetail(db, id, nowIso()),
  });
}

export function useValasActivity(id: number, period: string | undefined, currency: string | 'all') {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'valas-activity', id, period ?? null, currency],
    queryFn: () => listValasActivity(db, id, period as string, currency, kind => activityKindLabel(kind)),
    enabled: !!period,
  });
}

export function useValasActions() {
  const db = useDb();
  const queryClient = useQueryClient();

  // A pocket just added has no rate yet. When "Perbarui otomatis" is on, ask for the rates right away
  // (autoUpdateRates only does so for a currency with no rate, and obeys the switch and the 429 lockout),
  // and never wait for it: the screen shows "No rate yet" until it lands, and a failure keeps things as they are.
  const fillMissingRates = useCallback(async () => {
    try {
      const outcome = await autoUpdateRates(db, nowIso());
      if (outcome.status === 'updated') await invalidateAfterWrite(queryClient);
    } catch {
      // The rate can still be set by hand or refreshed on the Rates screen.
    }
  }, [db, queryClient]);

  const create = useCallback(
    async (input: CreateForexAccountInput) => {
      const result = await saveNewValasAccount(db, input, nowIso());
      if (result.ok) {
        await invalidateAfterWrite(queryClient);
        void fillMissingRates();
      }
      return result;
    },
    [db, queryClient, fillMissingRates],
  );

  const rename = useCallback(
    async (accountId: number, name: string) => {
      const result = await saveValasName(db, accountId, name);
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  // A new pocket starts empty today; the person records what they hold as a transaction.
  const addPocket = useCallback(
    async (accountId: number, currency: string, openingMinor = 0) => {
      const pocket: PocketInput = { currency, openingMinor };
      const result = await saveNewPocket(db, accountId, pocket, today(), nowIso());
      if (result.ok) {
        await invalidateAfterWrite(queryClient);
        void fillMissingRates();
      }
      return result;
    },
    [db, queryClient, fillMissingRates],
  );

  const archivePocket = useCallback(
    async (accountId: number, currency: string) => {
      const result = await savePocketArchived(db, accountId, currency);
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  return { create, rename, addPocket, archivePocket };
}
