// Bytes and hex text, for the APDU fixtures of the tests and for reading a response.
export function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new RangeError('not hex');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

export function bytesToHex(bytes: readonly number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Digits of a binary-coded-decimal run (two digits per byte), or null if any half-byte is not a digit.
export function bcdDigits(bytes: readonly number[]): string | null {
  let out = '';
  for (const b of bytes) {
    const hi = b >> 4;
    const lo = b & 0x0f;
    if (hi > 9 || lo > 9) return null;
    out += `${hi}${lo}`;
  }
  return out;
}

export function uint32LE(bytes: readonly number[], offset = 0): number | null {
  if (bytes.length < offset + 4) return null;
  // Not `<<`: a value of 2^31 or more would turn negative.
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000;
}

export function uint32BE(bytes: readonly number[], offset = 0): number | null {
  if (bytes.length < offset + 4) return null;
  return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

export function uint24BE(bytes: readonly number[], offset = 0): number | null {
  if (bytes.length < offset + 3) return null;
  return bytes[offset] * 0x10000 + bytes[offset + 1] * 0x100 + bytes[offset + 2];
}
