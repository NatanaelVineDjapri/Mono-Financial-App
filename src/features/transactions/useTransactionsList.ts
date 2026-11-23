// Transactions tab reads. Date presets resolve once into a shared parameterised SQL
// filter; the list pages through only the selected range while summary/count queries use
// the same filter across that whole range.
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import {
    getTransactionFilterContext,
    getTransactionsFilterSummary,
    getTransactionsPage,
    type TransactionsQueryFilter,
} from '@/domain/transactionsList';

export type TransactionsListFilter = TransactionsQueryFilter;

function useTransactionFilterContext(filter: TransactionsListFilter) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'filter-context', filter],
    queryFn: () => getTransactionFilterContext(db, filter, today()),
    placeholderData: keepPreviousData,
  });
}

// While the filter changes, the previous list stays on screen (the screen dims it) instead of the whole screen emptying
// out until the new one has loaded. `isPlaceholderData` says that what is on screen belongs to the previous filter.
export function useTransactionsList(filter: TransactionsListFilter) {
  const db = useDb();
  const context = useTransactionFilterContext(filter);
  // A kept-over context belongs to the previous filter: the new list must wait for its own.
  const contextReady = context.isSuccess && !context.isPlaceholderData;
  const pages = useInfiniteQuery({
    queryKey: [...queryKeys.transactions, 'list', filter],
    enabled: contextReady,
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getTransactionsPage(
      db,
      pageParam ?? context.data!.lastPeriod,
      context.data!.repoFilter,
      today(),
    ),
    getNextPageParam: lastPage => (
      lastPage.previousPeriod >= context.data!.firstPeriod ? lastPage.previousPeriod : undefined
    ),
  });

  return {
    ...pages,
    isLoading: context.isLoading || pages.isLoading,
    isError: context.isError || pages.isError,
    isPlaceholderData: context.isPlaceholderData || pages.isPlaceholderData,
  };
}

export function useTransactionsFilterSummary(filter: TransactionsListFilter) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'filter-summary', filter],
    queryFn: () => getTransactionsFilterSummary(db, filter, today()),
    placeholderData: keepPreviousData,
  });
}
