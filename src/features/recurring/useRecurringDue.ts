import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useDb } from '@/data/db/DbProvider';
import type { RecurringDueRow } from '@/data/repo/recurring';
import { listDue } from '@/domain/recurring';

export function useDueRecurring(): UseQueryResult<RecurringDueRow[]> {
  const db = useDb();
  const query = useQuery({
    queryKey: ['recurring', 'due'],
    queryFn: () => listDue(db),
    staleTime: 0,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return query;
}

export const useRecurringDue = useDueRecurring;
