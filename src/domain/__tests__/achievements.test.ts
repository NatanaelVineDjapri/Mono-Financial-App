import { openMigratedTestDb } from '../../data/db/openTestDb';
import { achievementsFrom, getAchievements, streakOf, type AchievementFacts } from '../achievements';
import { createAccount } from '../accounts';

describe('streakOf', () => {
  test('days in a row, alive until the end of today', () => {
    expect(streakOf([], '2026-11-28')).toEqual({ current: 0, longest: 0, todayDone: false });
    expect(streakOf(['2026-11-26', '2026-11-27', '2026-11-28'], '2026-11-28')).toEqual({ current: 3, longest: 3, todayDone: true });
    expect(streakOf(['2026-11-26', '2026-11-27'], '2026-11-28')).toEqual({ current: 2, longest: 2, todayDone: false });
    expect(streakOf(['2026-11-25', '2026-11-26'], '2026-11-28')).toEqual({ current: 0, longest: 2, todayDone: false });
  });
  test('the longest run is kept after it breaks, across months; a later day is ignored', () => {
    expect(streakOf(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-28', '2026-12-05'], '2026-11-28')).toEqual({ current: 1, longest: 4, todayDone: true });
  });
});

const facts = (over: Partial<AchievementFacts> = {}): AchievementFacts => ({
  today: '2026-11-28', days: [], records: 0, accounts: 0, backups: 0, budgets: 0, goalsReached: 0, debtsSettled: 0, netWorth: 0,
  netWorthByMonth: [], finished: [], savingsTarget: null, monthsWithinBudgets: 0, monthsWithinLimit: [], ...over,
});
const earned = (f: AchievementFacts) => achievementsFrom(f).filter(a => a.earned).map(a => a.id);

describe('achievementsFrom', () => {
  test('thirty badges, none earned with no data', () => {
    expect(achievementsFrom(facts())).toHaveLength(30);
    expect(earned(facts())).toEqual([]);
  });

  test('streak badges follow the longest run and show how far a locked one is', () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const all = achievementsFrom(facts({ days, records: 10 }));
    expect(all.filter(a => a.earned).map(a => a.id)).toEqual([1, 4, 6]);
    expect(all[6]).toEqual({ id: 7, earned: false, progress: { value: 10, target: 14 } });
  });

  test('money badges', () => {
    const got = earned(
      facts({
        netWorth: 12_000_000,
        netWorthByMonth: [1, 2, 3, 4],
        finished: [{ period: '2026-10', income: 1000, net: 600 }],
        savingsTarget: 500,
        monthsWithinLimit: ['2026-08', '2026-09', '2026-10'],
        monthsWithinBudgets: 1,
        goalsReached: 1,
        debtsSettled: 1,
        accounts: 5,
        backups: 1,
        budgets: 2,
      }),
    );
    expect(got).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 24, 25, 27, 30]);
  });

  test('a full month, a year together, and the master badge after twenty others', () => {
    const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const got = earned(facts({ days: ['2025-11-01', ...october], records: 1000, accounts: 5, backups: 1, budgets: 1, goalsReached: 1, debtsSettled: 1, netWorth: 100_000_000, netWorthByMonth: [1, 2, 3, 4], finished: [{ period: '2026-10', income: 100, net: 60 }], savingsTarget: 10, monthsWithinBudgets: 1 }));
    expect(got).toEqual(expect.arrayContaining([3, 8, 20, 21, 23, 26, 28, 29]));
  });
});

test('reads a real database without writing anything', async () => {
  const db = await openMigratedTestDb();
  await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 500000, openingDate: '2026-01-01' }, '2026-11-28T10:00:00+07:00');
  const result = await getAchievements(db, '2026-11-28');
  expect(result.streak).toEqual({ current: 0, longest: 0, todayDone: false });
  expect(result.achievements).toHaveLength(30);
});
