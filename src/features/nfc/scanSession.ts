// The card that was just read, handed from the scan screen to the result screen and the new-card screen. In memory only,
// and it holds what the app may know of a card (issuer, last 4 digits, fingerprint, balance), never the card number.
import { create } from 'zustand';

import type { CardInfo } from '../../domain/cards/types';

interface ScanSession {
  card: CardInfo | null;
  setCard: (card: CardInfo) => void;
  clear: () => void;
}

export const useScanSession = create<ScanSession>(set => ({
  card: null,
  setCard: card => set({ card }),
  clear: () => set({ card: null }),
}));
