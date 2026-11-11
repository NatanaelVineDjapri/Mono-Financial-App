import { openTestDb } from '../../data/db/openTestDb';
import { listCategories } from '../../data/repo/categories';
import { insertFxRate } from '../../data/repo/fx';
import { getPocketBalanceNow } from '../../data/repo/transactionDetail';
import { createAccount, createValasAccount } from '../accounts';
import { createBudget, setMonthlyLimit } from '../budget';
import { DomainError } from '../errors';
import { getDeletePreview, getTransactionDetail, impliedRateE4 } from '../transactionDetail';
import { addExpense, addIncome, addTransfer, deleteTransactionWithSnapshot, restoreTransaction } from '../transactions';

const NOW = '2026-07-01T10:30:00+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 100000, openingDate: '2026-01-01' }, NOW);
  const valas = await createValasAccount(db, { name: 'Valas', openingDate: '2026-01-01', pockets: [{ currency: 'SGD', openingBalance: 20000 }] }, NOW);
  await insertFxRate(db, 'SGD', 125000000, '2026-06-01T09:00:00+07:00', 'api');
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;

  await setMonthlyLimit(db, '2026-06', 5000000);
  await createBudget(db, { categoryId: cat('Food & drink'), month: '2026-06', limitAmount: 1800000 });

  const income = (await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-06-01' }, NOW)).id;
  const bigMeal = (await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Food & drink'), amount: 1300000, occurredOn: '2026-06-10', description: 'Groceries' }, NOW)).id;
  const transfer = (await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: gopay, amount: 250000, occurredOn: '2026-06-26', description: 'Top up GoPay' }, NOW)).id;
  const lunch = (await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Food & drink'), amount: 125000, occurredOn: '2026-06-28', description: 'Lunch with team', note: 'Makan siang' }, NOW)).id;
  const dinner = (await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: cat('Food & drink'), amount: 10000, occurredOn: '2026-06-15', description: 'Dinner, Singapore' }, NOW)).id;
  return { db, bca, gopay, valas, income, bigMeal, transfer, lunch, dinner };
}

describe('getTransactionDetail', () => {
  test('an expense: names, running balance after it, and the budget line it counts toward', async () => {
    const { db, lunch } = await fixture();
    const d = (await getTransactionDetail(db, lunch))!;
    expect(d).toMatchObject({ kind: 'expense', description: 'Lunch with team', note: 'Makan siang', source: 'manual', occurredOn: '2026-06-28', amount: 125000, amountIdr: 125000 });
    expect(d.category?.name).toBe('Food & drink');
    expect(d.account).toMatchObject({ name: 'BCA Tabungan', currency: 'IDR', balanceAfter: 6825000 }); // 1.000.000 + 7.500.000 - 1.300.000 - 250.000 - 125.000
    expect(d.toAccount).toBeNull();
    expect(d.rateE4).toBeNull();
    // Budgets count rupiah values (amount_idr): 1.300.000 + 125.000 + the Singapore dinner's 1.250.000.
    expect(d.budget).toMatchObject({ month: '2026-06', categoryName: 'Food & drink', limit: 1800000, spent: 2675000, isOver: true, overBy: 875000 });
  });

  test('the running balance follows date order, not entry order (a record entered later but dated earlier)', async () => {
    const { db, bigMeal } = await fixture();
    const d = (await getTransactionDetail(db, bigMeal))!;
    expect(d.account.balanceAfter).toBe(7200000); // 1.000.000 + 7.500.000 - 1.300.000
  });

  test('income: no budget card, no rate', async () => {
    const { db, income } = await fixture();
    const d = (await getTransactionDetail(db, income))!;
    expect(d.kind).toBe('income');
    expect(d.budget).toBeNull();
    expect(d.rateE4).toBeNull();
    expect(d.account.balanceAfter).toBe(8500000);
  });

  test('a transfer: both sides with their own balance after, no category, no budget', async () => {
    const { db, transfer } = await fixture();
    const d = (await getTransactionDetail(db, transfer))!;
    expect(d).toMatchObject({ kind: 'transfer', category: null, budget: null, amount: 250000, amountTo: 250000 });
    expect(d.account).toMatchObject({ name: 'BCA Tabungan', balanceAfter: 6950000 }); // 8.500.000 - 1.300.000 - 250.000
    expect(d.toAccount).toMatchObject({ name: 'GoPay', currency: 'IDR', balanceAfter: 350000 });
  });

  test('a Valas expense: pocket currency amount, the rupiah value at the time, and the rate it implies', async () => {
    const { db, dinner } = await fixture();
    const d = (await getTransactionDetail(db, dinner))!;
    expect(d).toMatchObject({ currency: 'SGD', amount: 10000, amountIdr: 1250000, minorFactor: 100 });
    expect(d.account).toMatchObject({ name: 'Valas', type: 'forex', currency: 'SGD', balanceAfter: 10000 }); // S$200 - S$100
    expect(d.rateE4).toBe(125000000); // S$1 = Rp12.500
  });

  test('an unknown id is null', async () => {
    const { db } = await fixture();
    expect(await getTransactionDetail(db, 9999)).toBeNull();
  });
});

test('impliedRateE4 rounds half away from zero', () => {
  expect(impliedRateE4(1250000, 10000, 100)).toBe(125000000);
  expect(impliedRateE4(100, 3, 1)).toBe(333333); // Rp33,3333 per unit, x 10.000
  expect(impliedRateE4(200, 3, 1)).toBe(666667); // Rp66,6667
});

describe('getDeletePreview', () => {
  test('an expense: the balance goes back up by its amount and the budget spending down by its rupiah value', async () => {
    const { db, lunch } = await fixture();
    const detail = (await getTransactionDetail(db, lunch))!;
    expect(await getDeletePreview(db, detail)).toEqual({ accountAfter: 6950000, toAccountAfter: null, budgetSpentAfter: 2550000 });
  });

  test('a transfer: the source goes back up, the destination goes back down', async () => {
    const { db, transfer } = await fixture();
    const detail = (await getTransactionDetail(db, transfer))!;
    expect(await getDeletePreview(db, detail)).toEqual({ accountAfter: 7075000, toAccountAfter: 100000, budgetSpentAfter: null });
  });
});

describe('delete and undo', () => {
  test('delete changes both views; undo puts the same record back (same id) and every number returns', async () => {
    const { db, bca, lunch } = await fixture();
    const before = (await getTransactionDetail(db, lunch))!;
    const balanceBefore = await getPocketBalanceNow(db, bca, 'IDR');

    const snapshot = await deleteTransactionWithSnapshot(db, lunch);
    expect(snapshot?.id).toBe(lunch);
    expect(await getTransactionDetail(db, lunch)).toBeNull();
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(6950000);

    await restoreTransaction(db, snapshot!);
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(balanceBefore);
    expect(await getTransactionDetail(db, lunch)).toEqual(before);
  });

  test('deleting a transfer changes both balances (never net worth); undo restores both', async () => {
    const { db, bca, gopay, transfer } = await fixture();
    const snapshot = await deleteTransactionWithSnapshot(db, transfer);
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(7075000);
    expect(await getPocketBalanceNow(db, gopay, 'IDR')).toBe(100000);
    await restoreTransaction(db, snapshot!);
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(6825000);
    expect(await getPocketBalanceNow(db, gopay, 'IDR')).toBe(350000);
  });

  test('deleting an income that the balance already spent is blocked by the schema, and the record stays', async () => {
    const { db, income } = await fixture();
    await expect(deleteTransactionWithSnapshot(db, income)).rejects.toMatchObject({ code: 'insufficient_balance' });
    await expect(deleteTransactionWithSnapshot(db, income)).rejects.toBeInstanceOf(DomainError);
    expect(await getTransactionDetail(db, income)).not.toBeNull();
  });

  test('deleting something that is not there returns null', async () => {
    const { db } = await fixture();
    expect(await deleteTransactionWithSnapshot(db, 9999)).toBeNull();
  });
});
