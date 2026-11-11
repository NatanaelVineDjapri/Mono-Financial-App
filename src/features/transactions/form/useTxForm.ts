// The transaction form's reads and its two submit paths (add, edit). The route files stay thin:
// they pick one of these and hand it to <TransactionForm>. Saving goes through
// src/core/tx/save.ts (one exclusive SQLite transaction each); afterwards the lists refetch,
// the screen closes and a snackbar states the result in numbers read back from the views, with
// an Undo that lasts as long as the snackbar does.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { nowIso } from '@/core/clock';
import { rp, shown } from '@/core/money';
import {
  saveNewTransaction,
  saveTransactionChanges,
  undoNewTransaction,
  undoTransactionChanges,
} from '@/core/tx/save';
import type { TxFormValues } from '@/core/tx/validate';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getTxFormData, type TxEditRecord, type TxFormData } from '@/domain/txForm';
import { changesSavedMessage, txSavedMessage, undoFailedMessage, undoLabel } from '@/i18n/id';

import type { SubmitResult } from './TransactionForm';

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

// Add: save, close, then "Expense saved. BCA Tabungan is now Rp6.717.500." with Undo.
export function useAddSubmit(data: TxFormData | undefined) {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (values: TxFormValues): Promise<SubmitResult> => {
      const result = await saveNewTransaction(db, values, nowIso());
      if (!result.ok) return result;
      const saved = result.value;

      const hidden = useHideAmounts.getState().hidden;
      const name = (id: number | null) => data?.accounts.find(a => a.id === id)?.name ?? '';
      const message = txSavedMessage(
        saved.type,
        name(saved.accountId),
        shown(rp(saved.accountBalanceAfter), hidden),
        saved.toAccountId != null ? name(saved.toAccountId) : undefined,
        saved.toAccountBalanceAfter != null ? shown(rp(saved.toAccountBalanceAfter), hidden) : undefined,
      );

      await invalidateAfterWrite(queryClient);
      router.back();
      showToast(message, {
        actionLabel: undoLabel(),
        onAction: () => {
          void (async () => {
            const undone = await undoNewTransaction(db, saved.id);
            if (undone.ok) await invalidateAfterWrite(queryClient);
            else showToast(undone.message || undoFailedMessage());
          })();
        },
      });
      return { ok: true };
    },
    [db, queryClient, router, data],
  );
}

// Edit: the same row is updated, then back to its detail with "Changes saved." and an Undo that
// writes the old values back.
export function useEditSubmit(record: TxEditRecord | null | undefined) {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (values: TxFormValues): Promise<SubmitResult> => {
      if (!record) return { ok: false, message: undoFailedMessage() };
      const result = await saveTransactionChanges(db, record.id, values, nowIso());
      if (!result.ok) return result;

      await invalidateAfterWrite(queryClient);
      router.back();
      showToast(changesSavedMessage(), {
        actionLabel: undoLabel(),
        onAction: () => {
          void (async () => {
            const undone = await undoTransactionChanges(db, record.snapshot, nowIso());
            if (undone.ok) await invalidateAfterWrite(queryClient);
            else showToast(undone.message || undoFailedMessage());
          })();
        },
      });
      return { ok: true };
    },
    [db, queryClient, router, record],
  );
}
