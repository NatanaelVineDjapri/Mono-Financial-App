// Mounts its children one render later, as a separate low-priority render. Wrap the part of a long screen that is below the
// fold: the top of the screen is drawn and shown first, and the heavy cards further down (charts, long lists) follow a moment
// later instead of all being built in the same pass, which keeps the JS thread busy and the first frame empty.
// Only this component renders twice; the screen around it renders once.
import { useDeferredValue, type ReactNode } from 'react';

export function DeferredMount({ children }: { children: ReactNode }) {
  const ready = useDeferredValue(true, false);
  return ready ? <>{children}</> : null;
}
