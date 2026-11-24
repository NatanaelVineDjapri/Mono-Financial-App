// The start-up gate: closed until the first screen has settled, opened once by whoever gets there first, and the deferred work
// starts only after it.
import { APP_READY_TIMEOUT_MS, markAppReady, resetAppReady, runAfterReady, startReadyTimeout, useAppReady } from '../appReady';

beforeEach(() => {
  jest.useFakeTimers();
  resetAppReady();
});
afterEach(() => jest.useRealTimers());

describe('the ready gate', () => {
  test('is closed at the start and opens on markAppReady', () => {
    expect(useAppReady.getState().ready).toBe(false);
    markAppReady();
    expect(useAppReady.getState().ready).toBe(true);
  });

  test('opens once: a second call changes nothing and tells nobody again', () => {
    const listener = jest.fn();
    const unsubscribe = useAppReady.subscribe(listener);
    markAppReady();
    markAppReady();
    markAppReady();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('the timeout opens it when nothing else did, after the hard maximum and not before', () => {
    startReadyTimeout();
    jest.advanceTimersByTime(APP_READY_TIMEOUT_MS - 1);
    expect(useAppReady.getState().ready).toBe(false);
    jest.advanceTimersByTime(1);
    expect(useAppReady.getState().ready).toBe(true);
  });

  test('a cancelled timeout does not open it', () => {
    const cancel = startReadyTimeout();
    cancel();
    jest.advanceTimersByTime(APP_READY_TIMEOUT_MS * 2);
    expect(useAppReady.getState().ready).toBe(false);
  });

  test('opening by hand first and then the timeout firing is harmless', () => {
    startReadyTimeout();
    markAppReady();
    jest.advanceTimersByTime(APP_READY_TIMEOUT_MS);
    expect(useAppReady.getState().ready).toBe(true);
  });

  test('resetAppReady closes it again (a fresh start)', () => {
    markAppReady();
    resetAppReady();
    expect(useAppReady.getState().ready).toBe(false);
  });
});

describe('runAfterReady', () => {
  test('waits for the gate, then for its own delay', () => {
    const task = jest.fn();
    runAfterReady(task, 500);
    jest.advanceTimersByTime(10_000);
    expect(task).not.toHaveBeenCalled(); // the gate is still closed
    markAppReady();
    jest.advanceTimersByTime(499);
    expect(task).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('with the gate already open it runs after the delay alone', () => {
    markAppReady();
    const task = jest.fn();
    runAfterReady(task, 300);
    jest.advanceTimersByTime(300);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('runs once, however often the gate is marked', () => {
    const task = jest.fn();
    runAfterReady(task, 100);
    markAppReady();
    markAppReady();
    jest.advanceTimersByTime(5_000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('cancelled before the gate opens, or before its delay is up, it never runs', () => {
    const early = jest.fn();
    const cancelEarly = runAfterReady(early, 100);
    cancelEarly();
    markAppReady();
    jest.advanceTimersByTime(1_000);
    expect(early).not.toHaveBeenCalled();

    resetAppReady();
    const late = jest.fn();
    const cancelLate = runAfterReady(late, 500);
    markAppReady();
    jest.advanceTimersByTime(200);
    cancelLate();
    jest.advanceTimersByTime(1_000);
    expect(late).not.toHaveBeenCalled();
  });
});
