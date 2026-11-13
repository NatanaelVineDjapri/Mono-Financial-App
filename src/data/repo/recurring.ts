import type { Db } from '../db/types';

export interface NewRecurring {
  name: string;
  amount: number;
  amountVaries?: boolean;
  accountId: number; // IDR account only (recurring_needs_idr_account)
  categoryId: number;
  dayOfMonth: number; // 1-31, clamped to the month's last day by v_recurring_due
  firstDueOn: string;
  endOn?: string | null;
  remind?: boolean;
}

export interface RecurringRow {
  id: number;
  name: string;
  amount: number;
  amount_varies: number;
  account_id: number;
  category_id: number;
  day_of_month: number;
  first_due_on: string;
  end_on: string | null;
  remind: number;
  archived: number;
  created_at: string;
}

export async function createRecurring(db: Db, input: NewRecurring, now: string): Promise<number> {
  const result = await db.runAsync(
    `insert into recurring
      (name, amount, amount_varies, account_id, category_id, day_of_month, first_due_on, end_on, remind, created_at)
     values
      ($name, $amount, $amountVaries, $accountId, $categoryId, $dayOfMonth, $firstDueOn, $endOn, $remind, $now)`,
    {
      $name: input.name,
      $amount: input.amount,
      $amountVaries: input.amountVaries ? 1 : 0,
      $accountId: input.accountId,
      $categoryId: input.categoryId,
      $dayOfMonth: input.dayOfMonth,
      $firstDueOn: input.firstDueOn,
      $endOn: input.endOn ?? null,
      $remind: input.remind === false ? 0 : 1,
      $now: now,
    },
  );
  return result.lastInsertRowId;
}

export async function updateRecurring(
  db: Db,
  id: number,
  patch: Partial<Pick<NewRecurring, 'name' | 'amount' | 'amountVaries' | 'accountId' | 'categoryId' | 'dayOfMonth' | 'endOn' | 'remind'>>,
): Promise<void> {
  const fields: string[] = [];
  const params: Record<string, string | number | null> = { $id: id };
  const set = (column: string, key: string, value: string | number | boolean | null | undefined, asBool = false) => {
    if (value === undefined) return;
    fields.push(`${column} = $${key}`);
    params[`$${key}`] = asBool ? (value ? 1 : 0) : (value as string | number | null);
  };
  set('name', 'name', patch.name);
  set('amount', 'amount', patch.amount);
  set('amount_varies', 'amountVaries', patch.amountVaries, true);
  set('account_id', 'accountId', patch.accountId);
  set('category_id', 'categoryId', patch.categoryId);
  set('day_of_month', 'dayOfMonth', patch.dayOfMonth);
  set('end_on', 'endOn', patch.endOn);
  set('remind', 'remind', patch.remind, true);
  if (fields.length === 0) return;
  await db.runAsync(`update recurring set ${fields.join(', ')} where id = $id`, params);
}

export async function archiveRecurring(db: Db, id: number): Promise<void> {
  await db.runAsync('update recurring set archived = 1 where id = $id', { $id: id });
}

export interface RecurringDueRow {
  recurring_id: number;
  name: string;
  amount: number;
  amount_varies: number;
  account_id: number;
  category_id: number;
  due_on: string;
  day_of_month: number;   // from recurring.day_of_month — the template's canonical day
  account_name: string;
  category_name: string;
}

export async function listRecurringDue(db: Db): Promise<RecurringDueRow[]> {
  return db.getAllAsync<RecurringDueRow>(
    `select v.*, r.day_of_month, a.name as account_name, c.name as category_name
     from v_recurring_due v
     join recurring r on r.id = v.recurring_id
     join accounts a on a.id = v.account_id
     join categories c on c.id = v.category_id
     order by v.due_on, v.recurring_id`,
  );
}

export async function getRecurring(db: Db, id: number): Promise<RecurringRow | null> {
  return db.getFirstAsync<RecurringRow>('select * from recurring where id = $id', { $id: id });
}

export interface RecurringListRow extends RecurringRow {
  account_name: string;
  account_type: string;
  account_balance: number;
  category_name: string;
}

export async function listRecurring(db: Db): Promise<RecurringListRow[]> {
  return db.getAllAsync<RecurringListRow>(
    `select r.*, a.name as account_name, a.type as account_type, b.balance as account_balance, c.name as category_name
     from recurring r join accounts a on a.id = r.account_id join v_account_balance b on b.id = a.id
     join categories c on c.id = r.category_id where r.archived = 0 order by r.day_of_month, r.id`,
  );
}

export interface RecurringMonthlyEstimate { amount: number; count: number; variesCount: number }

export async function monthlyRecurringEstimate(db: Db, today: string): Promise<RecurringMonthlyEstimate> {
  return (await db.getFirstAsync<RecurringMonthlyEstimate>(
    `select coalesce(sum(amount), 0) as amount, count(*) as count, coalesce(sum(amount_varies), 0) as variesCount
     from recurring where archived = 0 and first_due_on <= date($monthStart, '+1 month', '-1 day') and (end_on is null or end_on >= $monthStart)`,
    { $monthStart: `${today.slice(0, 7)}-01` },
  )) ?? { amount: 0, count: 0, variesCount: 0 };
}

export type RecurringEventStatus = 'recorded' | 'skipped';

export async function recordRecurringEvent(
  db: Db,
  recurringId: number,
  dueOn: string,
  status: RecurringEventStatus,
  transactionId: number | null,
  decidedAt: string,
): Promise<void> {
  await db.runAsync('insert into recurring_events (recurring_id, due_on, status, transaction_id, decided_at) values ($recurringId, $dueOn, $status, $transactionId, $decidedAt)', {
    $recurringId: recurringId,
    $dueOn: dueOn,
    $status: status,
    $transactionId: transactionId,
    $decidedAt: decidedAt,
  });
}
