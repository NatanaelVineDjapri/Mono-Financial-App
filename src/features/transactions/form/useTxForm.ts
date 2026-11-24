// The transaction form's reads and its two submit paths (add, edit). The route files stay thin:
// they pick one of these and hand it to <TransactionForm>. Saving goes through
// src/core/tx/save.ts (one exclusive SQLite transaction each); afterwards the lists refetch,
// and the screen closes. There is no confirmation text afterwards: the lists show the new record.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { nowIso } from '@/core/clock';

import {
  saveNewTransaction,
  saveTransactionChanges,
} from '@/core/tx/save';
import type { TxFormValues } from '@/core/tx/validate';
import type { TxSource } from '@/data/repo/transactions';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getTxFormData, type TxEditRecord, type TxFormData } from '@/domain/txForm';
import { undoFailedMessage } from '@/i18n';

import type { SubmitResult } from './TransactionForm';
import type { TransactionLocationInput } from '@/core/tx/save';

export function useTxFormData(editId?: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'form', editId ?? 'new'],
    queryFn: () => getTxFormData(db, editId),
    // The form must open on the balances of this moment, not on a cached copy.
    staleTime: 0,
    gcTime: 0,
  });
}

// Add: save, then close. `source` is where the record came from: the form itself (default), or a reviewed receipt scan ('scan').
export function useAddSubmit(data: TxFormData | undefined, source: TxSource = 'manual', location?: TransactionLocationInput | null) {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (values: TxFormValues): Promise<SubmitResult> => {
      const result = await saveNewTransaction(db, values, nowIso(), source, location);
      if (!result.ok) return result;

      await invalidateAfterWrite(queryClient);
      router.back();
      return { ok: true };
    },
    [db, queryClient, router, source, location],
  );
}

// Edit: the same row is updated, then back to its detail.
export function useEditSubmit(record: TxEditRecord | null | undefined, placeName?: string) {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (values: TxFormValues): Promise<SubmitResult> => {
      if (!record) return { ok: false, message: undoFailedMessage() };
       const result = await saveTransactionChanges(db, record.id, values, nowIso(), record.location ? { latE6: record.location.lat_e6, lngE6: record.location.lng_e6, accuracyM: record.location.accuracy_m, capturedAt: record.location.captured_at, placeName: placeName ?? record.location.place_name ?? undefined } : null);
      if (!result.ok) return result;

      await invalidateAfterWrite(queryClient);
      router.back();
      return { ok: true };
    },
    [db, queryClient, router, record, placeName],
  );
}
