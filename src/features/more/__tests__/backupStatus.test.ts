import { backupState, daysSince, formatBackupTime, OLD_AFTER_DAYS, zoneOf } from '../backupStatus';

// 28 Oct 2026, 12.41 WIB
const NOW = new Date('2026-10-28T12:41:09+07:00').getTime();
const DAY = 86400000;

describe('formatBackupTime', () => {
  test('"21 Okt 2026, 20.14 WIB": Indonesian month, a dot between hour and minute, the zone', () => {
    expect(formatBackupTime('2026-10-21T20:14:00+07:00')).toBe('21 Okt 2026, 20.14 WIB');
  });

  test('a UTC instant is shown in WIB, and across midnight the date moves', () => {
    expect(formatBackupTime('2026-10-21T13:14:00Z')).toBe('21 Okt 2026, 20.14 WIB');
    expect(formatBackupTime('2026-10-21T18:30:00Z')).toBe('22 Okt 2026, 01.30 WIB');
  });

  test('Indonesian short month names', () => {
    expect(formatBackupTime('2026-05-03T09:05:00+07:00')).toBe('3 Mei 2026, 09.05 WIB');
    expect(formatBackupTime('2026-08-17T09:05:00+07:00')).toBe('17 Agu 2026, 09.05 WIB');
    expect(formatBackupTime('2026-12-31T23:59:00+07:00')).toBe('31 Des 2026, 23.59 WIB');
  });

  test('the zone of the timezone setting, WIB when it is unknown or missing', () => {
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Asia/Makassar')).toBe('21 Okt 2026, 21.14 WITA');
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Asia/Jayapura')).toBe('21 Okt 2026, 22.14 WIT');
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Europe/Paris')).toBe('21 Okt 2026, 20.14 WIB');
    expect(zoneOf(null).label).toBe('WIB');
  });
});

describe('formatBackupTime in English', () => {
  test('English month names and a colon in the time, the same 24 hour clock and zone', () => {
    expect(formatBackupTime('2026-10-21T20:14:00+07:00', null, 'en')).toBe('21 Oct 2026, 20:14 WIB');
    expect(formatBackupTime('2026-05-03T09:05:00+07:00', null, 'en')).toBe('3 May 2026, 09:05 WIB');
    expect(formatBackupTime('2026-08-17T09:05:00+07:00', 'Asia/Makassar', 'en')).toBe('17 Aug 2026, 10:05 WITA');
    expect(formatBackupTime('2026-12-31T23:59:00+07:00', null, 'en')).toBe('31 Dec 2026, 23:59 WIB');
  });

  test('the state carries the language it was asked in', () => {
    expect(backupState('2026-10-21T20:14:00+07:00', NOW, null, 'en')).toEqual({ kind: 'recent', whenText: '21 Oct 2026, 20:14 WIB' });
  });
});

describe('daysSince counts calendar days in the zone', () => {
  test('same day is 0, yesterday is 1', () => {
    expect(daysSince('2026-10-28T00:01:00+07:00', NOW)).toBe(0);
    expect(daysSince('2026-10-27T23:50:00+07:00', NOW)).toBe(1);
  });

  test('a backup at 23.50 and a look at 00.10 the next morning is one day', () => {
    const lookedAt = new Date('2026-10-29T00:10:00+07:00').getTime();
    expect(daysSince('2026-10-28T23:50:00+07:00', lookedAt)).toBe(1);
  });
});

describe('backupState', () => {
  test('never backed up: "none"', () => {
    expect(backupState(null, NOW)).toEqual({ kind: 'none' });
    expect(backupState('not a date', NOW)).toEqual({ kind: 'none' });
  });

  test('recent: the date and time of the last backup', () => {
    expect(backupState('2026-10-21T20:14:00+07:00', NOW)).toEqual({ kind: 'recent', whenText: '21 Okt 2026, 20.14 WIB' });
    expect(backupState('2026-10-28T08:00:00+07:00', NOW)).toMatchObject({ kind: 'recent' });
  });

  test(`exactly ${OLD_AFTER_DAYS} days is still recent; ${OLD_AFTER_DAYS + 1} is old`, () => {
    const thirty = new Date(NOW - 30 * DAY).toISOString();
    const thirtyOne = new Date(NOW - 31 * DAY).toISOString();
    expect(backupState(thirty, NOW).kind).toBe('recent');
    expect(backupState(thirtyOne, NOW)).toEqual({ kind: 'old', days: 31 });
  });

  test('old: the number of days', () => {
    expect(backupState('2026-09-13T10:00:00+07:00', NOW)).toEqual({ kind: 'old', days: 45 });
  });

  test('a backup dated in the future (a clock set back) is not called old', () => {
    expect(backupState('2026-11-02T10:00:00+07:00', NOW).kind).toBe('recent');
  });
});
