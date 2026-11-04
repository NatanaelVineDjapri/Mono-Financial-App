import { isInCooldown, isLockedOut, minutesSince } from '../throttle';

describe('isLockedOut (20 minutes after a 429)', () => {
  test('no prior attempt: not locked out', () => {
    expect(isLockedOut(null)).toBe(false);
  });

  test('19 minutes since the last attempt: still locked out', () => {
    const now = new Date('2026-11-04T12:19:00+07:00');
    expect(isLockedOut('2026-11-04T12:00:00+07:00', now)).toBe(true);
  });

  test('20 minutes since the last attempt: no longer locked out', () => {
    const now = new Date('2026-11-04T12:20:00+07:00');
    expect(isLockedOut('2026-11-04T12:00:00+07:00', now)).toBe(false);
  });
});

describe('isInCooldown (1 hour since the last success)', () => {
  test('no prior success: not in cooldown', () => {
    expect(isInCooldown(null)).toBe(false);
  });

  test('59 minutes since the last success: still in cooldown', () => {
    const now = new Date('2026-11-04T12:59:00+07:00');
    expect(isInCooldown('2026-11-04T12:00:00+07:00', now)).toBe(true);
  });

  test('60 minutes since the last success: cooldown over', () => {
    const now = new Date('2026-11-04T13:00:00+07:00');
    expect(isInCooldown('2026-11-04T12:00:00+07:00', now)).toBe(false);
  });
});

describe('minutesSince', () => {
  test('for the "Sudah diperbarui X menit lalu" message', () => {
    const now = new Date('2026-11-04T12:12:30+07:00');
    expect(minutesSince('2026-11-04T12:00:00+07:00', now)).toBe(12);
  });
});
