// /nfc/scan: waits for an e-money card while this screen is open, then goes to the result (a card an account has) or to
// the new-card screen (a card nobody has yet). The states (NFC off, not supported, card lost) are drawn in place.
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useScanSession } from '@/features/nfc/scanSession';
import { ScanView } from '@/features/nfc/ScanView';
import { useCardScan } from '@/features/nfc/useCardScan';

export default function NfcScanRoute() {
  const router = useRouter();
  const { state, retry, openSettings } = useCardScan();
  const setCard = useScanSession(s => s.setCard);
  const clear = useScanSession(s => s.clear);

  useEffect(() => {
    if (state.status === 'known') {
      setCard(state.card);
      router.replace('/nfc/result' as never);
    } else if (state.status === 'unknown') {
      setCard(state.card);
      router.replace('/nfc/new' as never);
    }
  }, [state, setCard, router]);

  return (
    <ScanView
      state={state}
      onCancel={() => {
        clear();
        router.back();
      }}
      onRetry={retry}
      onOpenSettings={openSettings}
      onManual={() => router.replace('/account/edit' as never)}
    />
  );
}
