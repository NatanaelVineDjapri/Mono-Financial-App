import * as SecureStore from 'expo-secure-store';

import { clearKey, getKey, hasKey, saveKey } from '../keystore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

describe('keystore', () => {
  test('save, read, check and clear; the key goes to expo-secure-store only', async () => {
    expect(await hasKey()).toBe(false);
    expect(await getKey()).toBeNull();

    await saveKey('  AIzaTEST  ');
    expect(await hasKey()).toBe(true);
    expect(await getKey()).toBe('AIzaTEST');
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);

    await clearKey();
    expect(await hasKey()).toBe(false);
    expect(await getKey()).toBeNull();
  });

  test('an empty stored value counts as no key', async () => {
    await saveKey('   ');
    expect(await hasKey()).toBe(false);
  });
});
