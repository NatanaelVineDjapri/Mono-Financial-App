// Reads and writes of the Categories screens. Every read goes through the domain (categories.ts);
// every write invalidates all cached reads (invalidateAfterWrite), so lists, pickers, budgets and
// the Add transaction form see the change at once.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { nowIso } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getCategory, type CategoryKind } from '@/data/repo/categories';

import { archiveCategory, checkArchivable, createCategory, getCategoryOverview, getUsage, listAllForNameCheck, listArchived, restoreCategory, updateCategory } from './categories';

export function useCategoryOverview() {
  const db = useDb();
  return useQuery({ queryKey: [...queryKeys.categories, 'overview'], queryFn: () => getCategoryOverview(db, nowIso()) });
}

export function useArchivedCategories() {
  const db = useDb();
  return useQuery({ queryKey: [...queryKeys.categories, 'archived'], queryFn: () => listArchived(db) });
}

// The form's data: the category being edited (null for a new one), its usage, and every name that
// is taken (archived ones too).
export function useCategoryFormData(id: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.categories, 'form', id ?? 'new'],
    queryFn: async () => {
      const [all, category, usage] = await Promise.all([
        listAllForNameCheck(db),
        id != null ? getCategory(db, id) : Promise.resolve(null),
        id != null ? getUsage(db, id, nowIso()) : Promise.resolve(null),
      ]);
      return { all, category, usage };
    },
  });
}

export function useCategoryActions() {
  const db = useDb();
  const queryClient = useQueryClient();

  const create = useCallback(
    async (input: { kind: CategoryKind; name: string; icon: string }) => {
      const result = await createCategory(db, input);
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  const update = useCallback(
    async (id: number, fields: { name: string; icon: string; kind?: CategoryKind }) => {
      const result = await updateCategory(db, id, fields, nowIso());
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  const archive = useCallback(
    async (id: number) => {
      const result = await archiveCategory(db, id);
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  const restore = useCallback(
    async (id: number) => {
      const result = await restoreCategory(db, id);
      if (result.ok) await invalidateAfterWrite(queryClient);
      return result;
    },
    [db, queryClient],
  );

  const canArchive = useCallback((id: number) => checkArchivable(db, id), [db]);

  return { create, update, archive, restore, canArchive };
}
