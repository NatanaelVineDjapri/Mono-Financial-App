// The bar at the bottom of the chat (AI-Chat board): suggestion chips (they only FILL the box,
// they never send), the 48-high text box (radius 16, up to 4 lines, 500 characters, a counter from
// 400), the 48 send button, and the standing note. Send is off while the box is empty, over the
// limit, or a request is running; the text stays in the box while it runs.
import type { ComponentRef, RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { aiChatCounter, aiChatFooterWarning, aiChatInputPlaceholder, aiChatSendLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { MAX_CHARS } from '../config';
import { CHAT } from './chatTheme';

export const COUNTER_FROM = 400;
const INPUT_HEIGHT = 48;
const LINE_HEIGHT = 22;
const MAX_LINES = 4;

export function canSend(value: string, processing: boolean): boolean {
  return !processing && value.trim().length > 0 && value.length <= MAX_CHARS;
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  processing: boolean;
  suggestions: string[];
  onPickSuggestion: (text: string) => void;
  inputRef?: RefObject<ComponentRef<typeof TextInput> | null>;
  bottomInset?: number;
}

export function Composer({ value, onChange, onSend, processing, suggestions, onPickSuggestion, inputRef, bottomInset = 0 }: ComposerProps) {
  const sendEnabled = canSend(value, processing);
  return (
    <View style={[styles.bar, { paddingBottom: 10 + bottomInset }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions} testID="suggestions">
        {suggestions.map(text => (
          <Chip key={text} label={text} selected={false} onPress={() => onPickSuggestion(text)} />
        ))}
      </ScrollView>

      {value.length > COUNTER_FROM && (
        <Text style={styles.counter} accessibilityLiveRegion="polite" testID="char-counter">
          {aiChatCounter(value.length, MAX_CHARS)}
        </Text>
      )}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={aiChatInputPlaceholder()}
          placeholderTextColor={MonoColors.textDisabled}
          multiline
          maxLength={MAX_CHARS}
          style={styles.input}
          accessibilityLabel={aiChatInputPlaceholder()}
          textAlignVertical="center"
          testID="chat-input"
        />
        <Pressable
          onPress={sendEnabled ? onSend : undefined}
          disabled={!sendEnabled}
          accessibilityRole="button"
          accessibilityLabel={aiChatSendLabel()}
          accessibilityState={{ disabled: !sendEnabled, busy: processing }}
          android_ripple={undefined}
          style={[styles.send, !sendEnabled && styles.sendOff]}
          testID="chat-send"
        >
          <Icon name="arrow-up" size={22} color={MonoColors.bg} />
        </Pressable>
      </View>
      <Text style={styles.note}>{aiChatFooterWarning()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: MonoColors.bg, borderTopWidth: 1, borderTopColor: CHAT.barBorder, paddingTop: 10, gap: 8 },
  suggestions: { paddingHorizontal: 16, gap: 8 },
  counter: { ...MonoText.caption, color: MonoColors.textMeta, alignSelf: 'flex-end', paddingHorizontal: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16 },
  input: {
    flex: 1,
    minHeight: INPUT_HEIGHT,
    maxHeight: LINE_HEIGHT * MAX_LINES + 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    color: MonoColors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...MonoText.body,
    lineHeight: LINE_HEIGHT,
  },
  send: { width: INPUT_HEIGHT, height: INPUT_HEIGHT, borderRadius: 16, backgroundColor: MonoColors.text, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  note: { ...MonoText.caption, color: MonoColors.textMeta, paddingHorizontal: 16 },
});
