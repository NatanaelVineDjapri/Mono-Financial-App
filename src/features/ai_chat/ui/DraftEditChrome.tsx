// The two pieces the edit-one-by-one screen adds around the transaction form (AI-Draft-Edit board):
// "1 dari 2" with a progress segment per draft, and the quote of the person's own message in a
// dashed card, so they can see what the assistant was reading.
import { StyleSheet, Text, View } from 'react-native';

import { aiEditFromMessage, aiEditProgress } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { CHAT, DRAFT_BORDER_WIDTH } from './chatTheme';

export function DraftProgressText({ index, total }: { index: number; total: number }) {
  return (
    <Text style={styles.progressText} accessibilityLiveRegion="polite" testID="draft-progress-text">
      {aiEditProgress(index + 1, total)}
    </Text>
  );
}

// One segment per draft: filled up to and including the one being edited.
export function DraftProgressBar({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.segments} accessible accessibilityRole="progressbar" accessibilityLabel={aiEditProgress(index + 1, total)} accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, i <= index && styles.segmentOn]} testID={i <= index ? 'segment-on' : 'segment-off'} />
      ))}
    </View>
  );
}

export function SourceQuote({ text }: { text: string }) {
  return (
    <View style={styles.quote} testID="source-quote">
      <Text style={styles.quoteLabel}>{aiEditFromMessage()}</Text>
      <Text style={styles.quoteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progressText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: MonoColors.raised },
  segmentOn: { backgroundColor: MonoColors.text },
  quote: { backgroundColor: CHAT.draftFill, borderWidth: DRAFT_BORDER_WIDTH, borderColor: CHAT.draftBorder, borderStyle: 'dashed', borderRadius: 16, padding: 14, gap: 4 },
  quoteLabel: { ...MonoText.label, color: MonoColors.textMeta },
  quoteText: { ...MonoText.body, color: MonoColors.text },
});
