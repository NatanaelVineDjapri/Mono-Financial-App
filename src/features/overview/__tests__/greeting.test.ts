import { CHECKIN_FROM_OPEN, countOpen, greetingKind, hourWib, kindForHour } from '../greeting';

describe('kindForHour: the time of day in WIB', () => {
  test.each([
    [5, 'morning'],
    [9, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [14, 'afternoon'],
    [15, 'late_afternoon'],
    [17, 'late_afternoon'],
    [18, 'evening'],
    [23, 'evening'],
    [0, 'evening'],
    [4, 'evening'],
  ])('%i o\'clock is %s', (hour, kind) => {
    expect(kindForHour(hour)).toBe(kind);
  });

  test('every hour of the day has a greeting', () => {
    for (let h = 0; h < 24; h++) expect(['morning', 'afternoon', 'late_afternoon', 'evening']).toContain(kindForHour(h));
  });
});

describe('hourWib', () => {
  test('reads the hour in WIB whatever the device zone', () => {
    expect(hourWib(new Date('2026-10-28T08:41:09+07:00').getTime())).toBe(8);
    expect(hourWib(new Date('2026-10-28T01:30:00Z').getTime())).toBe(8);
    expect(hourWib(new Date('2026-10-28T17:30:00Z').getTime())).toBe(0); // 00.30 the next day in WIB
  });
});

describe('greetingKind: the check-in after several opens', () => {
  test('the first and second open of a day greet by the time', () => {
    expect(greetingKind(8, 1)).toBe('morning');
    expect(greetingKind(8, 2)).toBe('morning');
    expect(greetingKind(20, 1)).toBe('evening');
  });

  test(`from the ${CHECKIN_FROM_OPEN}rd open on, it asks "how are you" at any hour`, () => {
    for (const hour of [3, 8, 13, 16, 21]) {
      expect(greetingKind(hour, CHECKIN_FROM_OPEN)).toBe('checkin');
      expect(greetingKind(hour, CHECKIN_FROM_OPEN + 5)).toBe('checkin');
    }
  });
});

describe('countOpen', () => {
  test('the same day counts up; a new day starts again at 1', () => {
    expect(countOpen({ day: null, count: 0 }, '2026-10-28')).toEqual({ day: '2026-10-28', count: 1 });
    expect(countOpen({ day: '2026-10-28', count: 1 }, '2026-10-28')).toEqual({ day: '2026-10-28', count: 2 });
    expect(countOpen({ day: '2026-10-28', count: 5 }, '2026-10-29')).toEqual({ day: '2026-10-29', count: 1 });
  });
});
