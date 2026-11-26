// Savings budget reads: through src/domain/savings.ts only (income and expense come from
// the period view; nothing but the target is stored).
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getSavingsStatus, getSavingsTarget } from '@/domain/savings';

export function useSavingsStatus(month: string) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.budgets, 'savings', month],
    queryFn: () => getSavingsStatus(db, month),
  });
}

export function useSavingsTarget() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.budgets, 'savings-target'],
    queryFn: () => getSavingsTarget(db),
  });
}
