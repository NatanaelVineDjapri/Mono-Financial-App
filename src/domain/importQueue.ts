// The review queue of the notification import (CLAUDE.md rules 14 and 17, docs/IMPORT_PLAN.md section 6).
//
//  - enqueueNotification: one raw notification from the native listener in, at most one queue row out. The title and
//    text are read here and dropped; only the parsed fields are stored. Anything that is not from an app the person
//    switched on (with a rupiah account), not a transaction, or already seen is ignored.
//  - saveQueueItem: the ONLY way a queue row becomes a transaction, and only when the person taps Simpan. It goes
//    through validateTx and saveNewTransaction like a manual one (all guards and amount_idr apply), source 'import'.
//
// No network, no AI. Category: the person's own merchant memory, then keyword rules, otherwise empty.
import { formatShortDate } from '../core/date';
import { isoFromMillis, nowIso, today } from '../core/clock';
import { rp } from '../core/money';
import { saveNewTransaction, type SaveOutcome } from '../core/tx/save';
import { validateTx, type TxFormValues } from '../core/tx/validate';
import type { Db } from '../data/db/types';
import { getImportApp } from '../data/repo/importApps';
import { recordImportOutcome } from '../data/repo/importStats';
import {
  countPending,
  forgetMerchant,
  getMerchantCategory,
  getQueueItem,
  insertQueueItem,
  listPending,
  pruneQueue,
  setMerchantCategory,
  setQueueStatus,
  updateQueueItem,
  type QueueKind,
  type QueuePatch,
  type QueueRowWithNames,
} from '../data/repo/importQueue';
import { merchantKey, suggestCategory } from '../features/import/categorize';
import { explainNotification } from '../features/import/parsers';
import { importItemGone, importNeedsKind, txFieldErrorMessage } from '../i18n';
import { getTxFormData } from './txForm';

export interface IncomingNotification {
  package: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  postedAt: number; // epoch milliseconds
}

export type EnqueueResult = 'added' | 'ignored';

const TIME_BUCKET_MS = 2 * 60 * 1000;
const KEEP_DAYS = 60;

// The same payment shows up twice (an app posts, then updates its notification): the same app, kind, amount and
// merchant within about two minutes are one. Plain text, not a hash: it holds no message text.
export function fingerprintOf(pkg: string, kind: QueueKind | null, amountIdr: number, merchant: string, postedAt: number): string {
  return [pkg, kind ?? '?', amountIdr, merchantKey(merchant), Math.floor(postedAt / TIME_BUCKET_MS)].join('|');
}

export interface EnqueueOptions {
  // Read again from the notification shade: it may well have been handled before, so only a new row is counted.
  seenAgain?: boolean;
}

export async function enqueueNotification(db: Db, raw: IncomingNotification, { seenAgain = false }: EnqueueOptions = {}): Promise<EnqueueResult> {
  const app = await getImportApp(db, raw.package);
  if (!app || app.enabled !== 1 || app.account_id == null) return 'ignored';

  // The account must still be a live rupiah one (the Valas account is never written by the import, rule 19).
  const account = await db.getFirstAsync<{ type: string; archived: number }>('select type, archived from accounts where id = $id', { $id: app.account_id });
  if (!account || account.archived === 1 || account.type === 'forex') {
    if (!seenAgain) await recordImportOutcome(db, raw.package, 'no_account');
    return 'ignored';
  }

  // The longer of the two texts usually holds the whole message.
  const body = raw.bigText && raw.bigText.length >= (raw.text?.length ?? 0) ? raw.bigText : raw.text;
  const outcome = explainNotification(raw.package, raw.title, body);
  if (!outcome.parsed) {
    // Only the reason is counted, never the text: it lets the person see why an app's notifications do not become transactions.
    if (!seenAgain) await recordImportOutcome(db, raw.package, outcome.dropped);
    return 'ignored';
  }
  const parsed = outcome.parsed;

  const data = await getTxFormData(db);
  const remembered = await getMerchantCategory(db, merchantKey(parsed.merchant));
  const categoryId = suggestCategory({ merchant: parsed.merchant, kind: parsed.kind, categories: data.categories, remembered });

  let occurredAt = isoFromMillis(raw.postedAt);
  if (occurredAt.slice(0, 10) > today()) occurredAt = nowIso(); // a clock that ran ahead never makes a future date

  const added = await insertQueueItem(db, {
    package: raw.package,
    appName: app.app_name,
    accountId: app.account_id,
    kind: parsed.kind,
    amountIdr: parsed.amountIdr,
    merchant: parsed.merchant,
    categoryId,
    occurredAt,
    fingerprint: fingerprintOf(raw.package, parsed.kind, parsed.amountIdr, parsed.merchant, raw.postedAt),
    createdAt: nowIso(),
  });
  if (added || !seenAgain) await recordImportOutcome(db, raw.package, added ? 'queued' : 'duplicate');
  return added ? 'added' : 'ignored';
}

export async function listQueue(db: Db): Promise<QueueRowWithNames[]> {
  return listPending(db);
}

export async function countQueue(db: Db): Promise<number> {
  return countPending(db);
}

export async function getQueueEntry(db: Db, id: number): Promise<QueueRowWithNames | null> {
  return getQueueItem(db, id);
}

// What the person changed on the edit screen. Anything touched is no longer "Ditebak".
export async function updateQueueEntry(db: Db, id: number, patch: Omit<QueuePatch, 'guessed'>): Promise<void> {
  await updateQueueItem(db, id, { ...patch, guessed: false });
}

export async function rejectQueueItem(db: Db, id: number): Promise<void> {
  await setQueueStatus(db, id, 'rejected');
}

// Old rejected and saved rows are only kept to stop the same notification coming back.
export async function pruneOldQueue(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await pruneQueue(db, cutoff);
}

export function isComplete(item: Pick<QueueRowWithNames, 'kind' | 'category_id'>): boolean {
  return item.kind !== null && item.category_id !== null;
}

export interface SaveOptions {
  rememberMerchant?: boolean; // remember the category for this merchant
  subcategoryId?: number | null; // chosen on the check screen (the queue itself keeps only the category)
}

// Simpan. Only a pending row with a kind and a category; the same checks as the manual form, then one normal
// transaction (amount_idr is its own amount in rupiah) and the row is marked saved.
export async function saveQueueItem(db: Db, id: number, options: SaveOptions = {}): Promise<SaveOutcome<{ transactionId: number }>> {
  const item = await getQueueItem(db, id);
  if (!item || item.status !== 'pending') return { ok: false, message: importItemGone() };
  if (item.kind === null) return { ok: false, message: importNeedsKind() };
  if (item.category_id === null) return { ok: false, message: txFieldErrorMessage({ code: 'category_required', type: item.kind }, rp, formatShortDate).text };

  const data = await getTxFormData(db);
  const values: TxFormValues = {
    type: item.kind,
    amount: item.amount_idr,
    categoryId: item.category_id,
    subcategoryId: options.subcategoryId ?? null,
    accountId: item.account_id,
    toAccountId: null,
    date: item.occurred_at.slice(0, 10),
    description: item.merchant || item.app_name,
    note: '',
  };
  const errors = validateTx(values, { today: today(), accounts: data.accounts, categories: data.categories, subcategories: data.subcategories });
  if (errors.length > 0) return { ok: false, message: txFieldErrorMessage({ ...errors[0], type: item.kind }, rp, formatShortDate).text };

  const outcome = await saveNewTransaction(db, values, nowIso(), 'import');
  if (!outcome.ok) return outcome;

  await setQueueStatus(db, id, 'saved');
  const key = merchantKey(item.merchant);
  if (key) {
    if (options.rememberMerchant) await setMerchantCategory(db, key, item.category_id, nowIso());
    else if (options.rememberMerchant === false) await forgetMerchant(db, key);
  }
  return { ok: true, value: { transactionId: outcome.value.id } };
}

// "Simpan N yang lengkap": every pending row that already has a kind and a category. A row that fails its checks
// stays in the queue so the person can fix it.
export async function saveAllComplete(db: Db): Promise<{ saved: number; failed: number }> {
  const pending = await listPending(db);
  let saved = 0;
  let failed = 0;
  for (const item of pending) {
    if (!isComplete(item)) continue;
    const outcome = await saveQueueItem(db, item.id);
    if (outcome.ok) saved += 1;
    else failed += 1;
  }
  return { saved, failed };
}
