// "The first screen has settled": the one signal that lifts the brand splash (src/components/SplashBrand) and lets the startup work
// that nobody is waiting for begin (runAfterReady). Until then the person sees the splash, never a half-built screen (the gold
// ribbon and the header over an empty body, then everything popping in).
//
// Released by: the Overview once its first data is in, Welcome once it is drawn, any other first route (a deep link, a tapped
// notification) once it is on screen (src/features/startup/ReadyOnOtherRoute), and a hard timeout, so a slow or failing read
// can never keep the splash up for good. markAppReady() is safe to call any number of times: the gate opens once.
import { create } from 'zustand';

export const APP_READY_TIMEOUT_MS = 2500;

export const useAppReady = create<{ ready: boolean }>(() => ({ ready: false }));

export function markAppReady(): void {
  if (!useAppReady.getState().ready) useAppReady.setState({ ready: true });
}

// For tests only: the gate closed again.
export function resetAppReady(): void {
  useAppReady.setState({ ready: false });
}

// Opens the gate by itself after `ms`. Returns the way to cancel it.
export function startReadyTimeout(ms: number = APP_READY_TIMEOUT_MS): () => void {
  const id = setTimeout(markAppReady, ms);
  return () => clearTimeout(id);
}

// Runs `task` `delayMs` after the gate has opened (at once plus the delay if it is open already), so work that nobody is waiting for
// (pruning the inbox, planning reminders, reading the notification queue, a rate refresh) does not compete with the first screen.
// Runs at most once. Returns the way to cancel it.
export function runAfterReady(task: () => void, delayMs = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;
  const schedule = () => {
    if (cancelled || timer != null) return;
    timer = setTimeout(() => {
      if (!cancelled) task();
    }, delayMs);
  };
  if (useAppReady.getState().ready) {
    schedule();
  } else {
    unsubscribe = useAppReady.subscribe(state => {
      if (state.ready) {
        unsubscribe?.();
        unsubscribe = null;
        schedule();
      }
    });
  }
  return () => {
    cancelled = true;
    unsubscribe?.();
    if (timer != null) clearTimeout(timer);
  };
}
