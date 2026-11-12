// The backup strip's state: none, recent (under 7 days) or stale (7 days or more), counted in
// calendar days in the zone; the relative wording; and the one shared threshold.
import { BACKUP_STALE_AFTER_DAYS, isBackupStale } from '@/core/backupPolicy';

import { backupState, daysSince, formatBackupTime, relativeParts, zoneOf } from '../backupStatus';

// 28 Oct 2026, 12.41 WIB
const NOW = new Date('2026-10-28T12:41:09+07:00').getTime();
const DAY = 86400000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe('the shared threshold', () => {
  test('seven days, one constant, and the strip reads it from there', () => {
    expect(BACKUP_STALE_AFTER_DAYS).toBe(7);
    expect(isBackupStale(6)).toBe(false);
    expect(isBackupStale(7)).toBe(true);
    expect(isBackupStale(8)).toBe(true);
  });

  test(`the strip turns stale exactly when the policy says so (day ${BACKUP_STALE_AFTER_DAYS - 1} recent, day ${BACKUP_STALE_AFTER_DAYS} stale)`, () => {
    expect(backupState(daysAgo(BACKUP_STALE_AFTER_DAYS - 1), 0, NOW).kind).toBe('recent');
    expect(backupState(daysAgo(BACKUP_STALE_AFTER_DAYS), 0, NOW).kind).toBe('stale');
  });
});

describe('backupState', () => {
  test('never backed up: "none"', () => {
    expect(backupState(null, 0, NOW)).toEqual({ kind: 'none' });
    expect(backupState('not a date', 0, NOW)).toEqual({ kind: 'none' });
  });

  test('3 days ago: recent, with the days and how many transactions changed since', () => {
    expect(backupState('2026-10-25T20:14:00+07:00', 5, NOW)).toEqual({ kind: 'recent', days: 3, changed: 5 });
  });

  test('9 days ago: stale', () => {
    expect(backupState('2026-10-19T20:14:00+07:00', 0, NOW)).toEqual({ kind: 'stale', days: 9, changed: 0 });
  });

  test('today and yesterday are recent', () => {
    expect(backupState('2026-10-28T08:00:00+07:00', 0, NOW)).toMatchObject({ kind: 'recent', days: 0 });
    expect(backupState('2026-10-27T08:00:00+07:00', 0, NOW)).toMatchObject({ kind: 'recent', days: 1 });
  });

  test('a backup dated in the future (a clock set back) counts as today', () => {
    expect(backupState('2026-11-02T10:00:00+07:00', 0, NOW)).toEqual({ kind: 'recent', days: 0, changed: 0 });
  });

  test('the count of changed transactions is never negative or fractional', () => {
    expect(backupState('2026-10-25T20:14:00+07:00', -3, NOW)).toMatchObject({ changed: 0 });
    expect(backupState('2026-10-25T20:14:00+07:00', 2.9, NOW)).toMatchObject({ changed: 2 });
  });
});

describe('daysSince counts calendar days in the zone', () => {
  test('same day is 0, yesterday is 1', () => {
    expect(daysSince('2026-10-28T00:01:00+07:00', NOW)).toBe(0);
    expect(daysSince('2026-10-27T23:50:00+07:00', NOW)).toBe(1);
  });

  test('a backup at 23.50 and a look at 00.10 the next morning is one day, not twenty minutes', () => {
    const lookedAt = new Date('2026-10-29T00:10:00+07:00').getTime();
    expect(daysSince('2026-10-28T23:50:00+07:00', lookedAt)).toBe(1);
  });

  test('the wording follows the calendar across midnight: "hari ini" at 23.59, "kemarin" a minute later', () => {
    const backup = '2026-10-28T20:00:00+07:00';
    expect(relativeParts(daysSince(backup, new Date('2026-10-28T23:59:00+07:00').getTime())).unit).toBe('today');
    expect(relativeParts(daysSince(backup, new Date('2026-10-29T00:00:00+07:00').getTime())).unit).toBe('yesterday');
  });

  test('the zone of the timezone setting decides where midnight is', () => {
    // 23.30 WIB is already the next day in WIT (UTC+9)
    const backup = '2026-10-28T20:00:00+07:00';
    const looked = new Date('2026-10-28T23:30:00+07:00').getTime();
    expect(daysSince(backup, looked, 'Asia/Jakarta')).toBe(0);
    expect(daysSince(backup, looked, 'Asia/Jayapura')).toBe(1);
  });
});

describe('relativeParts: the unit and the number', () => {
  test.each([
    [0, 'today', 0],
    [1, 'yesterday', 1],
    [2, 'days', 2],
    [3, 'days', 3],
    [9, 'days', 9],
    [13, 'days', 13],
    [14, 'weeks', 2],
    [21, 'weeks', 3],
    [59, 'weeks', 8],
    [60, 'months', 2],
    [180, 'months', 6],
    [364, 'months', 12],
    [365, 'years', 1],
    [800, 'years', 2],
  ])('%s days: %s %s', (days, unit, n) => {
    expect(relativeParts(days)).toEqual({ unit, n });
  });

  test('a negative or fractional day count is cleaned up', () => {
    expect(relativeParts(-4)).toEqual({ unit: 'today', n: 0 });
    expect(relativeParts(3.9)).toEqual({ unit: 'days', n: 3 });
  });
});

describe('formatBackupTime (for the Backup screen\'s list)', () => {
  test('"21 Okt 2026, 20.14 WIB": Indonesian month, a dot between hour and minute, the zone', () => {
    expect(formatBackupTime('2026-10-21T20:14:00+07:00')).toBe('21 Okt 2026, 20.14 WIB');
  });

  test('a UTC instant is shown in WIB, and across midnight the date moves', () => {
    expect(formatBackupTime('2026-10-21T13:14:00Z')).toBe('21 Okt 2026, 20.14 WIB');
    expect(formatBackupTime('2026-10-21T18:30:00Z')).toBe('22 Okt 2026, 01.30 WIB');
  });

  test('the zone of the timezone setting, WIB when it is unknown or missing', () => {
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Asia/Makassar')).toBe('21 Okt 2026, 21.14 WITA');
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Asia/Jayapura')).toBe('21 Okt 2026, 22.14 WIT');
    expect(formatBackupTime('2026-10-21T13:14:00Z', 'Europe/Paris')).toBe('21 Okt 2026, 20.14 WIB');
    expect(zoneOf(null).label).toBe('WIB');
  });

  test('in English: English month names and a colon', () => {
    expect(formatBackupTime('2026-10-21T20:14:00+07:00', null, 'en')).toBe('21 Oct 2026, 20:14 WIB');
    expect(formatBackupTime('2026-05-03T09:05:00+07:00', 'Asia/Makassar', 'en')).toBe('3 May 2026, 10:05 WITA');
  });
});
