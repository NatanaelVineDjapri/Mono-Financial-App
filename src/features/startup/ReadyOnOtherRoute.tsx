// Lifts the splash when the first screen is not the Overview or Welcome (a deep link, a tapped notification, a card held to the
// phone): as soon as the navigator is on a route other than the Overview's "/", the screen on it is what the person is looking at,
// with its own loading state. One frame later, so the screen has been laid out before the splash goes. Draws nothing.
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { markAppReady } from '@/core/appReady';

export function ReadyOnOtherRoute() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/') return undefined; // the Overview marks itself when its data is in
    const id = requestAnimationFrame(() => markAppReady());
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
