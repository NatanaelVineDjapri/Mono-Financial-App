// The real reader: react-native-nfc-manager in reader mode, only while read() is running (the screen is open). The card is
// read as ISO-DEP and everything sent to it goes through readCard -> createSafeIo (read commands only).
//
// One thing happens outside the Scan kartu screen: Android may hand MONO a card that was held to the phone (the one intent filter
// of plugins/withNfcLaunch.js). launchedByCard() and onCardTapped() only say THAT it happened, so the app can open the Scan kartu
// screen; the tag in the system's intent is never looked at, and nothing is read from it.
//
// Nothing here logs: not a card number, not a balance, not a response.
import NfcManager, { NfcAdapter, NfcEvents, NfcTech } from 'react-native-nfc-manager';

import type { Sha256Hex } from '../../domain/cards/fingerprint';
import type { CardReader, ReadResult } from './reader';
import { readCard } from './readCard';
import type { Transport } from './transceive';

export interface RealReaderDeps {
  getSalt: () => Promise<string>;
  sha256Hex: Sha256Hex;
  now: () => string;
}

let started: Promise<boolean> | null = null;

function startOnce(): Promise<boolean> {
  if (!started) {
    started = (async () => {
      try {
        if (!(await NfcManager.isSupported())) return false;
        await NfcManager.start();
        return true;
      } catch {
        return false;
      }
    })();
  }
  return started;
}

export function createNfcManagerReader(deps: RealReaderDeps): CardReader {
  return {
    isSupported: () => startOnce(),

    async isEnabled() {
      if (!(await startOnce())) return false;
      try {
        return await NfcManager.isEnabled();
      } catch {
        return false;
      }
    },

    async read(signal, hooks): Promise<ReadResult> {
      if (signal.aborted) return { ok: false, error: 'cancelled' };
      if (!(await startOnce())) return { ok: false, error: 'unavailable' };
      if (!(await this.isEnabled())) return { ok: false, error: 'nfcOff' };

      const release = () => {
        void NfcManager.cancelTechnologyRequest().catch(() => undefined);
      };
      signal.addEventListener('abort', release);
      try {
        try {
          await NfcManager.requestTechnology(NfcTech.IsoDep, {
            isReaderModeEnabled: true,
            readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
          });
        } catch {
          return { ok: false, error: signal.aborted ? 'cancelled' : 'lost' };
        }
        if (signal.aborted) return { ok: false, error: 'cancelled' };

        hooks?.onTag?.();
        const transport: Transport = { transceive: bytes => NfcManager.isoDepHandler.transceive(bytes) };
        const salt = await deps.getSalt();
        let outcome;
        try {
          outcome = await readCard(transport, { salt, sha256Hex: deps.sha256Hex, now: deps.now });
        } catch {
          return { ok: false, error: 'unsupported' };
        }
        if (signal.aborted) return { ok: false, error: 'cancelled' };
        if (outcome.kind === 'ok') return { ok: true, card: outcome.card };
        return { ok: false, error: outcome.kind };
      } finally {
        signal.removeEventListener('abort', release);
        release();
      }
    },

    onEnabledChange(callback) {
      void startOnce();
      NfcManager.setEventListener(NfcEvents.StateChanged, (event: unknown) => {
        const state = (event as { state?: string } | null)?.state;
        if (state === 'on') callback(true);
        else if (state === 'off') callback(false);
      });
      return () => NfcManager.setEventListener(NfcEvents.StateChanged, null);
    },

    async openSettings() {
      await NfcManager.goToNfcSetting();
    },
  };
}

// Whether the app was opened by a card held to the phone (a cold start). Only a yes or no: the tag itself is dropped.
export async function launchedByCard(): Promise<boolean> {
  if (!(await startOnce())) return false;
  try {
    return (await NfcManager.getLaunchTagEvent()) != null;
  } catch {
    return false;
  }
}

// Calls `onTap` when a card is held to the phone while the app is already running. Returns the way to stop listening.
export function onCardTapped(onTap: () => void): () => void {
  let active = true;
  void startOnce().then(ok => {
    if (!ok || !active) return;
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, () => {
      void NfcManager.clearBackgroundTag().catch(() => undefined);
      onTap();
    });
  });
  return () => {
    active = false;
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, null);
  };
}
