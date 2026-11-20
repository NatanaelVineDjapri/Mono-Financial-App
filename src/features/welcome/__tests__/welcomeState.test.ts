import { openTestDb } from '@/data/db/openTestDb';
import { getSetting } from '@/data/repo/settings';
import { createAccount } from '@/domain/accounts';

import { finishWelcome, needsWelcome, NICKNAME_MAX_LENGTH, NICKNAME_SETTING, WELCOME_DONE_SETTING } from '../welcomeState';

const NOW = '2026-10-28T10:00:00+07:00';

describe('when Welcome is shown', () => {
  test('a fresh install, with no account and no flag, is welcomed', async () => {
    const db = openTestDb();
    expect(await needsWelcome(db)).toBe(true);
    expect(await needsWelcome(db)).toBe(true); // reading it changes nothing
    expect(await getSetting(db, WELCOME_DONE_SETTING)).toBeNull();
  });

  test('a phone that already has an account is never welcomed, and is marked as seen', async () => {
    const db = openTestDb();
    await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 0, openingDate: '2026-10-01' }, NOW);
    expect(await needsWelcome(db)).toBe(false);
    expect(await getSetting(db, WELCOME_DONE_SETTING)).toBe('1');
  });

  test('once started it is not shown again', async () => {
    const db = openTestDb();
    await finishWelcome(db, '');
    expect(await needsWelcome(db)).toBe(false);
  });
});

describe('Mulai', () => {
  test('saves a trimmed nickname and the flag together', async () => {
    const db = openTestDb();
    await finishWelcome(db, '  Nael  ');
    expect(await getSetting(db, NICKNAME_SETTING)).toBe('Nael');
    expect(await getSetting(db, WELCOME_DONE_SETTING)).toBe('1');
  });

  test('no nickname is fine: the setting stays as it was, the flag is still saved', async () => {
    const db = openTestDb();
    await finishWelcome(db, '   ');
    expect(await getSetting(db, NICKNAME_SETTING)).toBe('');
    expect(await getSetting(db, WELCOME_DONE_SETTING)).toBe('1');
  });

  test('a chosen profile picture is saved with it; none chosen leaves the setting alone', async () => {
    const db = openTestDb();
    await finishWelcome(db, '', 'money_eyes');
    expect(await getSetting(db, 'avatar_pose')).toBe('money_eyes');
    const other = openTestDb();
    await finishWelcome(other, '');
    expect(await getSetting(other, 'avatar_pose')).toBeNull();
  });

  test('a long nickname is cut to the limit', async () => {
    const db = openTestDb();
    await finishWelcome(db, 'x'.repeat(100));
    expect((await getSetting(db, NICKNAME_SETTING))?.length).toBe(NICKNAME_MAX_LENGTH);
  });
});
