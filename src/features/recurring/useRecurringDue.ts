import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import type { RecurringDueRow } from '@/data/repo/recurring';
import { listRecurringDue } from '@/domain/recurring';

export function useRecurringDue(): UseQueryResult<RecurringDueRow[]> {
  const db = useDb();
  return useQuery({
    queryKey: ['recurring', 'due'],
    queryFn: () => listRecurringDue(db),
  });
}
