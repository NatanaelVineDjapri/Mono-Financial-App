import { createAccount, createValasAccount } from '../accounts';
import { listCategories } from '../../data/repo/categories';
import { insertFxRate } from '../../data/repo/fx';
import { getTransaction } from '../../data/repo/transactions';
import { openTestDb } from '../../data/db/openTestDb';
import { DomainError } from '../errors';
import { addExpense, addIncome, addTransfer, deleteTransaction, updateTransaction } from '../transactions';

const NOW = '2026-07-01T00:00:00+07:00'; // after every occurredOn date used below

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
  const valas = await createValasAccount(
    db,
    { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'USD', openingBalance: 25000 }, { currency: 'SGD', openingBalance: 20000 }] },
    NOW,
  );
  const expenseCategory = (await listCategories(db, { kind: 'expense' }))[0].id;
  const incomeCategory = (await listCategories(db, { kind: 'income' }))[0].id;
  return { db, bca, cash, valas, expenseCategory, incomeCategory };
}

describe('domain transactions: IDR', () => {
  test('addIncome: amount_idr = amount, balanceAfter is correct', async () => {
    const { db, bca, incomeCategory } = await fixture();
    const result = await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: incomeCategory, amount: 7500000, occurredOn: '2026-06-25' }, NOW);
    expect(result).toEqual({ id: expect.any(Number), amountIdr: 7500000, balanceAfter: 8500000 });
    expect((await getTransaction(db, result.id))?.amount_idr).toBe(7500000);
  });

  test('addExpense: balanceAfter is correct', async () => {
    const { db, bca, expenseCategory } = await fixture();
    const result = await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 300000, occurredOn: '2026-01-05' }, NOW);
    expect(result.balanceAfter).toBe(700000);
  });

  test('addExpense above balance is blocked with the real shortfall, before touching SQL', async () => {
    const { db, cash, expenseCategory } = await fixture();
    await expect(addExpense(db, { accountId: cash, currency: 'IDR', categoryId: expenseCategory, amount: 1500000, occurredOn: '2026-01-05' }, NOW)).rejects.toMatchObject(
      { code: 'insufficient_balance', context: { shortfallFormatted: 'Rp1.050.000' } },
    );
  });

  test('a future date is blocked before SQL', async () => {
    const { db, bca, expenseCategory } = await fixture();
    await expect(addExpense(db, { accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, occurredOn: '2099-01-01' }, NOW)).rejects.toMatchObject({
      code: 'future_date',
    });
  });

  test('a date before the account opened is blocked before SQL', async () => {
    const { db, bca, expenseCategory } = await fixture();
    await expect(addExpense(db, { accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 1000, occurredOn: '2025-01-01' }, NOW)).rejects.toMatchObject({
      code: 'before_opening_date',
    });
  });

  test('a currency the account does not hold is blocked before SQL', async () => {
    const { db, bca, expenseCategory } = await fixture();
    await expect(addExpense(db, { accountId: bca, currency: 'USD', categoryId: expenseCategory, amount: 100, occurredOn: '2026-01-05' }, NOW)).rejects.toMatchObject({
      code: 'currency_not_in_account',
      context: { currency: 'USD' },
    });
  });

  test('update and delete map SQL guard failures the same way', async () => {
    const { db, bca, cash, expenseCategory } = await fixture();
    const { id } = await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: expenseCategory, amount: 300000, occurredOn: '2026-01-05' }, NOW);
    await updateTransaction(db, id, { amount: 400000, amountIdr: 400000 }, NOW);
    expect((await getTransaction(db, id))?.amount).toBe(400000);

    await deleteTransaction(db, id);
    expect(await getTransaction(db, id)).toBeNull();

    // deleting the income that funds the balance is still blocked by SQL and mapped
    const { id: incomeId } = await addIncome(db, { accountId: cash, currency: 'IDR', categoryId: (await listCategories(db, { kind: 'income' }))[0].id, amount: 100000, occurredOn: '2026-01-05' }, NOW);
    await addExpense(db, { accountId: cash, currency: 'IDR', categoryId: expenseCategory, amount: 500000, occurredOn: '2026-01-06' }, NOW);
    await expect(deleteTransaction(db, incomeId)).rejects.toThrow(DomainError);
  });
});

describe('domain transactions: Valas', () => {
  test('a Valas expense with no rate yet is blocked before SQL (missing_fx_rate)', async () => {
    const { db, valas, expenseCategory } = await fixture();
    await expect(addExpense(db, { accountId: valas, currency: 'USD', categoryId: expenseCategory, amount: 2000, occurredOn: '2026-01-05' }, NOW)).rejects.toMatchObject({
      code: 'missing_fx_rate',
      context: { currency: 'USD' },
    });
  });

  test('a Valas expense converts amount_idr at the latest rate', async () => {
    const { db, valas, expenseCategory } = await fixture();
    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    // US$20,00 at 16.250 = Rp325.000
    const result = await addExpense(db, { accountId: valas, currency: 'USD', categoryId: expenseCategory, amount: 2000, occurredOn: '2026-01-05' }, NOW);
    expect(result.amountIdr).toBe(325000);
    expect(result.balanceAfter).toBe(23000);
  });

  test('an insufficient Valas balance is reported in the pocket\'s own currency', async () => {
    const { db, valas, expenseCategory } = await fixture();
    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    await expect(addExpense(db, { accountId: valas, currency: 'USD', categoryId: expenseCategory, amount: 30000, occurredOn: '2026-01-05' }, NOW)).rejects.toMatchObject({
      code: 'insufficient_balance',
      context: { shortfallFormatted: 'US$50,00' },
    });
  });

  test('IDR -> USD pocket is an exchange: one row, two amounts, amount_idr is the IDR side', async () => {
    const { db, bca, valas } = await fixture();
    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    // Rp500.000 becomes US$30,00. amount_idr always tracks the IDR side, regardless of
    // the USD amount chosen for this particular exchange.
    const result = await addTransfer(
      db,
      { accountId: bca, currency: 'IDR', toAccountId: valas, toCurrency: 'USD', amount: 500000, amountTo: 3000, occurredOn: '2026-01-05' },
      NOW,
    );
    expect(result).toEqual({ id: expect.any(Number), amountIdr: 500000, sourceBalanceAfter: 500000, destBalanceAfter: 28000 });
  });

  test('a rate is required on the destination side too, even though amount_idr only uses the source', async () => {
    const { db, valas } = await fixture();
    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api'); // SGD rate missing on purpose
    await expect(
      addTransfer(db, { accountId: valas, currency: 'USD', toAccountId: valas, toCurrency: 'SGD', amount: 5000, amountTo: 6500, occurredOn: '2026-01-05' }, NOW),
    ).rejects.toMatchObject({ code: 'missing_fx_rate', context: { currency: 'SGD' } });
  });

  test('USD pocket -> SGD pocket in the same Valas account: a pocket-to-pocket exchange', async () => {
    const { db, valas } = await fixture();
    await insertFxRate(db, 'USD', 162500000, '2026-01-01T00:00:00+07:00', 'api');
    await insertFxRate(db, 'SGD', 125000000, '2026-01-01T00:00:00+07:00', 'api');
    const result = await addTransfer(
      db,
      { accountId: valas, currency: 'USD', toAccountId: valas, toCurrency: 'SGD', amount: 5000, amountTo: 6500, occurredOn: '2026-01-05' },
      NOW,
    );
    expect(result.sourceBalanceAfter).toBe(20000);
    expect(result.destBalanceAfter).toBe(26500);
  });

  test('a plain same-currency transfer needs no toCurrency/amountTo', async () => {
    const { db, bca, cash } = await fixture();
    const result = await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: cash, amount: 200000, occurredOn: '2026-01-05' }, NOW);
    expect(result).toEqual({ id: expect.any(Number), amountIdr: 200000, sourceBalanceAfter: 800000, destBalanceAfter: 650000 });
  });
});
