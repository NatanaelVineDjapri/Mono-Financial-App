// Catat lewat chat: setup and consent (/ai-setup, AI-Setup board, PAGES.md K1). It says what is
// and is not sent to Gemini, takes the person's OWN API key, tests it with one short message and
// only then saves it (Android Keystore through expo-secure-store) and turns the feature on. A key
// that fails is saved nowhere. The key's text is never logged, never shown in a toast, and is
// dropped from state as soon as it is saved. With a key already saved, the same screen is where
// the switch, a new key and "Hapus kunci" live.
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { AiSettingsSection, useAiSettings } from '@/features/ai_chat/AiSettingsSection';
import { submitKey } from '@/features/ai_chat/aiSettings';
import { API_KEY_URL } from '@/features/ai_chat/config';
import { errorMessage, type ErrorMessage } from '@/features/ai_chat/messages';
import { useBlockScreenshots } from '@/features/ai_chat/useBlockScreenshots';
import { MascotAvatar } from '@/features/ai_chat/ui/MascotAvatar';
import { Notice } from '@/features/ai_chat/ui/Notice';
import {
  aiBackLabel,
  aiSetupApiKeyLabel,
  aiSetupBadge,
  aiSetupBillingWarning,
  aiSetupDescription,
  aiSetupGetKeyLink,
  aiSetupGetKeyLinkLabel,
  aiSetupHideKeyLabel,
  aiSetupKeyNote,
  aiSetupKeySavedHint,
  aiSetupKeySavedTitle,
  aiSetupLaterButton,
  aiSetupNotSent,
  aiSetupNotSentItem1,
  aiSetupNotSentItem2,
  aiSetupPasteButton,
  aiSetupRejectedHelp,
  aiSetupRejectedHelpLabel,
  aiSetupReplaceKeyLabel,
  aiSetupSaveAndTest,
  aiSetupSentItem1,
  aiSetupSentItem2,
  aiSetupSentItem3,
  aiSetupSentToGemini,
  aiSetupShowKeyLabel,
  aiSetupTestNote,
  aiSetupTesting,
  aiSetupTitle,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const MIN_KEY_LENGTH = 8;

export default function AiSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const { data: settings } = useAiSettings();
  useBlockScreenshots('ai-setup');

  const [keyText, setKeyText] = useState('');
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const keySaved = settings?.hasKey === true;
  const canSave = keyText.trim().length >= MIN_KEY_LENGTH && !testing;

  const paste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setKeyText(text.trim());
      setError(null);
    }
  }, []);

  const save = useCallback(async () => {
    if (!canSave) return;
    setTesting(true);
    setError(null);
    const result = await submitKey(db, keyText);
    setTesting(false);
    if (!result.ok) {
      // The key stays in the box so a typo can be fixed; nothing was saved.
      setError(errorMessage(result.code));
      return;
    }
    setKeyText(''); // the key's text leaves the screen's state once it is saved
    setVisible(false);
    await invalidateAfterWrite(queryClient);
    router.replace('/ai-chat' as never);
  }, [canSave, db, keyText, queryClient, router]);

  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior="padding">
      <View style={styles.header}>
        <IconButton label={aiBackLabel()} onPress={() => router.back()} testID="setup-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <MascotAvatar size={48} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{aiSetupBadge()}</Text>
          </View>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {aiSetupTitle()}
        </Text>
        <Text style={styles.description}>{aiSetupDescription()}</Text>

        <Card style={styles.disclosure}>
          <Text style={styles.section}>{aiSetupSentToGemini()}</Text>
          <Item sent text={aiSetupSentItem1()} />
          <Item sent text={aiSetupSentItem2()} />
          <Item sent text={aiSetupSentItem3()} />
          <View style={styles.divider} />
          <Text style={styles.section}>{aiSetupNotSent()}</Text>
          <Item sent={false} text={aiSetupNotSentItem1()} />
          <Item sent={false} text={aiSetupNotSentItem2()} />
        </Card>

        {keySaved && (
          <Card style={styles.savedCard} testID="key-saved-card">
            <View style={styles.savedHead}>
              <Icon name="check" size={20} color={MonoColors.text} />
              <Text style={styles.savedTitle}>{aiSetupKeySavedTitle()}</Text>
            </View>
            <Text style={styles.savedHint}>{aiSetupKeySavedHint()}</Text>
            <AiSettingsSection />
          </Card>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{keySaved ? aiSetupReplaceKeyLabel() : aiSetupApiKeyLabel()}</Text>
          <Pressable onPress={() => setHelpOpen(open => !open)} accessibilityRole="link" accessibilityLabel={aiSetupRejectedHelpLabel()} accessibilityState={{ expanded: helpOpen }} hitSlop={8} style={styles.linkTarget} testID="rejected-help-link">
            <Text style={styles.link}>{aiSetupRejectedHelpLabel()}</Text>
          </Pressable>
        </View>
        {helpOpen && (
          <Text style={styles.help} testID="rejected-help">
            {aiSetupRejectedHelp()}
          </Text>
        )}

        <View style={[styles.field, !!error && styles.fieldError]}>
          <TextInput
            value={keyText}
            onChangeText={text => {
              setKeyText(text);
              setError(null);
            }}
            placeholder="AIza…"
            placeholderTextColor={MonoColors.textDisabled}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            importantForAutofill="no"
            editable={!testing}
            accessibilityLabel={aiSetupApiKeyLabel()}
            style={styles.input}
            testID="key-input"
          />
          <Pressable onPress={() => setVisible(v => !v)} accessibilityRole="button" accessibilityLabel={visible ? aiSetupHideKeyLabel() : aiSetupShowKeyLabel()} hitSlop={8} style={styles.iconTarget} testID="key-eye">
            <Icon name={visible ? 'eye-off' : 'eye'} color={MonoColors.textSecond} />
          </Pressable>
          <Pressable onPress={() => void paste()} accessibilityRole="button" accessibilityLabel={aiSetupPasteButton()} style={styles.paste} testID="key-paste">
            <Text style={styles.pasteText}>{aiSetupPasteButton()}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void Linking.openURL(API_KEY_URL).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={aiSetupGetKeyLinkLabel()}
          style={styles.getKey}
          testID="get-key-link"
        >
          <Text style={styles.getKeyText}>{aiSetupGetKeyLink()}</Text>
          <Icon name="chevron-right" size={16} color={MonoColors.text} />
        </Pressable>

        {error && <Notice title={error.title} text={error.detail} testID="key-error" />}

        <View style={styles.note}>
          <Icon name="lock" size={16} color={MonoColors.textMeta} />
          <Text style={styles.noteText}>{aiSetupKeyNote()}</Text>
        </View>
        <View style={styles.note}>
          <Icon name="info" size={16} color={MonoColors.textSecond} />
          <Text style={[styles.noteText, { color: MonoColors.textSecond }]}>{aiSetupBillingWarning()}</Text>
        </View>

        <Button
          label={testing ? aiSetupTesting() : aiSetupSaveAndTest()}
          onPress={() => void save()}
          disabled={!canSave}
          style={styles.save}
          testID="key-save"
        />
        {testing && <ActivityIndicator color={MonoColors.textSecond} accessibilityLabel={aiSetupTesting()} />}
        <Button label={aiSetupLaterButton()} variant="secondary" onPress={() => router.back()} testID="key-later" />
        <Text style={styles.testNote}>{aiSetupTestNote()}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Item({ sent, text }: { sent: boolean; text: string }) {
  return (
    <View style={styles.item}>
      <Icon name={sent ? 'check' : 'close'} size={16} color={MonoColors.text} />
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, paddingVertical: 4 },
  content: { paddingHorizontal: 20, gap: 16 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.surface, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { ...MonoText.label, color: MonoColors.textMeta },
  title: { ...MonoText.titleL, color: MonoColors.text },
  description: { ...MonoText.body, color: MonoColors.textSecond },
  disclosure: { gap: 10 },
  section: { ...MonoText.label, color: MonoColors.textMeta },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemText: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  divider: { height: 1, backgroundColor: MonoColors.border, marginVertical: 4 },
  savedCard: { gap: 12 },
  savedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  savedHint: { ...MonoText.bodyS, color: MonoColors.textSecond },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { ...MonoText.label, color: MonoColors.textMeta, flexShrink: 1 },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  link: { ...MonoText.bodyS, color: MonoColors.textSecond, textDecorationLine: 'underline' },
  help: { ...MonoText.bodyS, color: MonoColors.textSecond },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: MonoColors.card, borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border, paddingLeft: 14, paddingRight: 8 },
  fieldError: { borderColor: MonoColors.negative, borderWidth: 1.5 },
  input: { flex: 1, ...MonoText.body, color: MonoColors.text, paddingVertical: 12 },
  iconTarget: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  paste: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  pasteText: { ...MonoText.bodyStrong, color: MonoColors.text },
  getKey: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  getKeyText: { ...MonoText.bodyStrong, color: MonoColors.text, textDecorationLine: 'underline', flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { ...MonoText.bodyS, color: MonoColors.textMeta, flex: 1 },
  save: { marginTop: 8 },
  testNote: { ...MonoText.caption, color: MonoColors.textMeta, textAlign: 'center' },
});
