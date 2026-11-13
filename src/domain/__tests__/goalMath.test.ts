import { clampGoalProgressBp, fullMonthsUntil, goalIsAchieved, neededGoalPace } from '../goalMath';

describe('goal math', () => {
  test('clamps progress to 0..100%', () => {
    expect(clampGoalProgressBp(-1, 100)).toBe(0);
    expect(clampGoalProgressBp(50, 100)).toBe(5000);
    expect(clampGoalProgressBp(100, 100)).toBe(10000);
    expect(clampGoalProgressBp(36743, 100)).toBe(10000);
  });

  test('achieved hides remaining and pace', () => {
    expect(goalIsAchieved(15000000, 15000000)).toBe(true);
    expect(neededGoalPace(0, 14)).toBeNull();
  });

  test('counts full calendar months and rounds pace up', () => {
    expect(fullMonthsUntil('2026-10-28', '2027-12-31')).toBe(14);
    expect(fullMonthsUntil('2026-10-28', '2027-06-30')).toBe(8);
    expect(neededGoalPace(8157500, 14)).toBe(582679);
    expect(neededGoalPace(21120000, 8)).toBe(2640000);
  });

  test('past dates return zero months', () => {
    expect(fullMonthsUntil('2026-10-28', '2026-10-27')).toBe(0);
  });
});
