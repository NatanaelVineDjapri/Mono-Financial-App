// Account detail reads. The screen only reads through these hooks; every figure comes from
// src/domain/accountDetail.ts (views underneath) and is refetched after any write.
import { useQuery } from '@tanstack/react-query';

import { nowIso } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getAccountDetail, listAccountActivity, type ActivityFilter, type ActivityKind } from '@/domain/accountDetail';
import { activityKindLabel } from '@/i18n/id';

export function useAccountDetail(id: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'detail', id],
    queryFn: () => getAccountDetail(db, id, nowIso()),
  });
}

const kindFallback = (kind: ActivityKind): string => activityKindLabel(kind);

export function useAccountActivity(id: number, period: string | undefined, filter: ActivityFilter) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'activity', id, period ?? null, filter],
    queryFn: () => listAccountActivity(db, id, period as string, filter, kindFallback),
    enabled: !!period,
  });
}
