// Saving the drafts the person chose (CLAUDE.md rule 9: nothing is written until Simpan). The
// whole selection goes in ONE exclusive SQLite transaction, through the same writer as the
// manual form (core/tx/save.ts), with source = 'ai': either every chosen draft is stored or
// none is. Only a `ready` draft can be saved, and that is enforced here in the domain, not just
// by a disabled button. The schema's guards remain the backstop; a code that still gets through
// is worded by mapDbError.
import type { Db } from '../../data/db/types';
import { getPocketBalanceNow } from '../../data/repo/transactionDetail';
import { deleteTransaction } from '../../domain/transactions';
import { aiMsgNotReady } from '../../i18n/id';
import { failure, writeNewTransaction, type SaveOutcome } from '../../core/tx/save';
import type { TxType } from '../../core/tx/validate';
import { missingFields, toFormValues, type Draft } from './draft';

export interface SavedDraft {
  draftId: string;
  id: number; // the transaction row
  type: TxType;
  accountId: number;
  toAccountId: number | null;
}

export interface SavedBatch {
  ids: number[]; // every row of the batch, for Urungkan
  saved: SavedDraft[];
  // Each touched account's balance after the commit, read from the view.
  balances: { accountId: number; balance: number }[];
}

export function canSave(draft: Draft): boolean {
  return draft.status.kind === 'ready' && draft.amountCheck == null && missingFields(draft).length === 0;
}

export async function saveDrafts(db: Db, drafts: readonly Draft[], selectedIds: readonly string[], now: string): Promise<SaveOutcome<SavedBatch>> {
  const wanted = new Set(selectedIds);
  const chosen = drafts.filter(d => wanted.has(d.id));
  if (chosen.length === 0 || chosen.length !== wanted.size || !chosen.every(canSave)) {
    return { ok: false, message: aiMsgNotReady() };
  }

  const saved: SavedDraft[] = [];
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      for (const draft of chosen) {
        const id = await writeNewTransaction(txn, toFormValues(draft), now, 'ai');
        saved.push({
          draftId: draft.id,
          id,
          type: draft.type as TxType,
          accountId: draft.accountId as number,
          toAccountId: draft.type === 'transfer' ? draft.toAccountId : null,
        });
      }
    });
  } catch (error) {
    return failure(error, now.slice(0, 10));
  }

  const accountIds = [...new Set(saved.flatMap(s => (s.toAccountId != null ? [s.accountId, s.toAccountId] : [s.accountId])))];
  const balances = await Promise.all(accountIds.map(async accountId => ({ accountId, balance: (await getPocketBalanceNow(db, accountId, 'IDR')) ?? 0 })));
  return { ok: true, value: { ids: saved.map(s => s.id), saved, balances } };
}

// Urungkan: every row of the batch goes, in one transaction, and the balances go back.
export async function undoDrafts(db: Db, ids: readonly number[]): Promise<SaveOutcome<null>> {
  try {
    await db.withExclusiveTransactionAsync(async txn => {
      for (const id of ids) await deleteTransaction(txn, id);
    });
    return { ok: true, value: null };
  } catch (error) {
    return failure(error, '');
  }
}
