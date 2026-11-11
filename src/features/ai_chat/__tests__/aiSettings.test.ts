import { openTestDb } from '../../../data/db/openTestDb';
import { getSetting } from '../../../data/repo/settings';
import { deleteKeyAndDisable, getAiEnabled, isAiConfigured, setAiEnabled, submitKey } from '../aiSettings';
import { clearKey, getKey, hasKey, saveKey } from '../keystore';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

beforeEach(() => mockStore.clear());

describe('isAiConfigured: a saved key AND the switch on', () => {
  test.each([
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, true],
  ])('switch %s, key %s -> %s', async (switchOn, keySaved, expected) => {
    const db = openTestDb();
    await setAiEnabled(db, switchOn);
    if (keySaved) await saveKey('AIzaTEST');
    expect(await isAiConfigured(db)).toBe(expected);
  });

  test('the switch is off by default (the schema seeds ai_enabled = 0), and is kept in settings, not in the Keystore', async () => {
    const db = openTestDb();
    expect(await getAiEnabled(db)).toBe(false);
    await setAiEnabled(db, true);
    expect(await getSetting(db, 'ai_enabled')).toBe('1');
    expect(mockStore.size).toBe(0);
  });

  test('turning the switch off does not delete the key', async () => {
    const db = openTestDb();
    await saveKey('AIzaTEST');
    await setAiEnabled(db, true);
    await setAiEnabled(db, false);
    expect(await hasKey()).toBe(true);
    expect(await isAiConfigured(db)).toBe(false);
  });
});

describe('deleting the key', () => {
  test('clearKey makes hasKey false (what "Erase all data" will call)', async () => {
    await saveKey('AIzaTEST');
    expect(await hasKey()).toBe(true);
    await clearKey();
    expect(await hasKey()).toBe(false);
    expect(await getKey()).toBeNull();
  });

  test('"Hapus kunci" removes the key and turns the switch off', async () => {
    const db = openTestDb();
    await saveKey('AIzaTEST');
    await setAiEnabled(db, true);
    await deleteKeyAndDisable(db);
    expect(await hasKey()).toBe(false);
    expect(await getAiEnabled(db)).toBe(false);
    expect(await isAiConfigured(db)).toBe(false);
  });
});

describe('submitKey ("Simpan dan tes kunci")', () => {
  test('a key that passes the test is saved and the switch goes on', async () => {
    const db = openTestDb();
    const testKey = jest.fn(async () => ({ ok: true }) as const);
    expect(await submitKey(db, '  AIzaGOOD  ', { testKey, saveKey })).toEqual({ ok: true });
    expect(testKey).toHaveBeenCalledWith('AIzaGOOD');
    expect(await getKey()).toBe('AIzaGOOD');
    expect(await isAiConfigured(db)).toBe(true);
  });

  test.each(['key_rejected', 'no_internet', 'quota', 'generic', 'timeout'] as const)('a key that fails (%s) is saved nowhere and the switch stays off', async code => {
    const db = openTestDb();
    const testKey = jest.fn(async () => ({ ok: false, code }) as const);
    expect(await submitKey(db, 'AIzaBAD', { testKey, saveKey })).toEqual({ ok: false, code });
    expect(await getKey()).toBeNull();
    expect(await getAiEnabled(db)).toBe(false);
  });

  test('an empty key is rejected without a test', async () => {
    const db = openTestDb();
    const testKey = jest.fn();
    expect(await submitKey(db, '   ', { testKey, saveKey })).toEqual({ ok: false, code: 'key_rejected' });
    expect(testKey).not.toHaveBeenCalled();
  });

  test('a failed key never reaches the console', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    try {
      const db = openTestDb();
      await submitKey(db, 'AIzaSECRET-KEY', { testKey: async () => ({ ok: false, code: 'key_rejected' }), saveKey });
      expect(spies.flatMap(s => s.mock.calls.flat()).map(String).join('\n')).not.toContain('AIzaSECRET-KEY');
    } finally {
      spies.forEach(s => s.mockRestore());
    }
  });
});
