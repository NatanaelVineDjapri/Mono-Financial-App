// Gets the other tabs ready while the Overview sits idle: Transactions, Accounts and Budgets are mounted in the background one
// after the other (expo-router's router.prefetch), a couple of seconds after the Overview has settled. Without this a tab is
// built the first time it is opened and the person sees an empty screen until it is. One at a time, so that no single moment
// keeps the JS thread busy for long, and late enough that opening the app itself is not slowed down.
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export const PRELOAD_TABS = ['/(tabs)/transactions', '/(tabs)/accounts', '/(tabs)/budgets'] as const;
export const FIRST_PRELOAD_DELAY_MS = 2500;
export const NEXT_PRELOAD_DELAY_MS = 1500;

export function PreloadTabs() {
  const router = useRouter();
  useEffect(() => {
    const timers = PRELOAD_TABS.map((href, index) =>
      setTimeout(() => {
        // Only a head start: if the router cannot do it (or it throws), the tab is simply built when it is opened.
        try {
          router.prefetch?.(href as never);
        } catch {
          // nothing to do
        }
      }, FIRST_PRELOAD_DELAY_MS + index * NEXT_PRELOAD_DELAY_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [router]);
  return null;
}
