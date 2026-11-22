// Recording the difference between the card and the account as a normal transaction, through the same checks and the
// same save as the manual form (source 'nfc'). Nothing here writes a balance: the account balance is read from the view
// both before (to get the difference) and after (for the message), and the record is what makes them equal.
import { ADJUSTMENT_CATEGORY_NAME, ADJUSTMENT_DESCRIPTION } from '../../core/cardAdjustment';
import { formatShortDate } from '../../core/date';
import { rp } from '../../core/money';
import { saveNewTransaction, undoNewTransaction } from '../../core/tx/save';
import { validateTx, type TxFormValues } from '../../core/tx/validate';
import type { Db } from '../../data/db/types';
import { findCategoryByName, getAccountBalanceNow, insertSystemCategory, unarchiveCategory } from '../../data/repo/cardLinks';
import { txFieldErrorMessage } from '../../i18n';
import { getTxFormData } from '../txForm';
import { reconcile, type ReconcileAction } from './reconcile';

type AdjustmentKind = Exclude<ReconcileAction, 'none'>;

// The system category of an adjustment, one per kind. It is made if it is not there (a restored older backup has none)
// and brought back if it was archived: the adjustment must always have a category it can use.
export async function ensureAdjustmentCategory(db: Db, kind: AdjustmentKind): Promise<number> {
  const found = await findCategoryByName(db, ADJUSTMENT_CATEGORY_NAME, kind);
  if (found) {
    if (found.archived === 1) await unarchiveCategory(db, found.id);
    return found.id;
  }
  return insertSystemCategory(db, ADJUSTMENT_CATEGORY_NAME, kind);
}

export interface AdjustmentPreview {
  accountId: number;
  appBalance: number;
  cardBalance: number;
  diff: number;
  action: ReconcileAction;
  amount: number;
}

// What the result screen shows: the card, the account in MONO, and the difference.
export async function previewAdjustment(db: Db, accountId: number, cardBalance: number): Promise<AdjustmentPreview | null> {
  const appBalance = await getAccountBalanceNow(db, accountId);
  if (appBalance === null) return null;
  return { accountId, appBalance, cardBalance, ...reconcile(cardBalance, appBalance) };
}

export type AdjustmentResult =
  | { ok: true; value: { transactionId: number; kind: AdjustmentKind; amount: number; balanceAfter: number } }
  | { ok: false; reason: 'nothing_to_record' }
  | { ok: false; reason: 'balance_changed'; preview: AdjustmentPreview } // the account moved since the screen was drawn
  | { ok: false; reason: 'refused'; message: string };

export interface RecordAdjustmentInput {
  accountId: number;
  cardBalance: number;
  expectedDiff: number; // the difference the person saw; if the account has changed since, nothing is recorded
  now: string;
}

export async function recordAdjustment(db: Db, input: RecordAdjustmentInput): Promise<AdjustmentResult> {
  const preview = await previewAdjustment(db, input.accountId, input.cardBalance);
  if (!preview) return { ok: false, reason: 'refused', message: txFieldErrorMessage({ code: 'account_required', type: 'expense' }, rp, formatShortDate).text };
  if (preview.action === 'none') return { ok: false, reason: 'nothing_to_record' };
  if (preview.diff !== input.expectedDiff) return { ok: false, reason: 'balance_changed', preview };

  const kind = preview.action as AdjustmentKind;
  const categoryId = await ensureAdjustmentCategory(db, kind);
  const data = await getTxFormData(db);
  const values: TxFormValues = {
    type: kind,
    amount: preview.amount,
    categoryId,
    accountId: input.accountId,
    toAccountId: null,
    date: input.now.slice(0, 10),
    description: ADJUSTMENT_DESCRIPTION,
    note: '',
  };
  const errors = validateTx(values, { today: input.now.slice(0, 10), accounts: data.accounts, categories: data.categories });
  if (errors.length > 0) return { ok: false, reason: 'refused', message: txFieldErrorMessage({ ...errors[0], type: kind }, rp, formatShortDate).text };

  const outcome = await saveNewTransaction(db, values, input.now, 'nfc');
  if (!outcome.ok) return { ok: false, reason: 'refused', message: outcome.message };
  return { ok: true, value: { transactionId: outcome.value.id, kind, amount: preview.amount, balanceAfter: outcome.value.accountBalanceAfter } };
}

// "Urungkan": that very row goes again and the balance goes back.
export async function undoAdjustment(db: Db, transactionId: number): Promise<boolean> {
  return (await undoNewTransaction(db, transactionId)).ok;
}
