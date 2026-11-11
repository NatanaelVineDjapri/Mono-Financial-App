// The date sheet's month grid, as plain data: no UI, no clock. A month is 'YYYY-MM'; a day is
// 'YYYY-MM-DD'. Weeks start on Monday (the Indonesian calendar); a cell outside the month is null.

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based, day 0 of the next month
}

// Weeks of the month, each seven cells, Monday first.
export function monthGrid(period: string): (string | null)[][] {
  const [year, month] = period.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const offset = (firstWeekday + 6) % 7; // 0 = Monday
  const total = daysInMonth(year, month);
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= total; day++) {
    cells.push(`${period}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(period: string, delta: number): string {
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' -> 'YYYY-MM'
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

// The day before a 'YYYY-MM-DD' (Yesterday's chip), across month and year ends.
export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
}
