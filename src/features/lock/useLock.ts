import { create } from 'zustand';

// ponytail: in-memory lock store only; process restart always requires re-authentication by design.

export type LockStatus = 'checking' | 'locked' | 'unlocked';
export type FailedReason = 'failed' | 'lockout' | 'no_hardware' | null;

export interface LockState {
  status: LockStatus;
  backgroundedAt: number | null;
  suspended: boolean;
  authenticating: boolean;
  failedReason: FailedReason;
  pendingTarget: string | null;

  setStatus: (status: LockStatus) => void;
  setBackgroundedAt: (time: number | null) => void;
  setSuspended: (suspended: boolean) => void;
  setAuthenticating: (authenticating: boolean) => void;
  setFailedReason: (reason: FailedReason) => void;
  setPendingTarget: (target: string | null) => void;
  unlock: () => void;
  lock: (reason?: FailedReason) => void;
  reset: () => void;
}

const initialState = {
  status: 'checking' as LockStatus,
  backgroundedAt: null,
  suspended: false,
  authenticating: false,
  failedReason: null,
  pendingTarget: null,
};

export const useLock = create<LockState>(set => ({
  ...initialState,
  setStatus: status => set({ status }),
  setBackgroundedAt: backgroundedAt => set({ backgroundedAt }),
  setSuspended: suspended => set({ suspended }),
  setAuthenticating: authenticating => set({ authenticating }),
  setFailedReason: failedReason => set({ failedReason }),
  setPendingTarget: pendingTarget => set({ pendingTarget }),
  unlock: () => set({ status: 'unlocked', failedReason: null }),
  lock: (reason = null) => set({ status: 'locked', failedReason: reason }),
  reset: () => set(initialState),
}));

export async function withLockSuspended<T>(fn: () => Promise<T> | T): Promise<T> {
  const store = useLock.getState();
  store.setSuspended(true);
  try {
    return await fn();
  } finally {
    store.setSuspended(false);
  }
}
