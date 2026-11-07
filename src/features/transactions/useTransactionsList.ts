// Transactions tab data: wraps src/domain/transactionsList.ts in react-query so the
// screen only reads (CLAUDE.md: "no number computed outside SQL views or src/domain").
// One page per calendar period (month), newest first — the current (open) period loads
// first, and fetchNextPage() loads the period before it, stopping once there is no
// record any older (getEarliestPeriod).
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import type { Db } from '@/data/db/types';
import { queryKeys } from '@/data/queryKeys';
import { getCurrentPeriod, getEarliestPeriod, getTransactionsPage, type TransactionsPage } from '@/domain/transactionsList';
import type { TxTypeFilter } from '@/i18n/id';

export interface TransactionsListFilter {
  type: TxTypeFilter; // 'all' | 'income' | 'expense' | 'transfer'
  search: string; // '' = no search
  categoryId?: number; // Fase 4.3c: tapping a ring slice or category row
}

function toRepoFilter(filter: TransactionsListFilter): { kind?: 'income' | 'expense' | 'transfer'; search?: string; categoryId?: number } {
  return {
    kind: filter.type === 'all' ? undefined : filter.type,
    search: filter.search.trim() || undefined,
    categoryId: filter.categoryId,
  };
}

async function loadPage(db: Db, period: string | null, filter: TransactionsListFilter): Promise<TransactionsPage> {
  // Only show current month, no historical data
  const resolvedPeriod = await getCurrentPeriod(db, today());
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
    getNextPageParam: () => undefined, // Hardcoded: only show November 2026, no pagination
  });
}
