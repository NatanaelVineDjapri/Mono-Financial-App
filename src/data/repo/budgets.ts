import type { Db } from '../db/types';
import { listTransactionsForFilter, type TxListRow } from './transactions';

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

// ---------------------------------------------------------------- Budgets screens (Fase 4.4)
// Every figure below is read from the views (v_month_budget, v_budget_status,
// v_category_spend, v_period_flow, v_tx). Nothing here is written back. over_by and the
// month's used_bp are computed in the SELECT itself, in integers, with the same
// half-away-from-zero rounding v_budget_status uses (spent is never negative, so
// (x * 20000 + d) / (2 * d) rounds half away from zero).

// One category budget for a month, as the Budgets list shows it.
export interface BudgetCategoryRow {
  budget_id: number;
  category_id: number;
  category: string;
  icon: string | null;
  limit_amount: number;
  spent: number;
  remaining: number; // negative when over
  over_by: number; // 0 unless over
  used_bp: number;
  is_over: number;
  repeat: number;
}

// The month's limit card. Only exists when the month has a monthly_limits row.
export interface BudgetMonthRow {
  month: string;
  monthly_limit: number;
  limit_repeat: number;
  allocated: number;
  total_spent: number;
  remaining: number; // monthly_limit - total_spent, negative when over
  over_by: number;
  used_bp: number;
}

export interface BudgetOverviewData {
  month: string;
  limit: BudgetMonthRow | null;
  totalSpent: number; // every expense in the period, also when there is no limit
  categories: BudgetCategoryRow[]; // most used first
}

const BUDGET_CATEGORY_SELECT = `
  select b.id as budget_id, s.category_id, s.category, c.icon, s.limit_amount, s.spent, s.remaining,
         max(-s.remaining, 0) as over_by, s.used_bp, s.is_over, b.repeat
  from v_budget_status s
  join budgets b on b.month = s.month and b.category_id = s.category_id
  join categories c on c.id = s.category_id
`;

async function getBudgetMonthRow(db: Db, month: string): Promise<BudgetMonthRow | null> {
  return db.getFirstAsync<BudgetMonthRow>(
    `select mb.month, mb.monthly_limit, ml.repeat as limit_repeat, mb.allocated, mb.total_spent, mb.remaining,
            max(-mb.remaining, 0) as over_by,
            (mb.total_spent * 20000 + mb.monthly_limit) / (2 * mb.monthly_limit) as used_bp
     from v_month_budget mb
     join monthly_limits ml on ml.month = mb.month
     where mb.month = $month`,
    { $month: month },
  );
}

export async function getPeriodExpense(db: Db, month: string): Promise<number> {
  const row = await db.getFirstAsync<{ expense: number }>('select expense from v_period_flow where period = $month', { $month: month });
  return row?.expense ?? 0;
}

export async function getBudgetOverview(db: Db, month: string): Promise<BudgetOverviewData> {
  const [limit, totalSpent, categories] = await Promise.all([
    getBudgetMonthRow(db, month),
    getPeriodExpense(db, month),
    db.getAllAsync<BudgetCategoryRow>(`${BUDGET_CATEGORY_SELECT} where s.month = $month order by s.used_bp desc, c.sort_order, c.id`, {
      $month: month,
    }),
  ]);
  return { month, limit, totalSpent, categories };
}

// The earliest month that has anything to show (a transaction or a monthly limit), so
// the month picker knows where "previous" stops. Null on an empty database.
export async function getEarliestBudgetMonth(db: Db): Promise<string | null> {
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    `select min(m) as earliest from (
       select min(period) as m from v_tx
       union all
       select min(month) from monthly_limits
     )`,
  );
  return row?.earliest ?? null;
}

export interface CategoryBudgetDetailData {
  month: string;
  category: { id: number; name: string; kind: 'income' | 'expense'; icon: string | null } | null;
  budget: BudgetCategoryRow | null; // null when the category has no budget that month
  spent: number; // v_category_spend, also without a budget
  monthlyLimit: number | null;
  allocated: number;
  transactions: TxListRow[]; // the category's expenses in the period, newest first
}

export async function getCategoryBudgetDetail(db: Db, categoryId: number, month: string): Promise<CategoryBudgetDetailData> {
  const [category, budget, spendRow, monthRow, transactions] = await Promise.all([
    db.getFirstAsync<CategoryBudgetDetailData['category']>('select id, name, kind, icon from categories where id = $id', { $id: categoryId }),
    db.getFirstAsync<BudgetCategoryRow>(`${BUDGET_CATEGORY_SELECT} where s.month = $month and s.category_id = $categoryId`, {
      $month: month,
      $categoryId: categoryId,
    }),
    db.getFirstAsync<{ spent: number }>('select spent from v_category_spend where period = $month and category_id = $categoryId', {
      $month: month,
      $categoryId: categoryId,
    }),
    db.getFirstAsync<{ monthly_limit: number; allocated: number }>('select monthly_limit, allocated from v_month_budget where month = $month', {
      $month: month,
    }),
    listTransactionsForFilter(db, { period: month, kind: 'expense', categoryIds: [categoryId] }),
  ]);
  return {
    month,
    category,
    budget,
    spent: spendRow?.spent ?? 0,
    monthlyLimit: monthRow?.monthly_limit ?? null,
    allocated: monthRow?.allocated ?? 0,
    transactions,
  };
}

// Create/edit budget form.
export interface BudgetWithCategoryRow {
  id: number;
  category_id: number;
  category: string;
  limit_amount: number;
  repeat: number;
}

export async function listBudgetsWithCategory(db: Db, month: string): Promise<BudgetWithCategoryRow[]> {
  return db.getAllAsync<BudgetWithCategoryRow>(
    `select b.id, b.category_id, c.name as category, b.limit_amount, b.repeat
     from budgets b join categories c on c.id = b.category_id
     where b.month = $month
     order by c.sort_order, c.id`,
    { $month: month },
  );
}

// Expense categories that can still get a budget this month (Budget-Create step 1).
export async function listCategoriesWithoutBudget(db: Db, month: string): Promise<{ id: number; name: string }[]> {
  return db.getAllAsync<{ id: number; name: string }>(
    `select id, name from categories
     where kind = 'expense' and archived = 0
       and id not in (select category_id from budgets where month = $month)
     order by sort_order, id`,
    { $month: month },
  );
}
