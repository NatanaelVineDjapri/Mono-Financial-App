// The two kinds of message (AI-Chat board). The person's: solid light, dark text, radius
// 16/16/4/16, at most 80% of the width, on the right. The assistant's: the mascot's avatar and a
// card (#151516, 1px #272728, radius 16/16/16/4), on the left. A bubble that is only text is one
// text element for TalkBack ("Kamu: …" / "MONO: …"); an assistant bubble with buttons inside keeps
// them separately reachable.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { aiChatAssistantLabel, aiChatYouLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AVATAR_SIZE, BUBBLE_MAX_WIDTH, CHAT } from './chatTheme';
import { MascotAvatar } from './MascotAvatar';

export function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText} accessibilityRole="text" accessibilityLabel={aiChatYouLabel(text)}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export interface AssistantBubbleProps {
  // The words of the bubble, when it has any: they are what TalkBack reads, prefixed "MONO: ".
  text?: string;
  children?: ReactNode;
  live?: boolean; // announce this bubble when it appears (the newest reply)
  testID?: string;
}

export function AssistantBubble({ text, children, live = false, testID }: AssistantBubbleProps) {
  return (
    <View style={styles.assistantRow} testID={testID}>
      <MascotAvatar size={AVATAR_SIZE} />
      <View style={styles.assistantBubble}>
        {!!text && (
          <Text
            style={styles.assistantText}
            accessibilityRole="text"
            accessibilityLabel={aiChatAssistantLabel(text)}
            accessibilityLiveRegion={live ? 'polite' : 'none'}
          >
            {text}
          </Text>
        )}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    backgroundColor: CHAT.userFill,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { ...MonoText.body, color: CHAT.userText },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 24 },
  assistantBubble: {
    flexShrink: 1,
    flexGrow: 0,
    backgroundColor: CHAT.assistantFill,
    borderWidth: 1,
    borderColor: CHAT.assistantBorder,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  assistantText: { ...MonoText.body, color: MonoColors.text },
});
