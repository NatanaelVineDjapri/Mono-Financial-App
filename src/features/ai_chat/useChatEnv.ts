// The chat's wiring to the app: the database, the query cache, the snackbar, hidden-amounts mode
// and the clock. The functions in chatActions.ts take this, so they never touch a hook.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { nowIso, today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getTxFormData } from '@/domain/txForm';

import type { ChatEnv } from './chatActions';
import type { Names } from './ui/draftView';

export function useChatEnv(): ChatEnv {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      db,
      invalidate: () => invalidateAfterWrite(queryClient),
      showToast,
      isHidden: () => useHideAmounts.getState().hidden,
      now: nowIso,
      today,
    }),
    [db, queryClient],
  );
}

// Names for the cards (ids in a draft, names on screen). Read again after every write.
export function useChatNames(): Names {
  const db = useDb();
  const { data } = useQuery({
    queryKey: [...queryKeys.transactions, 'ai-chat-names'],
    queryFn: () => getTxFormData(db),
    staleTime: 0,
  });
  return useMemo(
    () => ({
      accounts: new Map((data?.accounts ?? []).map(a => [a.id, a.name] as const)),
      categories: new Map((data?.categories ?? []).map(c => [c.id, c.name] as const)),
    }),
    [data],
  );
}

