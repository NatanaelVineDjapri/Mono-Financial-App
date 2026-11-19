// Welcome is shown once, on the first launch. "Seen" is one local setting (`welcome_done`), nothing derived is
// stored. A phone that already has accounts (an install from before the Welcome screen existed, or a restored
// backup) is never welcomed: it is marked as seen the first time it is read.
import type { Db } from '@/data/db/types';
import { getSetting, setSetting } from '@/data/repo/settings';

export const WELCOME_DONE_SETTING = 'welcome_done';
export const NICKNAME_SETTING = 'display_name';
export const NICKNAME_MAX_LENGTH = 24;

export async function needsWelcome(db: Db): Promise<boolean> {
  if ((await getSetting(db, WELCOME_DONE_SETTING)) === '1') return false;
  const accounts = await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts');
  if ((accounts?.n ?? 0) > 0) {
    await setSetting(db, WELCOME_DONE_SETTING, '1');
    return false;
  }
  return true;
}

// "Mulai": the nickname (optional, trimmed, at most NICKNAME_MAX_LENGTH characters) and the flag, together.
export async function finishWelcome(db: Db, nickname: string): Promise<void> {
  const name = nickname.trim().slice(0, NICKNAME_MAX_LENGTH);
  if (name) await setSetting(db, NICKNAME_SETTING, name);
  await setSetting(db, WELCOME_DONE_SETTING, '1');
}
