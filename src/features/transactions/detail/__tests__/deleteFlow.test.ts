import { QueryClient } from '@tanstack/react-query';

import { useToastStore } from '@/components/toast-store';
import { openTestDb } from '@/data/db/openTestDb';
import { listCategories } from '@/data/repo/categories';
import { getPocketBalanceNow } from '@/data/repo/transactionDetail';
import { createAccount } from '@/domain/accounts';
import { getTransactionDetail } from '@/domain/transactionDetail';
import { addExpense, addIncome, addTransfer } from '@/domain/transactions';

import { deleteTransactionWithUndo } from '../deleteFlow';

const NOW = '2026-07-01T10:30:00+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;
  const income = (await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-06-01' }, NOW)).id;
  const lunch = (await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Food & drink'), amount: 125000, occurredOn: '2026-06-28', description: 'Lunch with team' }, NOW)).id;
  const transfer = (await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: gopay, amount: 250000, occurredOn: '2026-06-26' }, NOW)).id;
  return { db, bca, gopay, income, lunch, transfer, queryClient: new QueryClient() };
}

beforeEach(() => useToastStore.getState().dismiss());

describe('deleteTransactionWithUndo', () => {
  test('deletes, leaves the screen first, then shows "Transaction deleted" with Undo', async () => {
    const { db, bca, lunch, queryClient } = await fixture();
    const order: string[] = [];
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => {
      order.push('invalidate');
    });

    const result = await deleteTransactionWithUndo(db, queryClient, lunch, () => order.push('left'));

    expect(result).toEqual({ ok: true });
    expect(order).toEqual(['left', 'invalidate']); // back first, refetch after, so no "not found" flash
    expect(invalidate).toHaveBeenCalled();
    expect(await getTransactionDetail(db, lunch)).toBeNull();
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(8250000); // 1.000.000 + 7.500.000 - 250.000 transfer, the lunch is gone
    expect(useToastStore.getState()).toMatchObject({ visible: true, message: 'Transaction deleted', actionLabel: 'Undo' });
  });

  test('Undo brings the same record back (same id) and every number returns', async () => {
    const { db, bca, lunch, queryClient } = await fixture();
    const before = await getTransactionDetail(db, lunch);
    const balanceBefore = await getPocketBalanceNow(db, bca, 'IDR');
    jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await deleteTransactionWithUndo(db, queryClient, lunch, () => {});
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe((balanceBefore ?? 0) + 125000);

    useToastStore.getState().onAction?.();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(balanceBefore);
    expect(await getTransactionDetail(db, lunch)).toEqual(before);
  });

  test('a transfer: both balances follow the delete and the undo', async () => {
    const { db, bca, gopay, transfer, queryClient } = await fixture();
    jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const bcaBefore = await getPocketBalanceNow(db, bca, 'IDR');
    const gopayBefore = await getPocketBalanceNow(db, gopay, 'IDR');

    await deleteTransactionWithUndo(db, queryClient, transfer, () => {});
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe((bcaBefore ?? 0) + 250000);
    expect(await getPocketBalanceNow(db, gopay, 'IDR')).toBe((gopayBefore ?? 0) - 250000);

    useToastStore.getState().onAction?.();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(await getPocketBalanceNow(db, bca, 'IDR')).toBe(bcaBefore);
    expect(await getPocketBalanceNow(db, gopay, 'IDR')).toBe(gopayBefore);
  });

  test('an income that was already spent cannot be deleted: a message, no toast, the screen stays', async () => {
    const { db, income, queryClient } = await fixture();
    // The salary funds the lunch and the transfer, but the opening balance alone covers both,
    // so spend more than that to make the salary load-bearing.
    const categories = await listCategories(db);
    const food = categories.find(c => c.name === 'Food & drink')!.id;
    await addExpense(db, { accountId: 1, currency: 'IDR', categoryId: food, amount: 7000000, occurredOn: '2026-06-29' }, NOW);
    const onDeleted = jest.fn();

    const result = await deleteTransactionWithUndo(db, queryClient, income, onDeleted);

    expect(result).toEqual({ ok: false, message: expect.stringContaining('below zero') });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(useToastStore.getState().visible).toBe(false);
    expect(await getTransactionDetail(db, income)).not.toBeNull();
  });

  test('a record that is already gone is a plain failure', async () => {
    const { db, queryClient } = await fixture();
    const result = await deleteTransactionWithUndo(db, queryClient, 9999, () => {});
    expect(result.ok).toBe(false);
  });
});
