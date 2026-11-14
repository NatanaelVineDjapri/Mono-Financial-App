// The Reports range selector (PAGES.md H · Reports): Month / 3 months / 6 months / Year,
// with the selected option as a light pill. Unlike the shared Segmented control, this one
// is a single row of four labels whose active state is the design board's white pill.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import {
  reportsRange3Months,
  reportsRange6Months,
  reportsRangeMonth,
  reportsRangeYear,
} from '@/i18n';

import type { ReportRange } from '@/domain/reports';

const RANGES: { value: ReportRange; label: () => string }[] = [
  { value: 'month', label: reportsRangeMonth },
  { value: '3m', label: reportsRange3Months },
  { value: '6m', label: reportsRange6Months },
  { value: 'year', label: reportsRangeYear },
];

export function RangeSelector({ value, onChange }: { value: ReportRange; onChange: (range: ReportRange) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="reports-range">
      {RANGES.map(range => {
        const selected = range.value === value;
        return (
          <Pressable
            key={range.value}
            onPress={() => onChange(range.value)}
            accessibilityRole="radio"
            accessibilityLabel={range.label()}
            accessibilityState={{ selected }}
            android_ripple={undefined}
            style={[styles.segment, selected && styles.selected]}
            testID={`reports-range-${range.value}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{range.label()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: MonoColors.card,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  selected: { backgroundColor: MonoColors.text },
  label: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.textSecond, textAlign: 'center' },
  labelSelected: { color: MonoColors.bg },
});
