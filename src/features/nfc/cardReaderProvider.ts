// Which reader the app uses: the pretend one while the development switch is on (a release build never has it: __DEV__
// is false), otherwise the real one. The real one is only loaded when it is needed, so a phone, a test or a screen that
// never scans never touches the native module.
import * as Crypto from 'expo-crypto';

import { nowIso } from '../../core/clock';
import { sha256Hex } from '../../core/sha256';
import type { Db } from '../../data/db/types';
import { ensureNfcSalt } from '../../domain/cards/links';
import { createMockReader, isMockActive } from './mock/mockCardReader';
import type { CardReader } from './reader';

export function getCardReader(db: Db): CardReader {
  // The salt of the fingerprints: made once, from random bytes, at the first scan; kept with the settings.
  const getSalt = () => ensureNfcSalt(db, () => Crypto.getRandomBytesAsync(16));
  if (isMockActive()) return createMockReader({ db, getSalt, sha256Hex, now: nowIso });
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, see above
  const { createNfcManagerReader } = require('./nfcManagerReader') as typeof import('./nfcManagerReader');
  return createNfcManagerReader({ getSalt, sha256Hex, now: nowIso });
}

// Whether the entry points ("Scan kartu") are shown: only on a phone that has NFC, or while the pretend reader is on.
export async function isNfcAvailable(db: Db): Promise<boolean> {
  if (isMockActive()) return true;
  try {
    return await getCardReader(db).isSupported();
  } catch {
    return false;
  }
}
