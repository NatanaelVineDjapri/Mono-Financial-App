import { now, setClockOverride, today } from '../clock';

describe('clock', () => {
  afterEach(() => setClockOverride(null));

  test('now() reflects a dev override', () => {
    setClockOverride('2026-10-28T09:00:00+07:00');
    expect(now().getTime()).toBe(new Date('2026-10-28T09:00:00+07:00').getTime());
  });

  test('today() returns the WIB calendar date', () => {
    setClockOverride('2026-10-28T23:30:00+07:00');
    expect(today()).toBe('2026-10-28');
  });

  test('today() rolls over at WIB midnight, not UTC midnight', () => {
    // 2026-10-27T18:00:00Z is 2026-10-28T01:00:00+07:00 — already the next WIB day.
    setClockOverride('2026-10-27T18:00:00Z');
    expect(today()).toBe('2026-10-28');
  });

  test('passing null clears the override back to the real clock', () => {
    setClockOverride('2026-10-28T09:00:00+07:00');
    setClockOverride(null);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(2000);
  });

  test('setClockOverride is a no-op outside __DEV__', () => {
    const originalDev = __DEV__;
    // @ts-expect-error test-only global toggle
    globalThis.__DEV__ = false;
    setClockOverride('2026-10-28T09:00:00+07:00');
    const result = now().getTime();
    // @ts-expect-error restore
    globalThis.__DEV__ = originalDev;
    expect(Math.abs(result - Date.now())).toBeLessThan(2000);
  });

  test('an override set earlier is ignored once __DEV__ is false', () => {
    setClockOverride('2026-10-28T09:00:00+07:00');
    const originalDev = __DEV__;
    // @ts-expect-error test-only global toggle
    globalThis.__DEV__ = false;
    const result = now().getTime();
    // @ts-expect-error restore
    globalThis.__DEV__ = originalDev;
    expect(Math.abs(result - Date.now())).toBeLessThan(2000);
  });
});
