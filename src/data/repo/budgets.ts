import type { Db } from '../db/types';

export interface MonthlyLimitRow {
  month: string;
  amount: number;
  repeat: number;
}

export async function setMonthlyLimit(db: Db, month: string, amount: number, repeat = true): Promise<void> {
  const existing = await db.getFirstAsync<MonthlyLimitRow>('select * from monthly_limits where month = $month', { $month: month });
  if (existing) {
    await db.runAsync('update monthly_limits set amount = $amount, repeat = $repeat where month = $month', {
      $month: month,
      $amount: amount,
      $repeat: repeat ? 1 : 0,
    });
  } else {
    await db.runAsync('insert into monthly_limits (month, amount, repeat) values ($month, $amount, $repeat)', {
      $month: month,
      $amount: amount,
      $repeat: repeat ? 1 : 0,
    });
  }
}

export async function deleteMonthlyLimit(db: Db, month: string): Promise<void> {
  await db.runAsync('delete from monthly_limits where month = $month', { $month: month });
}

export async function getMonthlyLimit(db: Db, month: string): Promise<MonthlyLimitRow | null> {
  return db.getFirstAsync<MonthlyLimitRow>('select * from monthly_limits where month = $month', { $month: month });
}

export interface NewBudget {
  categoryId: number;
  month: string;
  limitAmount: number;
  repeat?: boolean;
}

export interface BudgetRow {
  id: number;
  category_id: number;
  month: string;
  limit_amount: number;
  repeat: number;
}

export async function createBudget(db: Db, input: NewBudget): Promise<number> {
  const result = await db.runAsync('insert into budgets (category_id, month, limit_amount, repeat) values ($categoryId, $month, $limitAmount, $repeat)', {
    $categoryId: input.categoryId,
    $month: input.month,
    $limitAmount: input.limitAmount,
    $repeat: input.repeat === false ? 0 : 1,
  });
  return result.lastInsertRowId;
}

export async function updateBudget(db: Db, id: number, patch: Partial<Pick<NewBudget, 'limitAmount' | 'repeat'>>): Promise<void> {
  const fields: string[] = [];
  const params: Record<string, number> = { $id: id };
  if (patch.limitAmount !== undefined) { fields.push('limit_amount = $limitAmount'); params.$limitAmount = patch.limitAmount; }
  if (patch.repeat !== undefined) { fields.push('repeat = $repeat'); params.$repeat = patch.repeat ? 1 : 0; }
  if (fields.length === 0) return;
  await db.runAsync(`update budgets set ${fields.join(', ')} where id = $id`, params);
}

export async function deleteBudget(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from budgets where id = $id', { $id: id });
}

export async function listBudgets(db: Db, month: string): Promise<BudgetRow[]> {
  return db.getAllAsync<BudgetRow>('select * from budgets where month = $month order by id', { $month: month });
}

export interface BudgetStatusRow {
  month: string;
  category_id: number;
  category: string;
  limit_amount: number;
  spent: number;
  remaining: number;
  used_bp: number;
  is_over: number;
}

export async function listBudgetStatus(db: Db, month: string): Promise<BudgetStatusRow[]> {
  return db.getAllAsync<BudgetStatusRow>('select * from v_budget_status where month = $month order by used_bp desc', { $month: month });
}

export interface MonthBudgetRow {
  month: string;
  monthly_limit: number;
  category_spent: number;
  allocated: number;
  total_spent: number;
  remaining: number;
}

export async function getMonthBudget(db: Db, month: string): Promise<MonthBudgetRow | null> {
  return db.getFirstAsync<MonthBudgetRow>('select * from v_month_budget where month = $month', { $month: month });
}
