// Budgets reads (Fase 4.4). The screens only read through these hooks; every figure
// comes from src/domain/budget.ts, which reads the SQL views (CLAUDE.md rule 2).
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getBudgetFormContext, getBudgetOverview, getCategoryBudgetDetail } from '@/domain/budget';

// `month` null = the current period (resolved in the domain layer from month_start_day).
export function useBudgetOverview(month: string | null) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...queryKeys.budgets, 'overview', month ?? 'current'],
    queryFn: async () => {
      const overview = await getBudgetOverview(db, month, today());
      // Opening the current month may copy a repeating limit forward (ensureMonth).
      // Other screens that read the month's limit (the Transactions ring) refresh then.
      if (overview.monthCreated) {
        void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] !== queryKeys.budgets[0] });
      }
      return overview;
    },
  });
}

export function useCategoryBudgetDetail(categoryId: number, month: string) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.budgets, 'category', categoryId, month],
    queryFn: () => getCategoryBudgetDetail(db, categoryId, month),
  });
}

export function useBudgetFormContext(month: string, categoryId?: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.budgets, 'form', month, categoryId ?? null],
    queryFn: () => getBudgetFormContext(db, month, categoryId),
  });
}
