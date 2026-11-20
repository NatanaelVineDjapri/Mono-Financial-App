// The review queue of the notification import (migration v11). SQL in, plain objects out. Only parsed fields live
// here: there is no place for a notification's title or text (CLAUDE.md rule 17). The rules (an item becomes a
// transaction only on Simpan, through the same domain function as a manual one) are in src/domain/importQueue.ts.
import type { Db } from '../db/types';

export type QueueStatus = 'pending' | 'rejected' | 'saved';
export type QueueKind = 'income' | 'expense';

export interface QueueRow {
  id: number;
  package: string;
  app_name: string;
  account_id: number;
  kind: QueueKind | null; // null: needs checking (the person chooses)
  amount_idr: number;
  merchant: string;
  category_id: number | null; // null: the person has to choose one
  guessed: number; // 1: still as the parser/memory guessed it ("Ditebak"), 0: the person has confirmed or changed it
  occurred_at: string; // ISO with the WIB offset
  fingerprint: string;
  status: QueueStatus;
  created_at: string;
}

export interface QueueRowWithNames extends QueueRow {
  account_name: string;
  category_name: string | null;
}

export interface NewQueueItem {
  package: string;
  appName: string;
  accountId: number;
  kind: QueueKind | null;
  amountIdr: number;
  merchant: string;
  categoryId: number | null;
  occurredAt: string;
  fingerprint: string;
  createdAt: string;
}

// One row per notification: the same fingerprint (or a rejected or saved one coming back) is ignored. True when added.
export async function insertQueueItem(db: Db, item: NewQueueItem): Promise<boolean> {
  const result = await db.runAsync(
    `insert or ignore into import_queue (package, app_name, account_id, kind, amount_idr, merchant, category_id, guessed, occurred_at, fingerprint, created_at)
     values ($package, $appName, $accountId, $kind, $amount, $merchant, $categoryId, 1, $occurredAt, $fingerprint, $createdAt)`,
    {
      $package: item.package,
      $appName: item.appName,
      $accountId: item.accountId,
      $kind: item.kind,
      $amount: item.amountIdr,
      $merchant: item.merchant.slice(0, 80),
      $categoryId: item.categoryId,
      $occurredAt: item.occurredAt,
      $fingerprint: item.fingerprint,
      $createdAt: item.createdAt,
    },
  );
  return result.changes > 0;
}

const SELECT_WITH_NAMES = `
  select q.*, a.name as account_name, c.name as category_name
  from import_queue q
  join accounts a on a.id = q.account_id
  left join categories c on c.id = q.category_id`;

// Newest first.
export async function listPending(db: Db): Promise<QueueRowWithNames[]> {
  return db.getAllAsync<QueueRowWithNames>(`${SELECT_WITH_NAMES} where q.status = 'pending' order by q.occurred_at desc, q.id desc`);
}

export async function getQueueItem(db: Db, id: number): Promise<QueueRowWithNames | null> {
  return db.getFirstAsync<QueueRowWithNames>(`${SELECT_WITH_NAMES} where q.id = $id`, { $id: id });
}

export async function countPending(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("select count(*) as n from import_queue where status = 'pending'");
  return row?.n ?? 0;
}

export interface QueuePatch {
  kind?: QueueKind | null;
  amountIdr?: number;
  merchant?: string;
  categoryId?: number | null;
  accountId?: number;
  occurredAt?: string;
  guessed?: boolean;
}

export async function updateQueueItem(db: Db, id: number, patch: QueuePatch): Promise<void> {
  const fields: string[] = [];
  const params: Record<string, string | number | null> = { $id: id };
  if (patch.kind !== undefined) { fields.push('kind = $kind'); params.$kind = patch.kind; }
  if (patch.amountIdr !== undefined) { fields.push('amount_idr = $amount'); params.$amount = patch.amountIdr; }
  if (patch.merchant !== undefined) { fields.push('merchant = $merchant'); params.$merchant = patch.merchant.slice(0, 80); }
  if (patch.categoryId !== undefined) { fields.push('category_id = $categoryId'); params.$categoryId = patch.categoryId; }
  if (patch.accountId !== undefined) { fields.push('account_id = $accountId'); params.$accountId = patch.accountId; }
  if (patch.occurredAt !== undefined) { fields.push('occurred_at = $occurredAt'); params.$occurredAt = patch.occurredAt; }
  if (patch.guessed !== undefined) { fields.push('guessed = $guessed'); params.$guessed = patch.guessed ? 1 : 0; }
  if (fields.length === 0) return;
  await db.runAsync(`update import_queue set ${fields.join(', ')} where id = $id`, params);
}

// Rejected and saved rows stay (the fingerprint is what stops the same notification coming back) until they are old.
export async function setQueueStatus(db: Db, id: number, status: QueueStatus): Promise<void> {
  await db.runAsync('update import_queue set status = $status where id = $id', { $id: id, $status: status });
}

export async function pruneQueue(db: Db, beforeIso: string): Promise<void> {
  await db.runAsync("delete from import_queue where status <> 'pending' and created_at < $before", { $before: beforeIso });
}

// ---------------------------------------------------------------- the merchant memory

export async function getMerchantCategory(db: Db, merchantKey: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ category_id: number }>('select category_id from import_merchant_memory where merchant_key = $key', { $key: merchantKey });
  return row?.category_id ?? null;
}

export async function setMerchantCategory(db: Db, merchantKey: string, categoryId: number, now: string): Promise<void> {
  await db.runAsync(
    `insert into import_merchant_memory (merchant_key, category_id, updated_at) values ($key, $categoryId, $now)
     on conflict(merchant_key) do update set category_id = excluded.category_id, updated_at = excluded.updated_at`,
    { $key: merchantKey, $categoryId: categoryId, $now: now },
  );
}

export async function forgetMerchant(db: Db, merchantKey: string): Promise<void> {
  await db.runAsync('delete from import_merchant_memory where merchant_key = $key', { $key: merchantKey });
}
