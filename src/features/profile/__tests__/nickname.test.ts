import { openMigratedTestDb } from '@/data/db/openTestDb';
import { getSetting } from '@/data/repo/settings';

import { cleanNickname, saveNickname } from '../nickname';

describe('cleanNickname', () => {
  test('trims, collapses spaces and cuts to 24 characters', () => {
    expect(cleanNickname('  Budi   Santoso ')).toBe('Budi Santoso');
    expect(cleanNickname('a'.repeat(40))).toHaveLength(24);
    expect(cleanNickname('   ')).toBe('');
  });
});

describe('saveNickname', () => {
  test('writes the one setting, and an empty name clears it', async () => {
    const db = await openMigratedTestDb();
    expect(await saveNickname(db, ' Nael ')).toBe('Nael');
    expect(await getSetting(db, 'display_name')).toBe('Nael');
    await saveNickname(db, '');
    expect(await getSetting(db, 'display_name')).toBe('');
  });
});
