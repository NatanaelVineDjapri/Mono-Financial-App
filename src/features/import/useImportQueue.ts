// The review queue for the screens: reads through react-query, every write through src/domain/importQueue.ts
// (Simpan goes through the same save function as a manual transaction) and then refreshes everything.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import type { QueuePatch } from '@/data/repo/importQueue';
import { getQueueEntry, listQueue, rejectQueueItem, saveAllComplete, saveQueueItem, updateQueueEntry, type SaveOptions } from '@/domain/importQueue';

export function useImportQueue() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.importQueue, 'list'],
    queryFn: () => listQueue(db),
    staleTime: 0,
  });
}

export function useImportQueueItem(id: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.importQueue, 'item', id],
    queryFn: () => getQueueEntry(db, id),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useImportQueueActions() {
  const db = useDb();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => invalidateAfterWrite(queryClient), [queryClient]);

  return {
    save: useCallback(
      async (id: number, options?: SaveOptions) => {
        const outcome = await saveQueueItem(db, id, options);
        if (outcome.ok) await refresh();
        return outcome;
      },
      [db, refresh],
    ),
    saveAll: useCallback(async () => {
      const result = await saveAllComplete(db);
      if (result.saved > 0) await refresh();
      return result;
    }, [db, refresh]),
    reject: useCallback(
      async (id: number) => {
        await rejectQueueItem(db, id);
        await refresh();
      },
      [db, refresh],
    ),
    update: useCallback(
      async (id: number, patch: Omit<QueuePatch, 'guessed'>) => {
        await updateQueueEntry(db, id, patch);
        await refresh();
      },
      [db, refresh],
    ),
  };
}
