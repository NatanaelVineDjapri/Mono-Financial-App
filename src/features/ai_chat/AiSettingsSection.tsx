// The AI chat's controls for Settings (Settings is not built yet; the setup screen shows this
// section once a key is saved, and Settings can mount it as it is):
//   - the switch "Catat lewat chat (AI)": off by default, and it cannot be turned on until a key
//     has passed its test. Turning it off does not delete the key.
//   - the "API key Gemini" row, which opens /ai-setup (only when `onOpenSetup` is given).
//   - "Hapus kunci", with a confirmation. It deletes the key and turns the switch off.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { MonoSwitch } from '@/components/MonoSwitch';
import { showToast } from '@/components/toast-store';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import {
  aiDeleteKeyConfirm,
  aiDeleteKeyLabel,
  aiDeleteKeyMessage,
  aiDeleteKeyTitle,
  aiKeyDeletedToast,
  aiSettingsKeyRowLabel,
  aiSettingsKeyRowValue,
  aiSettingsSwitchLabel,
  aiSettingsSwitchNeedsKeyHint,
  aiDraftCancelButton,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { deleteKeyAndDisable, getAiEnabled, setAiEnabled } from './aiSettings';
import { useChatStore } from './chatStore';
import { hasKey } from './keystore';

export const aiSettingsKey = [...queryKeys.settings, 'ai-settings'] as const;

export function useAiSettings() {
  const db = useDb();
  return useQuery({
    queryKey: aiSettingsKey,
    queryFn: async () => ({ enabled: await getAiEnabled(db), hasKey: await hasKey() }),
    staleTime: 0,
  });
}

export function AiSettingsSection({ onOpenSetup }: { onOpenSetup?: () => void }) {
  const db = useDb();
  const queryClient = useQueryClient();
  const { data } = useAiSettings();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const keySaved = data?.hasKey === true;
  const enabled = keySaved && data?.enabled === true;

  const toggle = async (next: boolean) => {
    if (next && !keySaved) return; // cannot be turned on before a key has passed its test
    await setAiEnabled(db, next);
    await invalidateAfterWrite(queryClient);
  };

  const deleteKey = async () => {
    setBusy(true);
    await deleteKeyAndDisable(db);
    useChatStore.getState().reset(); // the conversation was about to use that key
    await invalidateAfterWrite(queryClient);
    setBusy(false);
    setConfirming(false);
    showToast(aiKeyDeletedToast());
  };

  return (
    <View style={styles.section} testID="ai-settings">
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>{aiSettingsSwitchLabel()}</Text>
          {!keySaved && <Text style={styles.hint}>{aiSettingsSwitchNeedsKeyHint()}</Text>}
        </View>
        <MonoSwitch value={enabled} onValueChange={v => void toggle(v)} label={aiSettingsSwitchLabel()} disabled={!keySaved} testID="ai-switch" />
      </View>

      {onOpenSetup && (
        <Pressable onPress={onOpenSetup} accessibilityRole="button" accessibilityLabel={`${aiSettingsKeyRowLabel()}, ${aiSettingsKeyRowValue(keySaved)}`} style={styles.row} testID="ai-key-row">
          <Text style={[styles.label, styles.rowText]}>{aiSettingsKeyRowLabel()}</Text>
          <Text style={styles.value}>{aiSettingsKeyRowValue(keySaved)}</Text>
          <Icon name="chevron-right" color={MonoColors.textSecond} />
        </Pressable>
      )}

      {keySaved && <Button label={aiDeleteKeyLabel()} variant="secondary" onPress={() => setConfirming(true)} testID="ai-delete-key" />}

      <ConfirmDialog
        visible={confirming}
        icon="trash"
        title={aiDeleteKeyTitle()}
        message={[{ text: aiDeleteKeyMessage() }]}
        cancelLabel={aiDraftCancelButton()}
        confirmLabel={aiDeleteKeyConfirm()}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void deleteKey()}
        testID="ai-delete-dialog"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  label: { ...MonoText.body, color: MonoColors.text },
  hint: { ...MonoText.caption, color: MonoColors.textMeta },
  value: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
