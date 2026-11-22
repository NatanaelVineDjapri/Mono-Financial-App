// What every adapter shares. An adapter is one issuer's way of reading a card: it only ever speaks through a CardIo
// (transceive.ts), so it can only send read commands, and its parsers are pure functions of the bytes they are given.
// A parser never throws: bytes it cannot make sense of give null, and the adapter says "not this card".
import { bcdDigits } from '../hex';
import type { CardIssuer } from '../../../domain/cards/types';
import type { CardIo } from '../transceive';
import { SW_OK } from '../transceive';

// What an adapter found. The card number lives only in this object, in memory, until readCard.ts has made the last 4
// digits and the fingerprint from it.
export interface CardRead {
  issuer: CardIssuer;
  pan: string; // digits only
  balance: number; // whole rupiah
  estimated?: boolean; // worked out from the last transaction record instead of read directly
}

export interface CardAdapter {
  issuer: CardIssuer;
  // The applications this adapter may select by name (the only SELECTs transceive.ts lets through).
  aids: readonly (readonly number[])[];
  // null: this is not that issuer's card (or it could not be read). Throws only CardLostError / ForbiddenCommandError.
  probe(io: CardIo): Promise<CardRead | null>;
}

// SELECT an application by name; true when the card has it.
export async function selectAid(io: CardIo, aid: readonly number[]): Promise<boolean> {
  const { sw } = await io.send([0x00, 0xa4, 0x04, 0x00, aid.length, ...aid, 0x00]);
  return sw === SW_OK;
}

// A card number of 16 digits written as 8 bytes of BCD or as 16 ASCII digits, found anywhere in `data`, that starts with
// one of the issuer's prefixes. Used where the public notes give the prefix of the number but not the exact offset.
export function findPan(data: readonly number[], prefixes: readonly string[]): string | null {
  for (let offset = 0; offset + 8 <= data.length; offset++) {
    const digits = bcdDigits(data.slice(offset, offset + 8));
    if (digits && prefixes.some(p => digits.startsWith(p))) return digits;
  }
  for (let offset = 0; offset + 16 <= data.length; offset++) {
    const chunk = data.slice(offset, offset + 16);
    if (chunk.every(b => b >= 0x30 && b <= 0x39)) {
      const digits = String.fromCharCode(...chunk);
      if (prefixes.some(p => digits.startsWith(p))) return digits;
    }
  }
  return null;
}

// A plausible balance: a whole, non-negative amount of rupiah that cannot be a misread of a long number.
export const MAX_CARD_BALANCE = 99_999_999;

export function plausibleBalance(balance: number | null): number | null {
  return balance !== null && Number.isSafeInteger(balance) && balance >= 0 && balance <= MAX_CARD_BALANCE ? balance : null;
}
