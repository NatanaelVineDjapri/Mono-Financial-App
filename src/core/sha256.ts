// The real SHA-256 implementation, for the app. expo-crypto has no native binding under
// Jest (jest-expo's mock returns an empty string), so backup/export.ts and validate.ts
// take this as an injected function — Jest tests pass a Node crypto-backed one instead.
import * as Crypto from 'expo-crypto';

export async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}
