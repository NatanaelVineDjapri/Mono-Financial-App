// How the score is calculated (board Analyze-How). Static: every weight, threshold and example comes from the
// same constants and the same formula the score uses (src/domain/health), so the page cannot say anything the
// score does not do.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { rp } from '@/core/money';
import {
  BAND_RANGES,
  BASE_WEIGHTS,
  COMPONENT_IDS,
  EMERGENCY_FULL_MONTHS,
  FIXED_FULL_BP,
  FIXED_ZERO_BP,
  MIN_SPAN_DAYS,
  MIN_TRANSACTIONS,
  SAVINGS_DROP_MAX,
  SAVINGS_DROP_STEP_BP,
  SAVINGS_FULL_BP,
  YOUNG_PERIOD_DAYS,
  type ComponentId,
} from '@/domain/health';
import { monthsText, pctWhole } from '@/features/analysis/copy';
import { EXAMPLE_INPUT, exampleComponents } from '@/features/analysis/howExample';
import { SectionHeader } from '@/features/analysis/sections';
import {
  analysisBand,
  analysisComponentName,
  analysisHowBack,
  analysisHowBudgetExample,
  analysisHowBudgetFormula,
  analysisHowDrop,
  analysisHowEmergencyFormula,
  analysisHowEmergencyRule,
  analysisHowEmergencyYoung,
  analysisHowFixedFormula,
  analysisHowFixedRule,
  analysisHowIntro,
  analysisHowNoteAdvice,
  analysisHowNoteMinimum,
  analysisHowNotePeriod,
  analysisHowNoteSkipped,
  analysisHowNoteTransfers,
  analysisHowPoints,
  analysisHowSavingsFormula,
  analysisHowSavingsRule,
  analysisHowSectionMeaning,
  analysisHowSectionNotes,
  analysisHowSectionParts,
  analysisHowTitle,
  analysisHowTotal,
  analysisHowWealthExample,
  analysisHowWealthFormula,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function lines(id: ComponentId): { formula: string; rule: string } {
  const c = exampleComponents().find(x => x.id === id)!;
  switch (id) {
    case 'savings':
      return { formula: analysisHowSavingsFormula(), rule: analysisHowSavingsRule(pctWhole(SAVINGS_FULL_BP)) };
    case 'budget':
      return {
        formula: analysisHowBudgetFormula(),
        rule: analysisHowBudgetExample(c.metric ?? 0, EXAMPLE_INPUT.budgets.length, pctWhole(c.ratioBp), c.max, c.points),
      };
    case 'emergency':
      return {
        formula: analysisHowEmergencyFormula(),
        rule: `${analysisHowEmergencyRule(EMERGENCY_FULL_MONTHS, rp(EXAMPLE_INPUT.balance), rp(EXAMPLE_INPUT.expense), monthsText(c.metric ?? 0, 2), pctWhole(c.ratioBp), c.max, c.points)} ${analysisHowEmergencyYoung(YOUNG_PERIOD_DAYS)}`,
      };
    case 'fixed':
      return { formula: analysisHowFixedFormula(), rule: analysisHowFixedRule(pctWhole(FIXED_FULL_BP), pctWhole(FIXED_ZERO_BP)) };
    case 'wealth':
      return {
        formula: analysisHowWealthFormula(),
        rule: analysisHowWealthExample(c.metric ?? 0, EXAMPLE_INPUT.netWorthSeries.length - 1, c.points),
      };
  }
}

export default function AnalysisHowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const total = COMPONENT_IDS.reduce((sum, id) => sum + BASE_WEIGHTS[id], 0);

  return (
    <View style={styles.screen} testID="analysis-how-screen">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={analysisHowBack()} hitSlop={4} android_ripple={undefined} style={styles.back} testID="analysis-how-back">
          <Icon name="chevron-left" color={MonoColors.text} />
          <Text style={styles.backText}>{analysisHowBack()}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">{analysisHowTitle()}</Text>
        <Text style={styles.intro}>{analysisHowIntro()}</Text>

        <SectionHeader title={analysisHowSectionParts()} sub={analysisHowTotal(total)} />
        <Card style={styles.card}>
          {COMPONENT_IDS.map((id, i) => {
            const text = lines(id);
            return (
              <View key={id} style={[styles.part, i > 0 && styles.divider]} testID={`analysis-how-${id}`}>
                <View style={styles.partTop}>
                  <Text style={styles.partName}>{analysisComponentName(id)}</Text>
                  <View style={styles.pointsChip}><Text style={styles.pointsText}>{analysisHowPoints(BASE_WEIGHTS[id])}</Text></View>
                </View>
                <Text style={styles.formula}>{text.formula}</Text>
                <Text style={styles.rule}>{text.rule}</Text>
              </View>
            );
          })}
        </Card>

        <SectionHeader title={analysisHowSectionMeaning()} />
        <Card style={styles.table} testID="analysis-how-bands">
          {BAND_RANGES.map(({ band, from, to }, i) => (
            <View key={band} style={[styles.bandRow, i > 0 && styles.divider]}>
              <Text style={styles.bandRange}>{from} – {to}</Text>
              <Text style={styles.bandName}>{analysisBand(band)}</Text>
            </View>
          ))}
        </Card>

        <SectionHeader title={analysisHowSectionNotes()} />
        <Card style={styles.card} testID="analysis-how-notes">
          {[
            analysisHowNotePeriod(),
            analysisHowNoteTransfers(),
            analysisHowNoteSkipped(),
            analysisHowDrop(SAVINGS_DROP_STEP_BP / 100, SAVINGS_DROP_MAX, YOUNG_PERIOD_DAYS),
            analysisHowNoteMinimum(MIN_TRANSACTIONS, MIN_SPAN_DAYS),
            analysisHowNoteAdvice(),
          ].map((text, i) => (
            <View key={i} style={[styles.note, i > 0 && styles.divider]}>
              <Icon name="info" size={18} color={MonoColors.text} />
              <Text style={styles.noteText}>{text}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  top: { paddingHorizontal: 12, paddingBottom: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  backText: { ...MonoText.body, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text, marginTop: 8, marginBottom: 8 },
  intro: { ...MonoText.body, fontSize: 14, lineHeight: 21, color: MonoColors.textSecond, paddingHorizontal: 4 },
  card: { padding: 0, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  part: { paddingHorizontal: 16, paddingVertical: 14 },
  partTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  partName: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text, flex: 1 },
  pointsChip: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.raised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pointsText: { ...MonoText.bodyStrong, fontSize: 12, lineHeight: 16, color: MonoColors.accent },
  formula: { ...MonoText.bodyS, color: MonoColors.textSecond, marginTop: 6, lineHeight: 19 },
  rule: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 4, lineHeight: 17 },
  table: { paddingVertical: 6, paddingHorizontal: 16 },
  bandRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  bandRange: { ...MonoText.bodyS, color: MonoColors.textSecond, width: 90 },
  bandName: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text, flex: 1, textAlign: 'right' },
  note: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
  noteText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1, lineHeight: 19 },
});
