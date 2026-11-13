import { createAccount, listPockets, addPocket, archivePocket } from '../../data/repo/accounts';
import { listCategories } from '../../data/repo/categories';
import { openTestDb } from '../../data/db/openTestDb';
import { createBudget, deleteMonthlyLimit, setMonthlyLimit } from '../../data/repo/budgets';
import { createRecurring } from '../../data/repo/recurring';
import { insertTransaction } from '../../data/repo/transactions';
import type { Db } from '../../data/db/types';
import { DomainError, GUARD_CODES, UnexpectedDbError, throwDomainError } from '../errors';

const NOW = '2026-01-01T00:00:00+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const valas = await createAccount(db, { name: 'Valas', type: 'forex', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
  await addPocket(db, valas, 'USD', 10000, '2026-01-01');
  const expenseCategory = (await listCategories(db, { kind: 'expense' }))[0].id;
  const incomeCategory = (await listCategories(db, { kind: 'income' }))[0].id;
  return { db, bca, valas, expenseCategory, incomeCategory };
}

function catchCode(db: Db, action: () => Promise<unknown>): Promise<string> {
  return action().then(
    () => {
      throw new Error('expected the action to throw');
    },
    err => {
      try {
        throwDomainError(err);
      } catch (mapped) {
        if (mapped instanceof DomainError) return mapped.code;
        throw mapped;
      }
      throw new Error('unreachable');
    },
  );
}

describe('throwDomainError recognises all 14 guard codes', () => {
  test('future_date', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, amountIdr: 1000, occurredOn: '2099-01-01' }, NOW),
    );
    expect(code).toBe('future_date');
  });

  test('before_opening_date', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, amountIdr: 1000, occurredOn: '2025-01-01' }, NOW),
    );
    expect(code).toBe('before_opening_date');
  });

  test('category_kind_mismatch', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'income', accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, amountIdr: 1000, occurredOn: '2026-01-05' }, NOW),
    );
    expect(code).toBe('category_kind_mismatch');
  });

  test('insufficient_balance', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 9999999, amountIdr: 9999999, occurredOn: '2026-01-05' }, NOW),
    );
    expect(code).toBe('insufficient_balance');
  });

  test('budget_needs_expense_category', async () => {
    const { db, incomeCategory } = await fixture();
    await setMonthlyLimit(db, '2026-01', 1000000);
    const code = await catchCode(db, () => createBudget(db, { categoryId: incomeCategory, month: '2026-01', limitAmount: 1000 }));
    expect(code).toBe('budget_needs_expense_category');
  });

  test('over_monthly_limit', async () => {
    const { db, expenseCategory } = await fixture();
    await setMonthlyLimit(db, '2026-01', 1000);
    const code = await catchCode(db, () => createBudget(db, { categoryId: expenseCategory, month: '2026-01', limitAmount: 1000000 }));
    expect(code).toBe('over_monthly_limit');
  });

  test('budgets_exist_for_month', async () => {
    const { db, expenseCategory } = await fixture();
    await setMonthlyLimit(db, '2026-01', 1000000);
    await createBudget(db, { categoryId: expenseCategory, month: '2026-01', limitAmount: 500000 });
    const code = await catchCode(db, () => deleteMonthlyLimit(db, '2026-01'));
    expect(code).toBe('budgets_exist_for_month');
  });

  test('currency_not_in_account', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'USD', categoryId: expenseCategory, amount: 100, amountIdr: 16250, occurredOn: '2026-01-05' }, NOW),
    );
    expect(code).toBe('currency_not_in_account');
  });

  test('missing_fx_rate', async () => {
    const { db, valas, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      insertTransaction(db, { kind: 'expense', accountId: valas, currency: 'USD', categoryId: expenseCategory, amount: 100, amountIdr: 16250, occurredOn: '2026-01-05' }, NOW),
    );
    expect(code).toBe('missing_fx_rate');
  });

  test('pocket_needs_forex_account', async () => {
    const { db, bca } = await fixture();
    const code = await catchCode(db, () => addPocket(db, bca, 'USD', 0, '2026-01-01'));
    expect(code).toBe('pocket_needs_forex_account');
  });

  test('pocket_not_empty', async () => {
    const { db, valas } = await fixture();
    const code = await catchCode(db, () => archivePocket(db, valas, 'USD'));
    expect(code).toBe('pocket_not_empty');
    expect((await listPockets(db, valas))[0].currency).toBe('USD');
  });

  test('account_type_locked', async () => {
    const { db, bca, expenseCategory } = await fixture();
    await insertTransaction(db, { kind: 'expense', accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, amountIdr: 1000, occurredOn: '2026-01-05' }, NOW);
    const code = await catchCode(db, () => db.runAsync("update accounts set type = 'forex' where id = $id", { $id: bca }));
    expect(code).toBe('account_type_locked');
  });

  test('recurring_needs_idr_account', async () => {
    const { db, valas, expenseCategory } = await fixture();
    const code = await catchCode(db, () =>
      createRecurring(db, { name: 'X', amount: 1000, accountId: valas, categoryId: expenseCategory, dayOfMonth: 1, firstDueOn: '2026-01-01' }, NOW),
    );
    expect(code).toBe('recurring_needs_idr_account');
  });

  test('all 14 codes are known (forex_account_exists needs the migrated schema and is exercised in features/valas)', () => {
    expect(GUARD_CODES.length).toBe(14);
  });
});

describe('throwDomainError on an unrecognised error', () => {
  test('wraps it as UnexpectedDbError instead of dropping it', () => {
    expect(() => throwDomainError(new Error('disk is full, somehow'))).toThrow(UnexpectedDbError);
  });

  test('a non-Error throwable is still wrapped', () => {
    expect(() => throwDomainError('a plain string')).toThrow(UnexpectedDbError);
  });
});
