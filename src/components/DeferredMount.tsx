// Mounts its children one render later, as a separate low-priority render. Wrap the part of a long screen that is below the
// fold: the top of the screen is drawn and shown first, and the heavy cards further down (charts, long lists) follow a moment
// later instead of all being built in the same pass, which keeps the JS thread busy and the first frame empty.
// Only this component renders twice; the screen around it renders once.
//
// `placeholderHeight` keeps the room the children will take (roughly) until they are there, so a fast scroll right after opening
// does not reach an abrupt end of the page and show nothing: the page already has its length.
import { useDeferredValue, type ReactNode } from 'react';
import { View } from 'react-native';

export function DeferredMount({ children, placeholderHeight = 0 }: { children: ReactNode; placeholderHeight?: number }) {
  const ready = useDeferredValue(true, false);
  if (ready) return <>{children}</>;
  return placeholderHeight > 0 ? <View style={{ height: placeholderHeight }} testID="deferred-placeholder" /> : null;
}
