// The "AI analysis" card of the Analysis screen. Words written by Gemini are always marked "Written by AI", sit
// in their own card apart from the score and its formula-written sentences, and can be wrong: the footer says so.
// Nothing here can change a number: the review is only text. Red is not used; errors are plain calm sentences
// written by the app (src/features/ai_chat/messages.ts), never the model's words.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { errorMessage } from '@/features/ai_chat/messages';
import {
  analysisAiAllow,
  analysisAiA11y,
  analysisAiConsentAuto,
  analysisAiConsentNotSent,
  analysisAiConsentSent,
  analysisAiConsentTitle,
  analysisAiFooter,
  analysisAiLater,
  analysisAiLoading,
  analysisAiRegenerate,
  analysisAiSettings,
  analysisAiSetupBody,
  analysisAiSetupButton,
  analysisAiTag,
  analysisAiTipsLabel,
  analysisAiTitle,
  analysisAiTurnOff,
  analysisRetry,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { AiAnalysisState } from './useAiAnalysis';

export interface AiAnalysisCardProps {
  state: AiAnalysisState;
  onSetup: () => void;
  onAllow: () => void;
  onNotNow: () => void;
  onTurnOff: () => void;
  onRetry: () => void;
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Icon name="spark" size={20} color={MonoColors.accent} />
        <Text style={styles.title} accessibilityRole="header">{analysisAiTitle()}</Text>
      </View>
      <View style={styles.tag}><Text style={styles.tagText}>{analysisAiTag()}</Text></View>
    </View>
  );
}

function TextLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={undefined} style={styles.link} testID={testID}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function AiAnalysisCard({ state, onSetup, onAllow, onNotNow, onTurnOff, onRetry }: AiAnalysisCardProps) {
  if (state.kind === 'hidden') return null;

  return (
    <Card style={styles.card} testID="analysis-ai" accessibilityLabel={analysisAiA11y(analysisAiTitle())}>
      <Header />

      {state.kind === 'setup' && (
        <>
          <Text style={styles.body}>{analysisAiSetupBody()}</Text>
          <Button label={analysisAiSetupButton()} variant="secondary" onPress={onSetup} testID="analysis-ai-setup" />
        </>
      )}

      {state.kind === 'consent' && (
        <View style={styles.stack} testID="analysis-ai-consent">
          <Text style={styles.subtitle}>{analysisAiConsentTitle()}</Text>
          <Text style={styles.body}>{analysisAiConsentSent()}</Text>
          <Text style={styles.body}>{analysisAiConsentNotSent()}</Text>
          <Text style={styles.body}>{analysisAiConsentAuto()}</Text>
          <View style={styles.buttons}>
            <Button label={analysisAiLater()} variant="secondary" onPress={onNotNow} style={styles.flex} testID="analysis-ai-later" />
            <Button label={analysisAiAllow()} onPress={onAllow} style={styles.flex} testID="analysis-ai-allow" />
          </View>
        </View>
      )}

      {state.kind === 'loading' && (
        <View style={styles.loading} testID="analysis-ai-loading">
          <ActivityIndicator color={MonoColors.textSecond} />
          <Text style={styles.body}>{analysisAiLoading()}</Text>
        </View>
      )}

      {state.kind === 'error' && (() => {
        const message = errorMessage(state.code);
        return (
          <View style={styles.stack} testID="analysis-ai-error">
            <Text style={styles.body}>{message.text}</Text>
            <View style={styles.buttons}>
              {state.code === 'key_rejected' ? (
                <Button label={analysisAiSettings()} variant="secondary" onPress={onSetup} style={styles.flex} />
              ) : (
                <Button label={analysisRetry()} variant="secondary" onPress={onRetry} style={styles.flex} testID="analysis-ai-retry" />
              )}
            </View>
          </View>
        );
      })()}

      {state.kind === 'ready' && (
        <View style={styles.stack} testID="analysis-ai-ready">
          <Text style={styles.summary} testID="analysis-ai-summary">{state.result.summary}</Text>
          {state.result.findings.map((f, i) => (
            <View key={i} style={styles.finding} testID={`analysis-ai-finding-${i}`}>
              <Text style={styles.findingTitle}>{f.title}</Text>
              <Text style={styles.body}>{f.body}</Text>
            </View>
          ))}
          {state.result.tips.length > 0 && (
            <View style={styles.finding} testID="analysis-ai-tips">
              <Text style={styles.findingTitle}>{analysisAiTipsLabel()}</Text>
              {state.result.tips.map((tip, i) => (
                <Text key={i} style={styles.body}>{`• ${tip}`}</Text>
              ))}
            </View>
          )}
          <Text style={styles.footer}>{analysisAiFooter()}</Text>
          <View style={styles.links}>
            <TextLink label={analysisAiRegenerate()} onPress={onRetry} testID="analysis-ai-regenerate" />
            <TextLink label={analysisAiTurnOff()} onPress={onTurnOff} testID="analysis-ai-turn-off" />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  tag: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.raised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { ...MonoText.caption, color: MonoColors.textSecond },
  stack: { gap: 12 },
  subtitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  body: { ...MonoText.bodyS, color: MonoColors.textSecond, lineHeight: 20 },
  summary: { ...MonoText.body, color: MonoColors.text, lineHeight: 23 },
  finding: { gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: MonoColors.border },
  findingTitle: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text },
  footer: { ...MonoText.caption, color: MonoColors.textMeta, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...MonoText.bodyS, color: MonoColors.text, textDecorationLine: 'underline' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  buttons: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
