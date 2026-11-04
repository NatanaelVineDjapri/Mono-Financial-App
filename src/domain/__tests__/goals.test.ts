import { createAccount } from '../accounts';
import { openTestDb } from '../../data/db/openTestDb';
import { createGoal, deleteGoal, getGoalProgress, listGoalProgress, updateGoal } from '../goals';

const NOW = '2026-01-01T00:00:00+07:00';

describe('domain goals', () => {
  test('reproduces the sample: Total assets 2960 bp, Emergency fund 4562 bp', async () => {
    const db = openTestDb();
    const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
    await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-01-01' }, NOW);

    await createGoal(db, { name: 'Total assets', mode: 'total_assets', targetAmount: 30000000, targetDate: '2027-06-30' }, NOW);
    await createGoal(db, { name: 'Emergency fund', mode: 'account', accountId: bca, targetAmount: 15000000, targetDate: '2027-12-31' }, NOW);

    const progress = await listGoalProgress(db);
    expect(progress.find(g => g.name === 'Total assets')?.progress_bp).toBe(2960);
    expect(progress.find(g => g.name === 'Emergency fund')?.progress_bp).toBe(4562);
  });

  test('update and delete', async () => {
    const db = openTestDb();
    const id = await createGoal(db, { name: 'Travel', mode: 'total_assets', targetAmount: 1000000 }, NOW);
    await updateGoal(db, id, { targetAmount: 2000000 });
    expect((await getGoalProgress(db, id))?.target_amount).toBe(2000000);

    await deleteGoal(db, id);
    expect(await getGoalProgress(db, id)).toBeNull();
  });
});
