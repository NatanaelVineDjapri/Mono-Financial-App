// "Top categories": the Transactions ring at 140 (stroke 16, round caps, gap 5) with the
// largest category's share in the centre, a legend with each share (largest-remainder,
// one decimal, same buckets as Reports), and an "Amounts" link to /reports. Colours: the
// largest gold, then #A3A3A3, #737373, #525252, Others #3A3A3A. Hidden mode masks the
// shares and every amount, in the legend, the centre and the accessibility label.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { RingChart, type RingSegment } from '@/components/RingChart';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { pct1, rp, shown, shownPct } from '@/core/money';
import type { ShareRow } from '@/domain/overview';
import {
  amountsLinkLabel,
  legendValueText,
  noSpendingThisMonthMessage,
  othersCategoryLabel,
  topCategoriesRingAccessibilityLabel,
  topCategoriesTitle,
} from '@/i18n/id';
import { CHART_CATEGORY_COLORS, MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const RING = 140;
const STROKE = 16;

export interface TopCategoriesCardProps {
  shares: ShareRow[];
  onOpenReports: () => void;
}

function nameOf(share: ShareRow): string {
  return share.id === -1 ? othersCategoryLabel() : share.label;
}

export function TopCategoriesCard({ shares, onOpenReports }: TopCategoriesCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const colorOf = (index: number) => CHART_CATEGORY_COLORS[Math.min(index, CHART_CATEGORY_COLORS.length - 1)];
  const segments: RingSegment[] = shares.map((s, i) => ({ id: s.id, label: nameOf(s), valueIdr: s.amount, color: colorOf(i) }));
  const largest = shares[0];
  const percentText = (permille: number) => shownPct(pct1(permille), hidden);
  const valuesText = shares
    .map(s => `${legendValueText(nameOf(s), percentText(s.sharePermille))}, ${shown(rp(s.amount), hidden)}`)
    .join('; ');

  return (
    <Card style={styles.card} testID="overview-top-categories">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {topCategoriesTitle()}
        </Text>
        <Pressable onPress={onOpenReports} accessibilityRole="button" accessibilityLabel={amountsLinkLabel()} hitSlop={8} style={styles.link}>
          <Text style={styles.linkText}>{amountsLinkLabel()}</Text>
        </Pressable>
      </View>

      {!largest ? (
        <Text style={styles.empty}>{noSpendingThisMonthMessage()}</Text>
      ) : (
        <View style={styles.body}>
          <RingChart
            segments={segments}
            size={RING}
            strokeWidth={STROKE}
            centerLabel={nameOf(largest)}
            centerValue={percentText(largest.sharePermille)}
            centerValueSize={22}
            accessibilityLabel={topCategoriesRingAccessibilityLabel(valuesText)}
            testID="overview-top-ring"
          />
          <View style={styles.legend} testID="overview-top-legend">
            {shares.map((s, i) => (
              <View key={s.id} style={styles.legendRow} accessible accessibilityLabel={`${legendValueText(nameOf(s), percentText(s.sharePermille))}, ${shown(rp(s.amount), hidden)}`}>
                <View style={[styles.dot, { backgroundColor: colorOf(i) }]} />
                <Text style={styles.legendName}>{nameOf(s)}</Text>
                <Text style={styles.legendPercent}>{percentText(s.sharePermille)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text, flexShrink: 1 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  // Wraps below the ring at large text sizes instead of squeezing the legend.
  body: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 12 },
  legend: { flex: 1, minWidth: 140, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  legendPercent: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
