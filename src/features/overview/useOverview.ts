// Overview reads. Every figure comes from src/domain (views underneath); the screen only
// formats. Invalidated with everything else after a write (invalidateAfterWrite).
import { useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listGoalProgress } from '@/domain/goals';
import { getOverviewData } from '@/domain/overview';

export function useOverviewData() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.reports, 'overview'],
    queryFn: () => getOverviewData(db, today()),
  });
}

export function useGoalProgress() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.goals, 'progress'],
    queryFn: () => listGoalProgress(db),
  });
}
