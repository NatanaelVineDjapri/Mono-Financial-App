// The AI chat's on/off switch and the combined "is it usable" check. The switch lives in the
// `settings` table (`ai_enabled`, default 0), NOT in the Keystore: only the key is a secret.
// Turning the switch off never deletes the key; deleting the key turns the switch off.
import type { Db } from '../../data/db/types';
import { getSetting, setSetting } from '../../data/repo/settings';
import { testKey, type AiErrorCode } from './client';
import { clearKey, hasKey, saveKey } from './keystore';

export const AI_ENABLED_SETTING = 'ai_enabled';

export async function getAiEnabled(db: Db): Promise<boolean> {
  return (await getSetting(db, AI_ENABLED_SETTING)) === '1';
}

export async function setAiEnabled(db: Db, enabled: boolean): Promise<void> {
  await setSetting(db, AI_ENABLED_SETTING, enabled ? '1' : '0');
}

// The tab bar's + opens the chat only when this is true: a key is saved AND the switch is on.
export async function isAiConfigured(db: Db): Promise<boolean> {
  return (await getAiEnabled(db)) && (await hasKey());
}

// "Hapus kunci": the key goes from the Keystore and the switch goes off.
// TODO(erase): "Erase all data" (Settings, not built yet) must call this too, so the key never
// outlives the data it was for.
export async function deleteKeyAndDisable(db: Db): Promise<void> {
  await clearKey();
  await setAiEnabled(db, false);
}

export interface SubmitDeps {
  testKey: typeof testKey;
  saveKey: typeof saveKey;
}

// "Simpan dan tes kunci": the key is tested first with one short message (no financial data).
// Only a key that passes is saved, and only then is the switch turned on. A key that fails is
// kept nowhere.
export async function submitKey(
  db: Db,
  key: string,
  deps: SubmitDeps = { testKey, saveKey },
): Promise<{ ok: true } | { ok: false; code: AiErrorCode }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, code: 'key_rejected' };
  const tested = await deps.testKey(trimmed);
  if (!tested.ok) return tested;
  await deps.saveKey(trimmed);
  await setAiEnabled(db, true);
  return { ok: true };
}
