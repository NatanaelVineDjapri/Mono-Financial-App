import {
    addDays,
    daysBetween,
    formatDateTime,
    formatDayHeader,
    formatDayMonth,
    formatShortDate,
    monthLabel,
    monthName,
    monthShortLabel,
    nextPeriod,
    periodEnd,
    periodOfDate,
    periodStart,
    previousPeriod,
} from '../date';

describe('date (calendar month, monthStartDay = 1)', () => {
  test('periodOfDate is the plain year-month', () => {
    expect(periodOfDate('2026-10-20', 1)).toBe('2026-10');
    expect(periodOfDate('2026-10-01', 1)).toBe('2026-10');
    expect(periodOfDate('2026-10-31', 1)).toBe('2026-10');
  });

  test('periodStart/periodEnd bound the calendar month', () => {
    expect(periodStart('2026-10', 1)).toBe('2026-10-01');
    expect(periodEnd('2026-10', 1)).toBe('2026-10-31');
  });

  test('previousPeriod steps back one month, including across a year boundary', () => {
    expect(previousPeriod('2026-10', 1)).toBe('2026-09');
    expect(previousPeriod('2026-01', 1)).toBe('2025-12');
  });

  test('formatShortDate renders "D Mon YYYY"', () => {
    expect(formatShortDate('2026-10-28')).toBe('28 Oct 2026');
    expect(formatShortDate('2026-01-05')).toBe('5 Jan 2026');
  });

  test('monthLabel always carries the year (design board: "October 2026")', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('2025-09')).toBe('September 2025');
  });

  test('formatDayMonth drops the year (a row inside a month section that already states it)', () => {
    expect(formatDayMonth('2026-10-28')).toBe('28 Oct');
  });

  test('formatDayHeader adds the short weekday (design board: "Wed, 28 Oct")', () => {
    expect(formatDayHeader('2026-10-28')).toBe('Wed, 28 Oct');
    expect(formatDayHeader('2026-10-27')).toBe('Tue, 27 Oct');
    expect(formatDayHeader('2026-10-26')).toBe('Mon, 26 Oct');
  });
});

describe('date (custom monthStartDay)', () => {
  test('a period starting on the 25th shifts the boundary', () => {
    // month_start_day = 25: 2026-10-20 still belongs to the period that started 2026-09-25.
    expect(periodOfDate('2026-10-20', 25)).toBe('2026-09');
    expect(periodOfDate('2026-10-25', 25)).toBe('2026-10');
    expect(periodStart('2026-10', 25)).toBe('2026-10-25');
    expect(periodEnd('2026-10', 25)).toBe('2026-11-24');
    expect(previousPeriod('2026-10', 25)).toBe('2026-09');
  });
});

test('formatDateTime renders the instant in WIB (the sample Valas fx rate: 2026-10-28T09:00:00+07:00)', () => {
  expect(formatDateTime('2026-10-28T09:00:00+07:00')).toBe('28 Oct 2026, 09:00');
  // A UTC instant converts to its own WIB wall time (UTC+7).
  expect(formatDateTime('2026-10-28T02:00:00Z')).toBe('28 Oct 2026, 09:00');
  // Crossing midnight into the next WIB day.
  expect(formatDateTime('2026-10-28T18:30:00Z')).toBe('29 Oct 2026, 01:30');
});

test('nextPeriod steps forward, across a year and with a custom start day', () => {
  expect(nextPeriod('2026-10', 1)).toBe('2026-11');
  expect(nextPeriod('2026-12', 1)).toBe('2027-01');
  expect(nextPeriod('2026-10', 25)).toBe('2026-11');
});

test('daysBetween counts whole days, negative backwards', () => {
  expect(daysBetween('2026-10-28', '2026-10-31')).toBe(3);
  expect(daysBetween('2026-10-31', '2026-10-28')).toBe(-3);
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
});

test('monthName is the month alone', () => {
  expect(monthName('2026-10')).toBe('October');
});

test('monthShortLabel is the chip text "Oct 2026"', () => {
  expect(monthShortLabel('2026-10')).toBe('Oct 2026');
  expect(monthShortLabel('2027-01')).toBe('Jan 2027');
});

test('addDays crosses a month/year boundary correctly', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
});
