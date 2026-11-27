// Accounts and their pockets (account_currencies). SQL in, plain objects out — no
// business rules here, those live in src/domain. Reads use the views so a balance is
// never computed outside SQL.
import type { Db } from '../db/types';

export type AccountType = 'bank' | 'cash' | 'ewallet' | 'savings' | 'forex';

export interface NewAccount {
  name: string;
  type: AccountType;
  openingBalance: number; // IDR; must be 0 for type 'forex'
  openingDate: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface AccountRow {
  id: number;
  name: string;
  type: AccountType;
  opening_balance: number;
  opening_date: string;
  icon: string | null;
  sort_order: number;
  archived: number;
  created_at: string;
}

export interface AccountBalance {
  id: number;
  name: string;
  type: AccountType;
  archived: number;
  balance: number; // rupiah
  missing_rates: number; // count of pockets with no fx rate
}

export async function createAccount(db: Db, input: NewAccount, now: string): Promise<number> {
  const result = await db.runAsync(
    'insert into accounts (name, type, opening_balance, opening_date, icon, sort_order, created_at) values ($name, $type, $openingBalance, $openingDate, $icon, $sortOrder, $now)',
    {
      $name: input.name,
      $type: input.type,
      $openingBalance: input.openingBalance,
      $openingDate: input.openingDate,
      $icon: input.icon ?? null,
      $sortOrder: input.sortOrder ?? 0,
      $now: now,
    },
  );
  return result.lastInsertRowId;
}

export async function updateAccount(
  db: Db,
  id: number,
  patch: Partial<Pick<NewAccount, 'name' | 'type' | 'openingBalance' | 'openingDate' | 'icon' | 'sortOrder'>> & { archived?: boolean },
): Promise<void> {
  const fields: string[] = [];
  const params: Record<string, string | number | null> = { $id: id };
  if (patch.name !== undefined) { fields.push('name = $name'); params.$name = patch.name; }
  if (patch.type !== undefined) { fields.push('type = $type'); params.$type = patch.type; }
  if (patch.openingBalance !== undefined) { fields.push('opening_balance = $openingBalance'); params.$openingBalance = patch.openingBalance; }
  if (patch.openingDate !== undefined) { fields.push('opening_date = $openingDate'); params.$openingDate = patch.openingDate; }
  if (patch.icon !== undefined) { fields.push('icon = $icon'); params.$icon = patch.icon; }
  if (patch.sortOrder !== undefined) { fields.push('sort_order = $sortOrder'); params.$sortOrder = patch.sortOrder; }
  if (patch.archived !== undefined) { fields.push('archived = $archived'); params.$archived = patch.archived ? 1 : 0; }
  if (fields.length === 0) return;
  await db.runAsync(`update accounts set ${fields.join(', ')} where id = $id`, params);
}

export async function reorderAccounts(db: Db, orderedIds: number[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async txn => {
    for (let i = 0; i < orderedIds.length; i++) {
      await txn.runAsync('update accounts set sort_order = $order where id = $id', {
        $order: i,
        $id: orderedIds[i],
      });
    }
  });
}

export async function getAccount(db: Db, id: number): Promise<AccountBalance | null> {
  return db.getFirstAsync<AccountBalance>('select * from v_account_balance where id = $id', { $id: id });
}

export async function listAccounts(db: Db, opts: { includeArchived?: boolean } = {}): Promise<AccountBalance[]> {
  return db.getAllAsync<AccountBalance>(
    opts.includeArchived
      ? 'select * from v_account_balance order by id'
      : 'select * from v_account_balance where archived = 0 order by id',
  );
}

// v_account_balance doesn't carry icon or sort_order (CLAUDE.md rule 2: a view only
// derives balances — these are plain stored columns on `accounts`), so the Accounts tab's
// overview joins them in here rather than reaching into `accounts` directly from a screen.
// The transaction form's account list: each account's balance (a view) with its opening date
// (a plain column, which the form needs to refuse a date before the account existed).
export interface AccountFormRow {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  opening_date: string;
  balance: number; // rupiah
}

export async function listAccountsForForm(db: Db): Promise<AccountFormRow[]> {
  return db.getAllAsync<AccountFormRow>(
    `select a.id, a.name, a.type, a.icon, a.opening_date, vb.balance
     from accounts a
     join v_account_balance vb on vb.id = a.id
     where a.archived = 0
     order by a.sort_order, a.id`,
  );
}

export interface AccountOverviewRow extends AccountBalance {
  icon: string | null;
  sort_order: number;
}

export async function listAccountsForOverview(db: Db): Promise<AccountOverviewRow[]> {
  return db.getAllAsync<AccountOverviewRow>(
    `select vb.*, a.icon, a.sort_order
     from v_account_balance vb
     join accounts a on a.id = vb.id
     where vb.archived = 0
     order by a.sort_order, vb.id`,
  );
}

// Per-type subtotal (CLAUDE.md rule 2: summed in SQL from v_account_balance, not in JS).
export interface AccountGroupSubtotal {
  type: AccountType;
  count: number;
  subtotal: number; // rupiah
}

export async function listAccountGroupSubtotals(db: Db): Promise<AccountGroupSubtotal[]> {
  return db.getAllAsync<AccountGroupSubtotal>(
    `select type, count(*) as count, sum(balance) as subtotal
     from v_account_balance
     where archived = 0
     group by type`,
  );
}

// v_pocket_balance: the pocket's own balance, not valued in rupiah.
export interface PocketBalance {
  account_id: number;
  currency: string;
  minor_factor: number;
  archived: number;
  balance: number; // minor units of `currency`
}

// v_pocket_value: valued in rupiah at the newest rate. Does not carry minor_factor or
// archived — join v_pocket_balance (listPocketBalances) if those are needed too.
export interface PocketValue {
  account_id: number;
  currency: string;
  balance: number; // minor units of `currency`
  rate_e4: number | null;
  rate_at: string | null;
  value_idr: number | null; // null when the pocket has no rate yet
}

// v_pocket: every (account, currency) pair that can hold money, with its opening
// balance/date — one implicit IDR pocket per non-forex account, plus forex pockets.
export interface PocketRecord {
  account_id: number;
  currency: string;
  opening_balance: number;
  opening_date: string;
  archived: number;
}

export async function getPocket(db: Db, accountId: number, currency: string): Promise<PocketRecord | null> {
  return db.getFirstAsync<PocketRecord>('select * from v_pocket where account_id = $accountId and currency = $currency', {
    $accountId: accountId,
    $currency: currency,
  });
}

export async function addPocket(db: Db, accountId: number, currency: string, openingBalance: number, openingDate: string): Promise<void> {
  await db.runAsync(
    'insert into account_currencies (account_id, currency, opening_balance, opening_date) values ($accountId, $currency, $openingBalance, $openingDate)',
    { $accountId: accountId, $currency: currency, $openingBalance: openingBalance, $openingDate: openingDate },
  );
}

export async function archivePocket(db: Db, accountId: number, currency: string): Promise<void> {
  await db.runAsync('update account_currencies set archived = 1 where account_id = $accountId and currency = $currency', {
    $accountId: accountId,
    $currency: currency,
  });
}

export async function listPocketBalances(db: Db, accountId: number): Promise<PocketBalance[]> {
  return db.getAllAsync<PocketBalance>('select * from v_pocket_balance where account_id = $accountId order by currency', { $accountId: accountId });
}

export async function listPockets(db: Db, accountId: number): Promise<PocketValue[]> {
  return db.getAllAsync<PocketValue>('select * from v_pocket_value where account_id = $accountId order by currency', { $accountId: accountId });
}

export async function getPocketValue(db: Db, accountId: number, currency: string): Promise<PocketValue | null> {
  return db.getFirstAsync<PocketValue>('select * from v_pocket_value where account_id = $accountId and currency = $currency', {
    $accountId: accountId,
    $currency: currency,
  });
}

// ---- archiving and deleting (the rules are src/domain/accounts.ts)

export interface ArchivedAccountRow {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  balance: number; // rupiah
}

export async function listArchivedAccountRows(db: Db): Promise<ArchivedAccountRow[]> {
  return db.getAllAsync<ArchivedAccountRow>(
    `select a.id, a.name, a.type, a.icon, vb.balance
       from accounts a join v_account_balance vb on vb.id = a.id
      where a.archived = 1
      order by a.name`,
  );
}

// How many archived accounts there are and what they still add to net worth.
export async function getArchivedSummary(db: Db): Promise<{ count: number; balance: number }> {
  return (await db.getFirstAsync<{ count: number; balance: number }>(
    'select count(*) as count, coalesce(sum(balance), 0) as balance from v_account_balance where archived = 1',
  ))!;
}

export interface AccountLinks {
  type: AccountType;
  archived: number;
  openingBalance: number;
  openingDate: string;
  records: number; // transactions touching the account, on either side
  fixedExpenses: number; // every fixed expense that points at it, stopped ones too
  activeFixedExpenses: number;
  goals: number;
}

export async function getAccountLinks(db: Db, id: number): Promise<AccountLinks | null> {
  return db.getFirstAsync<AccountLinks>(
    `select type, archived, opening_balance as openingBalance, opening_date as openingDate,
            (select count(*) from transactions where account_id = $id or to_account_id = $id) as records,
            (select count(*) from recurring where account_id = $id) as fixedExpenses,
            (select count(*) from recurring where account_id = $id and archived = 0) as activeFixedExpenses,
            (select count(*) from goals where account_id = $id) as goals
       from accounts where id = $id`,
    { $id: id },
  );
}

export async function countTransfersBetween(db: Db, a: number, b: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'select count(*) as n from transactions where (account_id = $a and to_account_id = $b) or (account_id = $b and to_account_id = $a)',
    { $a: a, $b: b },
  );
  return row!.n;
}

// Merges `from` into `to`: every record, link and the opening balance move, so the two balances become one and net worth
// does not change. A transfer between the two would be a transfer to itself, and cancels out, so it is removed.
// Runs inside the caller's transaction, with the guards off (the rows are only consistent once all have moved).
export async function moveAccount(db: Db, from: number, to: number, now: string): Promise<void> {
  const both = { $from: from, $to: to };
  await db.runAsync('delete from transactions where (account_id = $from and to_account_id = $to) or (account_id = $to and to_account_id = $from)', both);
  await db.runAsync('update transactions set account_id = $to, updated_at = $now where account_id = $from', { ...both, $now: now });
  await db.runAsync('update transactions set to_account_id = $to, updated_at = $now where to_account_id = $from', { ...both, $now: now });
  await db.runAsync('update recurring set account_id = $to where account_id = $from', both);
  await db.runAsync('update goals set account_id = $to where account_id = $from', both);
  await db.runAsync('update import_app_settings set account_id = $to where account_id = $from', both);
  await db.runAsync('update import_queue set account_id = $to where account_id = $from', both);
  await db.runAsync(
    `update accounts set
       opening_balance = opening_balance + (select opening_balance from accounts where id = $from),
       opening_date = min(opening_date, (select opening_date from accounts where id = $from))
     where id = $to`,
    both,
  );
}

// The account row itself, once nothing that must be kept points at it.
export async function deleteAccountRow(db: Db, id: number): Promise<void> {
  const at = { $id: id };
  await db.runAsync('update import_app_settings set enabled = 0, account_id = null where account_id = $id', at);
  await db.runAsync('delete from import_queue where account_id = $id', at);
  await db.runAsync('delete from card_links where account_id = $id', at);
  await db.runAsync('delete from account_currencies where account_id = $id', at);
  await db.runAsync('delete from accounts where id = $id', at);
}
