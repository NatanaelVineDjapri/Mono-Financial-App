// A card in the field -> what the rest of the app may know about it. Tries each adapter in turn; the first that
// recognises the card gives the number and the balance, and the number is turned into the last 4 digits and a
// fingerprint at once. It is not stored, returned or logged: after this function nothing holds it.
import { fingerprintOf, last4Of, type Sha256Hex } from '../../domain/cards/fingerprint';
import type { CardInfo } from '../../domain/cards/types';
import type { CardAdapter } from './adapters/common';
import { ADAPTERS } from './adapters';
import { CardLostError, createSafeIo, ForbiddenCommandError, type Transport } from './transceive';

export type ReadOutcome = { kind: 'ok'; card: CardInfo } | { kind: 'unsupported' } | { kind: 'lost' };

export interface ReadDeps {
  salt: string;
  sha256Hex: Sha256Hex;
  now: () => string; // ISO instant
}

export async function readCard(transport: Transport, deps: ReadDeps, adapters: readonly CardAdapter[] = ADAPTERS): Promise<ReadOutcome> {
  const io = createSafeIo(transport, adapters.flatMap(a => a.aids));
  for (const adapter of adapters) {
    let found;
    try {
      found = await adapter.probe(io);
    } catch (error) {
      if (error instanceof CardLostError) return { kind: 'lost' };
      if (error instanceof ForbiddenCommandError) throw error; // a bug in an adapter, never a card's fault
      found = null; // anything else: this adapter could not read the card, the next one may
    }
    if (!found) continue;
    try {
      const card: CardInfo = {
        issuer: found.issuer,
        last4: last4Of(found.pan),
        fingerprint: await fingerprintOf(found.pan, deps.salt, deps.sha256Hex),
        balance: found.balance,
        readAt: deps.now(),
        estimated: found.estimated === true,
      };
      return { kind: 'ok', card };
    } catch {
      continue; // a number that does not look like one: not this issuer's card after all
    }
  }
  return { kind: 'unsupported' };
}
