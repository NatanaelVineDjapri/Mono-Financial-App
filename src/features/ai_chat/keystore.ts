// The Gemini API key lives in expo-secure-store (Android Keystore) and nowhere else: not in
// SQLite, not in the backup file, not in app state that can be dumped, not in a log. The
// functions below return it only to the one caller that sends it as a request header.
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'mono_gemini_api_key';

export async function saveKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_NAME, key.trim());
}

export async function getKey(): Promise<string | null> {
  const key = await SecureStore.getItemAsync(KEY_NAME);
  return key && key.length > 0 ? key : null;
}

export async function clearKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME);
}

export async function hasKey(): Promise<boolean> {
  return (await getKey()) != null;
}
