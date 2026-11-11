// The assistant's non-draft messages (AI-Chat-States board). Every sentence comes from the
// result the app built (messages.ts); nothing here takes a word from the model.
//   clarify       a question and chips; one tap fills the draft locally
//   out_of_scope  the fixed sentence, example chips (they only fill the input), no warning icon
//   error         a system card: icon, bold lead, the way out
//   processing    three dots and "Menyiapkan draf…", with Batal
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { aiChatCancelRequest, aiChatProcessing, aiDraftCancelButton, aiMsgRecordAsExpense, aiRetryLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { ClarifyResult, ErrorResult, OutOfScopeResult } from '../chatStore';
import { AssistantBubble } from './Bubbles';
import { CHAT } from './chatTheme';

export interface ClarifyCardProps {
  result: ClarifyResult;
  live?: boolean;
  onChoose: (field: 'account' | 'category' | 'to_account', id: number) => void;
  onRecordAsExpense: (draftId: string) => void;
  onCancel: () => void;
}

export function ClarifyCard({ result, live, onChoose, onRecordAsExpense, onCancel }: ClarifyCardProps) {
  const { options, unknownTarget } = result;
  const askAccount = options.accounts.length > 0;
  return (
    <AssistantBubble text={result.question} live={live} testID="clarify-card">
      {askAccount && (
        <View style={styles.chips}>
          {options.accounts.map(a => (
            <Chip key={`a${a.id}`} label={a.name} selected={false} onPress={() => onChoose('account', a.id)} testID={`chip-account-${a.id}`} />
          ))}
        </View>
      )}
      {options.toAccounts.length > 0 && (
        <View style={styles.chips}>
          {options.toAccounts.map(a => (
            <Chip key={`t${a.id}`} label={a.name} selected={false} onPress={() => onChoose('to_account', a.id)} testID={`chip-to-account-${a.id}`} />
          ))}
        </View>
      )}
      {options.categories.length > 0 && (
        <View style={styles.chips}>
          {options.categories.map(c => (
            <Chip key={`c${c.id}`} label={c.name} selected={false} onPress={() => onChoose('category', c.id)} testID={`chip-category-${c.id}`} />
          ))}
        </View>
      )}
      {unknownTarget && (
        <View style={styles.choices}>
          <Button label={aiMsgRecordAsExpense()} onPress={() => onRecordAsExpense(unknownTarget.draftId)} style={styles.choice} testID="record-as-expense" />
          <Button label={aiDraftCancelButton()} variant="secondary" onPress={onCancel} style={styles.choice} testID="clarify-cancel" />
        </View>
      )}
    </AssistantBubble>
  );
}

export interface OutOfScopeCardProps {
  result: OutOfScopeResult;
  live?: boolean;
  onExample: (text: string) => void;
  onOpenAccounts: () => void;
}

export function OutOfScopeCard({ result, live, onExample, onOpenAccounts }: OutOfScopeCardProps) {
  return (
    <AssistantBubble text={result.text} live={live} testID="out-of-scope-card">
      {result.examples.length > 0 && (
        <View style={styles.chips}>
          {result.examples.map(example => (
            <Chip key={example} label={example} selected={false} onPress={() => onExample(example)} testID={`example-${example}`} />
          ))}
        </View>
      )}
      {result.action === 'open_accounts' && result.actionLabel && <Button label={result.actionLabel} variant="secondary" onPress={onOpenAccounts} testID="open-accounts" />}
    </AssistantBubble>
  );
}

export interface ErrorCardProps {
  result: ErrorResult;
  live?: boolean;
  onManual: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
}

// A failure says what happened, that nothing changed, and offers another way. The failed
// message is still in the input, so "Coba lagi" sends it again.
export function ErrorCard({ result, live, onManual, onOpenSettings, onRetry }: ErrorCardProps) {
  const retry = result.code === 'timeout' || result.code === 'generic';
  return (
    <View style={styles.errorRow} testID="error-card">
      <View style={styles.errorBox}>
        <View style={styles.errorHead} accessible accessibilityRole="alert" accessibilityLabel={`MONO: ${result.text}`} accessibilityLiveRegion={live ? 'polite' : 'none'}>
          <Icon name="alert" size={20} color={MonoColors.negative} />
          <Text style={styles.errorText}>
            <Text style={styles.errorTitle}>{result.title}</Text> {result.detail}
          </Text>
        </View>
        <View style={styles.choices}>
          {retry && <Button label={aiRetryLabel()} onPress={onRetry} style={styles.choice} testID="error-retry" />}
          {result.action === 'open_ai_settings' && result.actionLabel && <Button label={result.actionLabel} onPress={onOpenSettings} style={styles.choice} testID="error-open-settings" />}
          {result.action === 'manual' && result.actionLabel && (
            <Button label={result.actionLabel} variant={retry ? 'secondary' : 'primary'} onPress={onManual} style={styles.choice} testID="error-manual" />
          )}
        </View>
      </View>
    </View>
  );
}

function Dot({ index, reduceMotion }: { index: number; reduceMotion: boolean }) {
  const opacity = useSharedValue(reduceMotion ? 0.7 : 0.3);
  useEffect(() => {
    if (reduceMotion) {
      opacity.set(0.7);
      return undefined;
    }
    opacity.set(withDelay(index * 160, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.3, { duration: 360 })), -1)));
    return () => cancelAnimation(opacity);
  }, [index, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function ProcessingBubble({ onCancel }: { onCancel: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <AssistantBubble testID="processing-bubble">
      <View style={styles.processing} accessible accessibilityLiveRegion="polite" accessibilityLabel={`MONO: ${aiChatProcessing()}`}>
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <Dot key={i} index={i} reduceMotion={reduceMotion} />
          ))}
        </View>
        <Text style={styles.processingText}>{aiChatProcessing()}</Text>
      </View>
      <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={aiChatCancelRequest()} style={styles.cancel} hitSlop={4} testID="processing-cancel">
        <Text style={styles.cancelText}>{aiChatCancelRequest()}</Text>
      </Pressable>
    </AssistantBubble>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1 },
  errorRow: { paddingLeft: 40 },
  errorBox: { backgroundColor: CHAT.assistantFill, borderWidth: 1.5, borderColor: CHAT.errorBorder, borderRadius: 16, padding: 14, gap: 12 },
  errorHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorText: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  errorTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MonoColors.textSecond },
  processingText: { ...MonoText.body, color: MonoColors.textSecond },
  cancel: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  cancelText: { ...MonoText.bodyStrong, color: MonoColors.textSecond, textDecorationLine: 'underline' },
});
