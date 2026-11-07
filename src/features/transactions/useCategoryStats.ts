// Transactions tab's statistics area (Fase 4.3c): the ring chart + category list data,
// independent of the row-list's own pagination/search — one query per period + kind.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getCategoryStats } from '@/domain/categoryStats';

export function useCategoryStats(period: string, kind: 'income' | 'expense', isCurrent: boolean) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'category-stats', period, kind, isCurrent],
    queryFn: () => getCategoryStats(db, period, kind, isCurrent),
  });
}
