// Accounts tab data: wraps src/domain/balances.ts's getAccountsOverview in react-query so
// the screen only reads (CLAUDE.md: "no number computed outside SQL views or src/domain").
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getAccountsOverview } from '@/domain/balances';
import type { AccountsOverview } from '@/domain/balances';

export function useAccountsOverview(): UseQueryResult<AccountsOverview> {
  const db = useDb();
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => getAccountsOverview(db),
  });
}
