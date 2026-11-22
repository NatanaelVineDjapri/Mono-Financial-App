// What the scan screen needs from "something that reads cards": the real NFC reader on a phone, or the pretend one of a
// development build (the Android emulator has no NFC). The interface carries no card number: a read gives the issuer,
// the last 4 digits, the fingerprint and the balance, or a reason it did not.
import type { CardInfo } from '../../domain/cards/types';

export type ReadError =
  | 'unsupported' // not an e-money card MONO can read (a debit or credit card, another issuer, or generation 1 Flazz)
  | 'lost' // the card moved away before the reading was done
  | 'nfcOff' // NFC is switched off
  | 'cancelled' // the person left the screen or tapped Cancel
  | 'unavailable'; // this phone has no NFC, or it could not be started

export type ReadResult = { ok: true; card: CardInfo } | { ok: false; error: ReadError };

export interface ReadHooks {
  // Called when a card is in the field and the reading starts.
  onTag?: () => void;
}

export interface CardReader {
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  // Waits for a card (reader mode, only while this is running), reads it, and lets go. Aborting the signal stops the wait.
  read(signal: AbortSignal, hooks?: ReadHooks): Promise<ReadResult>;
  // Calls back when NFC is switched on or off; returns how to stop listening.
  onEnabledChange(callback: (enabled: boolean) => void): () => void;
  openSettings(): Promise<void>;
}
