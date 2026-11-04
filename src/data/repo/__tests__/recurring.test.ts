import { createAccount } from '../accounts';
import { listCategories } from '../categories';
import { openTestDb } from '../../db/openTestDb';
import { insertTransaction } from '../transactions';
import { archiveRecurring, createRecurring, listRecurringDue, recordRecurringEvent, updateRecurring } from '../recurring';

const NOW = '2026-01-01T00:00:00+07:00';

async function setup() {
  const db = openTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
  const categoryId = (await listCategories(db, { kind: 'expense' }))[0].id;
  return { db, accountId, categoryId };
}

describe('recurring repo', () => {
  test('a new recurring template with a past first_due_on shows up in v_recurring_due', async () => {
    const { db, accountId, categoryId } = await setup();
    await createRecurring(db, { name: 'Gym', amount: 200000, accountId, categoryId, dayOfMonth: 15, firstDueOn: '2026-01-15' }, NOW);
    const due = await listRecurringDue(db);
    expect(due.some(d => d.name === 'Gym')).toBe(true);
  });

  test('recording an event removes it from due until the transaction is deleted', async () => {
    const { db, accountId, categoryId } = await setup();
    const recurringId = await createRecurring(db, { name: 'Gym', amount: 200000, accountId, categoryId, dayOfMonth: 15, firstDueOn: '2026-01-15' }, NOW);
    const dueOn = (await listRecurringDue(db)).find(d => d.name === 'Gym')!.due_on;

    const txId = await insertTransaction(db, { kind: 'expense', accountId, currency: 'IDR', categoryId, amount: 200000, amountIdr: 200000, occurredOn: dueOn, source: 'recurring' }, NOW);
    await recordRecurringEvent(db, recurringId, dueOn, 'recorded', txId, NOW);

    expect((await listRecurringDue(db)).some(d => d.name === 'Gym' && d.due_on === dueOn)).toBe(false);
  });

  test('update and archive', async () => {
    const { db, accountId, categoryId } = await setup();
    const id = await createRecurring(db, { name: 'Gym', amount: 200000, accountId, categoryId, dayOfMonth: 15, firstDueOn: '2026-01-15' }, NOW);
    await updateRecurring(db, id, { amount: 250000 });
    await archiveRecurring(db, id);
    expect(await listRecurringDue(db)).toEqual([]);
  });
});
