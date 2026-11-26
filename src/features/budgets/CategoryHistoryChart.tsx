// Budget-Category's four-month bar chart (DESIGN.md "F. Budgets" Category review,
// PAGES.md F3): `history` is four periods, oldest first, this month last, each against
// `limit` — the category's *current* monthly limit, used as one constant reference for
// every bar (there is no historical per-month limit to compare against instead). A bar
// whose spend is over that limit draws in `negative`, with its value label bold and
// red; every other bar is the silver series colour with a neutral label. The dashed line is built from
// plain Views, not a native dashed border (Android's support for `borderStyle: 'dashed'`
// is unreliable) or Skia (this is a straight line; a Canvas would be overkill) — a row of
// fixed-width dashes, generous enough to outrun any phone width, clipped by the
// container exactly like ProgressBar.tsx's own striped overflow.
//
// The bars are decorative: wrapped in one accessible node with a sentence covering every
// month's exact amount and the limit (`categoryHistoryAccessibilityLabel`), same pattern as
// ProgressBar's own track. Under the bars there are only the month names: the owner chose to
// drop the exact-value table here (an exception to CLAUDE.md rule 7), since every bar already
// carries its amount above it.
import { StyleSheet, Text, View } from 'react-native';

import { monthAbbrev } from '@/core/date';
import { rp, rpCompact, shown } from '@/core/money';
import type { CategoryMonthSpend } from '@/domain/budget';
import { categoryHistoryAccessibilityLabel, dashedEqualsLimitLabel, lastFourMonthsLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const CHART_HEIGHT = 140;
const LABEL_ROW_HEIGHT = 20; // room for one caption-sized value label above a bar
const BAR_MAX_HEIGHT = CHART_HEIGHT - LABEL_ROW_HEIGHT;
const BAR_WIDTH = 32;
const DASH_WIDTH = 5;
const DASH_GAP = 4;
const DASH_COUNT = 60; // guessed: wider than any phone screen, so the row always clips rather than running out of dashes

export interface CategoryHistoryChartProps {
  history: CategoryMonthSpend[]; // exactly 4, oldest first
  limit: number;
  hidden: boolean;
  testID?: string;
}

function DashedLine() {
  return (
    <View style={styles.dashRow} pointerEvents="none">
      {Array.from({ length: DASH_COUNT }, (_, i) => <View key={i} style={styles.dash} />)}
    </View>
  );
}

// Every bar with any spend gets its own compact value label above it (not only the ones
// closest to the limit) — simpler than a "close enough to the limit" threshold, never
// ambiguous, and the accessibility label states every figure exactly regardless.
function Bar({ entry, limit, maxValue, hidden }: { entry: CategoryMonthSpend; limit: number; maxValue: number; hidden: boolean }) {
  const isOver = entry.spent > limit;
  const barHeight = maxValue > 0 ? Math.round((entry.spent / maxValue) * BAR_MAX_HEIGHT) : 0;
  return (
    <View style={styles.column}>
      {entry.spent > 0 && <Text style={[styles.barLabel, isOver && styles.barLabelOver]}>{shown(rpCompact(entry.spent), hidden)}</Text>}
      <View style={[styles.bar, isOver && styles.barOver, { height: Math.max(barHeight, 2) }]} />
    </View>
  );
}

export function CategoryHistoryChart({ history, limit, hidden, testID }: CategoryHistoryChartProps) {
  const maxValue = Math.max(limit, ...history.map(h => h.spent), 1);
  const limitFromBottom = Math.min((limit / maxValue) * BAR_MAX_HEIGHT, BAR_MAX_HEIGHT);
  const monthsFormatted = history.map(h => `${monthAbbrev(h.period)} ${shown(rp(h.spent), hidden)}`).join(', ');

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>{lastFourMonthsLabel()}</Text>
        <Text style={styles.caption}>{dashedEqualsLimitLabel()}</Text>
      </View>

      <View style={styles.plot}>
        {/* The dashed line is placed from this box's floor, which is the bars' floor: the month names stay outside it. */}
        <View
          style={styles.chart}
          accessible
          accessibilityRole="image"
          accessibilityLabel={categoryHistoryAccessibilityLabel(monthsFormatted, shown(rp(limit), hidden))}
        >
          <View style={[styles.dashWrap, { bottom: limitFromBottom }]} testID="category-history-limit">
            <DashedLine />
          </View>
          <View style={styles.bars}>
            {history.map(entry => (
              <Bar key={entry.period} entry={entry} limit={limit} maxValue={maxValue} hidden={hidden} />
            ))}
          </View>
        </View>

        <View style={styles.months}>
          {history.map(entry => (
            <Text key={entry.period} style={styles.month}>{monthAbbrev(entry.period)}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: MonoColors.card, borderRadius: radius.lg, paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textSecond },

  plot: { gap: 8 },
  chart: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  dashWrap: { position: 'absolute', left: 0, right: 0, height: 1, overflow: 'hidden' },
  dashRow: { flexDirection: 'row', gap: DASH_GAP },
  dash: { width: DASH_WIDTH, height: 1, backgroundColor: MonoColors.textDisabled },

  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT },
  column: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  barLabel: { ...MonoText.caption, color: MonoColors.textSecond },
  barLabelOver: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.negative },
  bar: { width: BAR_WIDTH, backgroundColor: MonoColors.accent, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  barOver: { backgroundColor: MonoColors.negative },

  months: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: MonoColors.border },
  month: { ...MonoText.caption, flex: 1, textAlign: 'center', color: MonoColors.textSecond },
});
