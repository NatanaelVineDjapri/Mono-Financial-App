// Reads and writes of the sub-categories of one category (the category edit screen). Every write invalidates all cached reads
// (invalidateAfterWrite), so the Add transaction form and the lists see the change at once.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';

import { archiveSubcategory, createSubcategory, deleteSubcategory, listForCategory, renameSubcategory, restoreSubcategory } from './subcategories';

export function useSubcategories(categoryId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.categories, 'subcategories', categoryId ?? 'none'],
    enabled: categoryId != null,
    queryFn: () => listForCategory(db, categoryId as number),
  });
}

export function useSubcategoryActions(categoryId: number) {
  const db = useDb();
  const queryClient = useQueryClient();
  const after = useCallback(
    async <T extends { ok: boolean }>(result: T): Promise<T> => {
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [queryClient],
  );
  return {
    create: useCallback((name: string) => createSubcategory(db, categoryId, name).then(after), [db, categoryId, after]),
    rename: useCallback((id: number, name: string) => renameSubcategory(db, id, name).then(after), [db, after]),
    archive: useCallback((id: number) => archiveSubcategory(db, id).then(after), [db, after]),
    restore: useCallback((id: number) => restoreSubcategory(db, id).then(after), [db, after]),
    remove: useCallback((id: number) => deleteSubcategory(db, id).then(after), [db, after]),
  };
}
