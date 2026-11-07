// Category-ring data for Transactions. It receives the exact SQL filter prepared for the
// list/summary, so the portions never describe a different subset of records.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getFilteredCategoryStats } from '@/domain/categoryStats';
import type { TxListFilter } from '@/domain/transactionsList';

export function useCategoryStats(
  filter: TxListFilter,
  kind: 'income' | 'expense',
  limitPeriod?: string,
) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'category-stats', filter, kind, limitPeriod],
    queryFn: () => getFilteredCategoryStats(db, kind, filter, limitPeriod),
  });
}
