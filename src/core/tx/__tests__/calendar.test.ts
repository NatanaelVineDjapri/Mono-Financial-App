import { dayBefore, monthGrid, monthOf, shiftMonth } from '../calendar';

describe('monthGrid', () => {
  test('October 2026 starts on a Thursday: Monday-first weeks, null padding around the month', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[weeks.length - 1]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  test('a month that starts on Monday has no leading padding; February in a leap year has 29 days', () => {
    expect(monthGrid('2026-06')[0][0]).toBe('2026-06-01');
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2026-02').flat().filter(Boolean)).toHaveLength(28);
  });

  test('a month that starts on Sunday leaves six empty cells before it', () => {
    expect(monthGrid('2026-02')[0]).toEqual([null, null, null, null, null, null, '2026-02-01']);
  });
});

test('shiftMonth crosses year ends both ways', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-10', -13)).toBe('2025-09');
  expect(shiftMonth('2026-10', 0)).toBe('2026-10');
});

test('monthOf and dayBefore', () => {
  expect(monthOf('2026-10-28')).toBe('2026-10');
  expect(dayBefore('2026-10-28')).toBe('2026-10-27');
  expect(dayBefore('2026-03-01')).toBe('2026-02-28');
  expect(dayBefore('2026-01-01')).toBe('2025-12-31');
});
