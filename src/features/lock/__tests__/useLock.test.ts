import { useLock, withLockSuspended } from '../useLock';

describe('useLock store & withLockSuspended helper', () => {
  beforeEach(() => {
    useLock.getState().reset();
  });

  test('initial state is checking', () => {
    const s = useLock.getState();
    expect(s.status).toBe('checking');
    expect(s.suspended).toBe(false);
    expect(s.backgroundedAt).toBe(null);
    expect(s.authenticating).toBe(false);
    expect(s.failedReason).toBe(null);
  });

  test('unlock and lock actions', () => {
    useLock.getState().lock('failed');
    expect(useLock.getState().status).toBe('locked');
    expect(useLock.getState().failedReason).toBe('failed');

    useLock.getState().unlock();
    expect(useLock.getState().status).toBe('unlocked');
    expect(useLock.getState().failedReason).toBe(null);
  });

  test('withLockSuspended suspends during execution and restores even on error', async () => {
    let suspendedDuring = false;

    const res = await withLockSuspended(async () => {
      suspendedDuring = useLock.getState().suspended;
      return 'ok';
    });

    expect(suspendedDuring).toBe(true);
    expect(useLock.getState().suspended).toBe(false);
    expect(res).toBe('ok');

    // On error
    await expect(
      withLockSuspended(async () => {
        expect(useLock.getState().suspended).toBe(true);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(useLock.getState().suspended).toBe(false);
  });
});
