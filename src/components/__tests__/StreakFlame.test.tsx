import { streakTier } from '@/domain/achievements';

import { flameColor, flameSize } from '../StreakFlame';

test('red at first, a new flame at 10, 30, 60 and 100 days, bigger each time, ending purple', () => {
  expect([0, 1, 9, 10, 29, 30, 59, 60, 99, 100, 400].map(streakTier)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  expect(flameColor(1)).toBe('#EF4444');
  expect(flameColor(100)).toBe('#8B5CF6');
  const sizes = [1, 10, 30, 60, 100].map(days => flameSize(days, 24));
  expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  expect(new Set(sizes).size).toBe(5);
});
