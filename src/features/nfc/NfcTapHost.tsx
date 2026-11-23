// Opens the Scan kartu screen when an e-money card is held to the phone and Android hands it to MONO (the "NFC tag detected"
// behaviour; the one intent filter is declared by plugins/withNfcLaunch.js). It only navigates: the screen it opens does the
// reading, in reader mode, so a card still held to the phone is read at once and any other card is refused there.
// It waits for the first-launch Welcome, and does nothing while a card screen is already open.
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useNeedsWelcome } from '@/features/welcome/useNeedsWelcome';

import { watchCardTaps } from './cardReaderProvider';

export function NfcTapHost() {
  const router = useRouter();
  const pathname = usePathname();
  const needsWelcome = useNeedsWelcome();
  // Read through refs, so the listener below is set up once and still sees the screen the person is on now.
  const onCardScreen = useRef(false);
  const ready = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    onCardScreen.current = pathname.startsWith('/nfc');
    ready.current = needsWelcome === false;
  }, [pathname, needsWelcome]);

  useEffect(() => {
    return watchCardTaps(() => {
      if (onCardScreen.current) return; // the Scan kartu screen is already waiting for it
      if (!ready.current) {
        pending.current = true; // opened by the card before the app knew whether to show Welcome: go once it is known
        return;
      }
      router.push('/nfc/scan' as never);
    });
  }, [router]);

  useEffect(() => {
    if (needsWelcome === false && pending.current) {
      pending.current = false;
      if (!onCardScreen.current) router.push('/nfc/scan' as never);
    }
  }, [needsWelcome, router]);

  return null;
}
