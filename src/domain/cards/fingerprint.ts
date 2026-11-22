// The card number (PAN) lives in memory only while a card is read. These turn it into the two things MONO keeps: the
// last 4 digits and a fingerprint. The fingerprint is sha256(salt + number) in hex; the salt is made once per install
// and rides in the backup (settings.nfc_salt), so a restored phone still recognises its cards. A backup file is not
// encrypted, so a fingerprint is a convenience for recognising a card and not a strong secret.
export type Sha256Hex = (text: string) => Promise<string>;

const SALT_BYTES = 16;

// Only digits count (a card number is often written with spaces), and a number has to look like one.
export function normalizePan(pan: string): string {
  const digits = pan.replace(/\s+/g, '');
  if (!/^\d{8,19}$/.test(digits)) throw new RangeError('not a card number');
  return digits;
}

export function last4Of(pan: string): string {
  return normalizePan(pan).slice(-4);
}

export async function fingerprintOf(pan: string, salt: string, sha256Hex: Sha256Hex): Promise<string> {
  if (salt.length === 0) throw new RangeError('a salt is needed');
  return sha256Hex(salt + normalizePan(pan));
}

// 16 random bytes as 32 hex characters.
export function saltFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== SALT_BYTES) throw new RangeError(`a salt is ${SALT_BYTES} bytes`);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
