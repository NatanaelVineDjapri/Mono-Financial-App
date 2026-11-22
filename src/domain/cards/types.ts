// What the upper layers know about a scanned e-money card. The card number itself never gets here: the reader turns it
// into the last 4 digits and a fingerprint at once and drops it (src/features/nfc/reader.ts).
import type { CardIssuer } from '../../data/repo/cardLinks';

export type { CardIssuer };

export const CARD_ISSUERS: readonly CardIssuer[] = ['mandiri', 'flazz', 'tapcash', 'brizzi', 'jakcard'];

export interface CardInfo {
  issuer: CardIssuer;
  last4: string; // exactly 4 digits
  fingerprint: string; // sha256 hex of (salt + card number)
  balance: number; // whole rupiah, never negative
  readAt: string; // ISO instant, the moment the card was read
  // True when the balance was worked out from the card's last transaction record instead of read directly (Brizzi,
  // when its value counter is protected). It is shown as an estimate.
  estimated: boolean;
}

// "stable" is a reading that has been tried with a physical card; "experimental" is built from the public description
// of the protocol and not yet checked against a card in hand (the screen says so).
export type IssuerStatus = 'stable' | 'experimental';

export const ISSUER_STATUS: Record<CardIssuer, IssuerStatus> = {
  mandiri: 'stable',
  flazz: 'experimental',
  tapcash: 'experimental',
  brizzi: 'experimental',
  jakcard: 'experimental',
};

// The brand names are not translated. The default name of an account made from a card is the issuer's.
export const ISSUER_NAMES: Record<CardIssuer, string> = {
  mandiri: 'E-money Mandiri',
  flazz: 'Flazz BCA',
  tapcash: 'TapCash BNI',
  brizzi: 'Brizzi BRI',
  jakcard: 'JakCard',
};

export const DEFAULT_ACCOUNT_NAME = (issuer: CardIssuer): string => ISSUER_NAMES[issuer];
