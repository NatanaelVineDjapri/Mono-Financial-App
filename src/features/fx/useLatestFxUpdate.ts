// The Accounts card stack's forex note and "Exchange rates" row (Fase 4.2c; DESIGN.md
// "Accounts with a Valas account") need one thing the existing Accounts hook doesn't
// carry: when rates were last fetched. This is purely additive — src/features/accounts
// and src/domain/balances.ts are untouched — a second, small read alongside the first.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listLatestRates } from '@/data/repo/fx';

// The newest fetched_at across every currency with a rate, or null when none has been
// fetched yet (a brand new install with no Valas account, or one with no rate at all).
export function useLatestFxUpdate() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.fx, 'latest-update'],
    queryFn: async () => {
      const rates = await listLatestRates(db);
      return rates.reduce<string | null>((latest, r) => (!latest || r.fetched_at > latest ? r.fetched_at : latest), null);
    },
  });
}
