import { createAccount } from '../accounts';
import { openTestDb } from '../../db/openTestDb';
import { createGoal, deleteGoal, listGoalProgress, updateGoal } from '../goals';

const NOW = '2026-01-01T00:00:00+07:00';

describe('goals repo', () => {
  test('total_assets goal reads net worth as current_amount', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1000000, openingDate: '2026-01-01' }, NOW);
    const id = await createGoal(db, { name: 'Total assets', mode: 'total_assets', targetAmount: 2000000 }, NOW);

    const [goal] = await listGoalProgress(db);
    expect(goal).toMatchObject({ id, current_amount: 1000000, remaining: 1000000, progress_bp: 5000 });
  });

  test('account goal reads that account balance', async () => {
    const db = openTestDb();
    const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 500000, openingDate: '2026-01-01' }, NOW);
    await createGoal(db, { name: 'Emergency fund', mode: 'account', accountId, targetAmount: 1000000 }, NOW);

    const [goal] = await listGoalProgress(db);
    expect(goal.current_amount).toBe(500000);
  });

  test('update and delete', async () => {
    const db = openTestDb();
    const id = await createGoal(db, { name: 'Travel', mode: 'total_assets', targetAmount: 1000000 }, NOW);
    await updateGoal(db, id, { targetAmount: 2000000 });
    expect((await listGoalProgress(db))[0].target_amount).toBe(2000000);

    await deleteGoal(db, id);
    expect(await listGoalProgress(db)).toEqual([]);
  });
});
