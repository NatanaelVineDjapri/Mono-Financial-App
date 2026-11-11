// Goals data hooks — read-side queries and mutation helpers.
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys, invalidateAfterWrite } from '@/data/queryKeys';
import { listGoalProgress, getGoalProgress, createGoal, updateGoal, deleteGoal } from '@/domain/goals';
import type { NewGoal } from '@/data/repo/goals';

export { type GoalProgressRow } from '@/data/repo/goals';

export function useGoalProgress() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.goals, 'progress'],
    queryFn: () => listGoalProgress(db),
  });
}

export function useGoalById(id: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.goals, 'progress', id],
    queryFn: () => (id != null ? getGoalProgress(db, id) : null),
    enabled: id != null,
  });
}

export function useGoalMutations() {
  const db = useDb();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: NewGoal) => createGoal(db, input, today()),
    onSuccess: () => invalidateAfterWrite(qc),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof updateGoal>[2] }) =>
      updateGoal(db, id, patch),
    onSuccess: () => invalidateAfterWrite(qc),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteGoal(db, id),
    onSuccess: () => invalidateAfterWrite(qc),
  });

  return { create, update, remove };
}
