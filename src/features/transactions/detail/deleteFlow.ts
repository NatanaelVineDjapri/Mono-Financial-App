// Delete a transaction with a way back (Tx-Delete): the record goes in one statement, the
// caller leaves the screen, and a snackbar offers Undo, which puts the very same record
// back (same id). No network, no stored numbers: balances and budgets are views, so they
// follow by themselves once the lists refetch.
import type { QueryClient } from '@tanstack/react-query';

import { showToast } from '@/components/toast-store';
import type { Db } from '@/data/db/types';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { DomainError } from '@/domain/errors';
import { deleteTransactionWithSnapshot, restoreTransaction } from '@/domain/transactions';
import {
  deleteBlockedMessage,
  deleteFailedMessage,
  guardMessage,
  transactionDeletedMessage,
  transactionRestoreFailedMessage,
  undoLabel,
} from '@/i18n';

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof DomainError) {
    // Deleting an income that has already been spent would take the account below zero.
    return error.code === 'insufficient_balance' ? deleteBlockedMessage() : guardMessage(error.code, error.context);
  }
  return fallback;
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

// Deletes the record, then lets the caller leave the screen (`onDeleted`) BEFORE the lists
// refetch, and shows a snackbar with Undo. A failed delete changes nothing and returns its
// message.
export async function deleteTransactionWithUndo(
  db: Db,
  queryClient: QueryClient,
  id: number,
  onDeleted: () => void,
): Promise<DeleteResult> {
  let snapshot;
  try {
    snapshot = await deleteTransactionWithSnapshot(db, id);
  } catch (error) {
    return { ok: false, message: messageFor(error, deleteFailedMessage()) };
  }
  if (!snapshot) return { ok: false, message: deleteFailedMessage() };

  onDeleted();
  await invalidateAfterWrite(queryClient);
  showToast(transactionDeletedMessage(), {
    actionLabel: undoLabel(),
    onAction: () => {
      void (async () => {
        try {
          await restoreTransaction(db, snapshot);
          await invalidateAfterWrite(queryClient);
        } catch (error) {
          showToast(messageFor(error, transactionRestoreFailedMessage()));
        }
      })();
    },
  });
  return { ok: true };
}
