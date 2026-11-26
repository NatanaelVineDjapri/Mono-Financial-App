// Reads of the Summary page; every figure comes from src/domain/summary.ts.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getSummary, getSummaryHistory, type HistoryMonths, type SummaryRange } from '@/domain/summary';

export function useSummary(range: SummaryRange) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.reports, 'summary', range],
    queryFn: () => getSummary(db, range, today()),
    placeholderData: keepPreviousData,
  });
}

export function useSummaryHistory(months: HistoryMonths, accountId: number | null) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.reports, 'summary-history', months, accountId ?? 'all'],
    queryFn: () => getSummaryHistory(db, months, today(), accountId),
    placeholderData: keepPreviousData,
  });
}
