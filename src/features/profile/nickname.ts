// The nickname, edited from Settings (Welcome sets it the first time). One setting, `display_name`; empty means
// "none", and the Overview then greets with its default. Saving it never touches anything else.
import type { Db } from '@/data/db/types';
import { setSetting } from '@/data/repo/settings';
import { NICKNAME_MAX_LENGTH, NICKNAME_SETTING } from '@/features/welcome/welcomeState';

export function cleanNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX_LENGTH);
}

export async function saveNickname(db: Db, raw: string): Promise<string> {
  const name = cleanNickname(raw);
  await setSetting(db, NICKNAME_SETTING, name);
  return name;
}
