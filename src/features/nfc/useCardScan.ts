// Runs a scan for the scan screen: waits for a card while the screen is open (reader mode, nothing in the background),
// reads it, and says what happened through the pure reducer in src/domain/cards/scanState. It stops when the screen is
// left, and looks at the NFC switch again when the app comes back to the front (the person may have turned it on).
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { initialScanState, scanReducer, type ScanState } from '@/domain/cards/scanState';
import { findCardAccount } from '@/domain/cards/links';

import { getCardReader } from './cardReaderProvider';
import { useMockCardStore } from './mock/mockCardReader';

export interface CardScan {
  state: ScanState;
  retry: () => void;
  openSettings: () => void;
}

export function useCardScan(): CardScan {
  const db = useDb();
  const mock = useMockCardStore(s => s.enabled);
  const reader = useMemo(() => getCardReader(db), [db, mock]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, dispatch] = useReducer(scanReducer, initialScanState);

  const begin = useCallback(
    async (type: 'start' | 'retry') => {
      const enabled = await reader.isEnabled();
      dispatch(type === 'start' ? { type: 'start', nfcEnabled: enabled } : { type: 'retry', nfcEnabled: enabled });
    },
    [reader],
  );

  // Open: look at the NFC switch and start waiting.
  useEffect(() => {
    void begin('start');
  }, [begin]);

  // NFC switched on or off while the screen is open, and the app returning from the phone's settings.
  useEffect(() => {
    const stop = reader.onEnabledChange(enabled => dispatch({ type: 'nfcChanged', enabled }));
    const sub = AppState.addEventListener('change', async next => {
      if (next !== 'active') return;
      dispatch({ type: 'nfcChanged', enabled: await reader.isEnabled() });
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [reader]);

  // While a card is awaited or being read there is one read going; leaving that, or the screen, stops it.
  const active = state.status === 'waiting' || state.status === 'reading';
  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    void (async () => {
      const result = await reader.read(controller.signal, { onTag: () => dispatch({ type: 'tag' }) });
      if (controller.signal.aborted) return;
      if (result.ok) {
        const known = (await findCardAccount(db, result.card.fingerprint)) != null;
        if (!controller.signal.aborted) dispatch({ type: 'read', card: result.card, known });
      } else if (result.error === 'unsupported') dispatch({ type: 'unsupported' });
      else if (result.error === 'lost') dispatch({ type: 'lost' });
      else if (result.error === 'nfcOff' || result.error === 'unavailable') dispatch({ type: 'nfcChanged', enabled: false });
    })();
    return () => controller.abort();
  }, [active, reader, db]);

  const retry = useCallback(() => void begin('retry'), [begin]);
  const openSettings = useCallback(() => void reader.openSettings(), [reader]);
  return { state, retry, openSettings };
}
