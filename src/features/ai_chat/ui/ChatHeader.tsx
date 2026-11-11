// The chat's header (AI-Chat board, 64 high): back, "Catat lewat chat" with "Hanya membuat
// draf" under it, and the key icon (opens the AI settings). There is no "Catat manual" button
// here (decided by the owner); the manual form is one of the + menu's choices, and a failed
// message still offers it. It grows with the text size; nothing is cut.
import { StyleSheet, Text, View } from 'react-native';

import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { aiBackLabel, aiChatHeaderHint, aiChatSettingsLabel, aiSetupTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { CHAT } from './chatTheme';

export interface ChatHeaderProps {
  topInset: number;
  onBack: () => void;
  onSettings: () => void;
}

export function ChatHeader({ topInset, onBack, onSettings }: ChatHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <View style={styles.row}>
        <IconButton label={aiBackLabel()} onPress={onBack} testID="chat-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">
            {aiSetupTitle()}
          </Text>
          <Text style={styles.hint}>{aiChatHeaderHint()}</Text>
        </View>
        <HeaderButton label={aiChatSettingsLabel()} icon="lock" onPress={onSettings} testID="chat-settings" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: MonoColors.bg, borderBottomWidth: 1, borderBottomColor: CHAT.barBorder, paddingHorizontal: 12 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  titles: { flex: 1, minWidth: 72 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  hint: { ...MonoText.caption, color: MonoColors.textMeta },
});
