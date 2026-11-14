import { shouldLock } from '../lockState';

describe('shouldLock', () => {
  const now = 100000;

  test('toggle mati: never locks even on cold start or after grace period', () => {
    expect(shouldLock({ appLockOn: false, isColdStart: true, backgroundedAt: null, now })).toBe(false);
    expect(shouldLock({ appLockOn: false, isColdStart: false, backgroundedAt: now - 60000, now })).toBe(false);
  });

  test('cold start: locks when appLockOn is true', () => {
    expect(shouldLock({ appLockOn: true, isColdStart: true, backgroundedAt: null, now })).toBe(true);
  });

  test('suspended: never locks even when backgrounded beyond grace period', () => {
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 60000,
        now,
        suspended: true,
      }),
    ).toBe(false);
  });

  test('backgroundedAt: 29 seconds vs 30 seconds with default graceMs (30000)', () => {
    // 29 seconds in background -> do not lock
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 29000,
        now,
      }),
    ).toBe(false);

    // exactly 30 seconds in background -> lock
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 30000,
        now,
      }),
    ).toBe(true);

    // 31 seconds in background -> lock
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 31000,
        now,
      }),
    ).toBe(true);
  });

  test('backgroundedAt null: does not lock when not cold start', () => {
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: null,
        now,
      }),
    ).toBe(false);
  });

  test('custom graceMs is respected', () => {
    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 15000,
        now,
        graceMs: 10000,
      }),
    ).toBe(true);

    expect(
      shouldLock({
        appLockOn: true,
        isColdStart: false,
        backgroundedAt: now - 5000,
        now,
        graceMs: 10000,
      }),
    ).toBe(false);
  });
});
