// Transactions tab data: wraps src/domain/transactionsList.ts in react-query so the
// screen only reads (CLAUDE.md: "no number computed outside SQL views or src/domain").
// One page per calendar period (month), newest first — the current (open) period loads
// first, and fetchNextPage() loads the period before it, stopping once there is no
// record any older (getEarliestPeriod).
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import type { Db } from '@/data/db/types';
import type { TxTypeFilter } from '@/i18n/id';
import { getCurrentPeriod, getEarliestPeriod, getTransactionsPage, type TransactionsPage } from '@/domain/transactionsList';

export interface TransactionsListFilter {
  type: TxTypeFilter; // 'all' | 'income' | 'expense' | 'transfer'
  search: string; // '' = no search
}

function toRepoFilter(filter: TransactionsListFilter): { kind?: 'income' | 'expense' | 'transfer'; search?: string } {
  return {
    kind: filter.type === 'all' ? undefined : filter.type,
    search: filter.search.trim() || undefined,
  };
}

async function loadPage(db: Db, period: string | null, filter: TransactionsListFilter): Promise<TransactionsPage> {
  const resolvedPeriod = period ?? (await getCurrentPeriod(db, today()));
  return getTransactionsPage(db, resolvedPeriod, toRepoFilter(filter), today());
}

export function useTransactionsList(filter: TransactionsListFilter) {
  const db = useDb();
  const earliest = useQuery({
    queryKey: [...queryKeys.transactions, 'earliest-period'],
    queryFn: () => getEarliestPeriod(db),
  });

  return useInfiniteQuery({
    queryKey: [...queryKeys.transactions, 'list', filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => loadPage(db, pageParam, filter),
    getNextPageParam: lastPage => {
      if (earliest.data && lastPage.previousPeriod < earliest.data) return undefined;
      return lastPage.previousPeriod;
    },
  });
}
