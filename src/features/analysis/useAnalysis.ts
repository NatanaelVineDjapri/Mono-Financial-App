// The Analysis reads: the score of one period (or the running one when `period` is null) with its trend. Every
// read is local. A write anywhere calls invalidateAfterWrite, which refreshes this key with all the others
// (transactions, budgets, goals, fixed expenses and a restore all do), so the score never shows old data.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';

import { getAnalysis } from './data';

// Any period later than the running one is clamped to it by getAnalysis.
const RUNNING = '9999-12';

export function useAnalysis(period: string | null) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.analysis, period ?? 'running'],
    queryFn: () => getAnalysis(db, period ?? RUNNING, today()),
    placeholderData: keepPreviousData, // stepping between periods keeps the old card up until the new one is ready
  });
}
