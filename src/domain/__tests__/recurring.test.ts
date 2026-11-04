import { createAccount } from '../accounts';
import { listCategories } from '../../data/repo/categories';
import { openTestDb } from '../../data/db/openTestDb';
import { deleteTransaction } from '../transactions';
import { archiveRecurring, confirmRecurring, createRecurring, listRecurringDue, skipRecurring, updateRecurring } from '../recurring';

const NOW = '2026-11-03T10:00:00+07:00';

async function fixture() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
  const recurringId = await createRecurring(db, { name: 'Gym membership', amount: 200000, accountId, categoryId, dayOfMonth: 28, firstDueOn: '2026-10-28' }, NOW);
  return { db, accountId, categoryId, recurringId };
}

describe('domain recurring', () => {
  test('a template due in the past shows up in listRecurringDue', async () => {
    const { db } = await fixture();
    const due = await listRecurringDue(db);
    expect(due).toEqual([{ recurring_id: expect.any(Number), name: 'Gym membership', amount: 200000, amount_varies: 0, account_id: expect.any(Number), category_id: expect.any(Number), due_on: '2026-10-28' }]);
  });

  test('confirming writes one expense (source=recurring) and one recorded event, and removes it from due', async () => {
    const { db, accountId, categoryId, recurringId } = await fixture();
    const result = await confirmRecurring(db, { recurringId, dueOn: '2026-10-28', accountId, categoryId, amount: 200000, description: 'Gym membership' }, NOW);

    expect(result.balanceAfter).toBe(1000000);
    expect(await listRecurringDue(db)).toEqual([]);
  });

  test('deleting the confirmed transaction cascades the event and brings it back to due', async () => {
    const { db, accountId, categoryId, recurringId } = await fixture();
    const { transactionId } = await confirmRecurring(db, { recurringId, dueOn: '2026-10-28', accountId, categoryId, amount: 200000 }, NOW);
    expect(await listRecurringDue(db)).toEqual([]);

    await deleteTransaction(db, transactionId);
    const due = await listRecurringDue(db);
    expect(due).toEqual([expect.objectContaining({ name: 'Gym membership', due_on: '2026-10-28' })]);
  });

  test('skipping records nothing financial and removes it from due without a transaction', async () => {
    const { db, recurringId } = await fixture();
    await skipRecurring(db, recurringId, '2026-10-28', NOW);
    expect(await listRecurringDue(db)).toEqual([]);
  });

  test('update and archive', async () => {
    const { db, recurringId } = await fixture();
    await updateRecurring(db, recurringId, { amount: 250000 });
    await archiveRecurring(db, recurringId);
    expect(await listRecurringDue(db)).toEqual([]);
  });
});
