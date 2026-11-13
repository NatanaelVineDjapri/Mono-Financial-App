import { isInCooldown, isLockedOut, minutesSince, shouldAutoUpdate } from '../throttle';

describe('isLockedOut (20 minutes after a 429)', () => {
  test('never rate-limited: not locked out', () => {
    expect(isLockedOut(null)).toBe(false);
  });

  test('19 minutes since the last 429: still locked out', () => {
    const now = new Date('2026-11-04T12:19:00+07:00');
    expect(isLockedOut('2026-11-04T12:00:00+07:00', now)).toBe(true);
  });

  test('20 minutes since the last 429: no longer locked out', () => {
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

describe('shouldAutoUpdate (24h since the last success, only when enabled)', () => {
  test('disabled: never, even with no prior success', () => {
    expect(shouldAutoUpdate(null, false)).toBe(false);
  });

  test('enabled, never updated before: due immediately', () => {
    expect(shouldAutoUpdate(null, true)).toBe(true);
  });

  test('enabled, 23h59m since the last success: not due yet', () => {
    const now = new Date('2026-11-05T11:59:00+07:00');
    expect(shouldAutoUpdate('2026-11-04T12:00:00+07:00', true, now)).toBe(false);
  });

  test('enabled, exactly 24h since the last success: due', () => {
    const now = new Date('2026-11-05T12:00:00+07:00');
    expect(shouldAutoUpdate('2026-11-04T12:00:00+07:00', true, now)).toBe(true);
  });

  test('due by time, but disabled: still false', () => {
    const now = new Date('2026-11-06T12:00:00+07:00');
    expect(shouldAutoUpdate('2026-11-04T12:00:00+07:00', false, now)).toBe(false);
  });
});

describe('shouldAutoUpdate with a pocket that has no rate yet', () => {
  const last = '2026-11-04T12:00:00+07:00';
  const next = '2026-11-05T07:00:00+07:00';

  test('asks immediately, even before the service next-update time', () => {
    expect(shouldAutoUpdate(last, true, new Date('2026-11-04T12:05:00+07:00'), next, true)).toBe(true);
  });

  test('still respects the switch being off', () => {
    expect(shouldAutoUpdate(last, false, new Date('2026-11-04T12:05:00+07:00'), next, true)).toBe(false);
  });

  test('once every pocket is rated, the usual day and next-update rules apply again', () => {
    expect(shouldAutoUpdate(last, true, new Date('2026-11-04T12:05:00+07:00'), next, false)).toBe(false);
  });
});

describe('shouldAutoUpdate with the service next-update time', () => {
  const last = '2026-11-04T12:00:00+07:00';
  test('before the service says rates change: not due, even after a day', () => {
    expect(shouldAutoUpdate(last, true, new Date('2026-11-06T12:00:00+07:00'), '2026-11-06T13:00:00+07:00')).toBe(false);
  });
  test('after it, and a day old: due', () => {
    expect(shouldAutoUpdate(last, true, new Date('2026-11-06T13:00:00+07:00'), '2026-11-06T13:00:00+07:00')).toBe(true);
  });
  test('no next-update time known: only the day counts', () => {
    expect(shouldAutoUpdate(last, true, new Date('2026-11-05T12:00:00+07:00'), null)).toBe(true);
  });
});
