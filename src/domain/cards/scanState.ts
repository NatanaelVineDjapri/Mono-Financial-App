// The states of the Scan card screen as a pure reducer, so every transition can be tested without a phone.
//
//   idle -> waiting -> reading -> known | unknown | unsupported | lost
//   (any of waiting / reading) -> nfcOff when NFC is switched off; nfcOff -> waiting when it is switched on again
//   known | unknown | unsupported | lost -> waiting again on "retry"; anything -> idle on "cancel"
import type { CardInfo } from './types';

export type ScanState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'reading' }
  | { status: 'known'; card: CardInfo }
  | { status: 'unknown'; card: CardInfo }
  | { status: 'unsupported' }
  | { status: 'lost' }
  | { status: 'nfcOff' };

export type ScanEvent =
  | { type: 'start'; nfcEnabled: boolean }
  | { type: 'nfcChanged'; enabled: boolean }
  | { type: 'tag' }
  | { type: 'read'; card: CardInfo; known: boolean }
  | { type: 'unsupported' }
  | { type: 'lost' }
  | { type: 'retry'; nfcEnabled: boolean }
  | { type: 'cancel' };

export const initialScanState: ScanState = { status: 'idle' };

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'cancel':
      return { status: 'idle' };
    case 'start':
      return state.status === 'idle' ? (event.nfcEnabled ? { status: 'waiting' } : { status: 'nfcOff' }) : state;
    case 'retry':
      return event.nfcEnabled ? { status: 'waiting' } : { status: 'nfcOff' };
    case 'nfcChanged':
      if (!event.enabled) return state.status === 'waiting' || state.status === 'reading' ? { status: 'nfcOff' } : state;
      return state.status === 'nfcOff' ? { status: 'waiting' } : state;
    case 'tag':
      return state.status === 'waiting' ? { status: 'reading' } : state;
    case 'read':
      if (state.status !== 'reading') return state;
      return event.known ? { status: 'known', card: event.card } : { status: 'unknown', card: event.card };
    case 'unsupported':
      return state.status === 'reading' || state.status === 'waiting' ? { status: 'unsupported' } : state;
    case 'lost':
      return state.status === 'reading' ? { status: 'lost' } : state;
  }
}
