// Account balance trend (Account-Detail): the balance, its change over the range as a chip (green with a plus and an up
// triangle when it rose, red with a minus and a down triangle when it fell), a Month / 6 months / Year / All pill, and the
// balance line drawn like the Overview's net cash flow chart (src/components/LineAreaChart). Touch the chart to read the
// balance and the change on a day.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { LineAreaChart } from '@/components/LineAreaChart';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { axisLabel, labelIndexes, millionsCallout, niceRange } from '@/core/chartScale';
import { formatDayMonth, formatShortDate, monthAbbrev } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { AccountChartRange, AccountDetail } from '@/domain/accountDetail';
import { CHIP_FILL_NEGATIVE, CHIP_FILL_POSITIVE } from '@/features/overview/palette';
import { Triangle } from '@/features/overview/parts';
import {
  accountChangeVsLabel,
  accountChartAccessibilityLabel,
  accountKindCaption,
  accountTypeName,
  rangeAllLabel,
  rangeOneMonthLabel,
  rangeOneYearLabel,
  rangeSixMonthsLabel,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { useAccountBalanceHistory } from './useAccountDetail';

const X_LABELS_MAX = 4;

const RANGES: { key: AccountChartRange; label: () => string }[] = [
  { key: '1M', label: rangeOneMonthLabel },
  { key: '6M', label: rangeSixMonthsLabel },
  { key: '1Y', label: rangeOneYearLabel },
  { key: 'All', label: rangeAllLabel },
];

export interface AccountBalanceChartProps {
  detail: AccountDetail;
}

// What the x axis says under a point: the day for a month, the month for six months and a year, and the
// month with its year when the range is everything.
function xLabel(range: AccountChartRange, date: string): string {
  if (range === '1M') return formatDayMonth(date);
  const month = monthAbbrev(date.slice(0, 7));
  return range === 'All' ? `${month} ${date.slice(2, 4)}` : month;
}

// A y axis label: millions once the axis reaches Rp1 million ("1,2 jt"), thousands below it ("280k").
function yLabel(value: number, top: number): string {
  if (value === 0) return '0';
  return top >= 1_000_000 ? millionsCallout(value) : axisLabel(value, top);
}

export function AccountBalanceChart({ detail }: AccountBalanceChartProps) {
  'use no memo';
  const [range, setRange] = useState<AccountChartRange>('1M');
  const historyQuery = useAccountBalanceHistory(detail.id, range);
  const history = historyQuery?.data;
  const hidden = useHideAmounts(s => s.hidden);
  // While another range is loading, the previous range's line stays on screen (dimmed) instead of the chart emptying out.
  // What is drawn (the dates under the axis, the "vs last month" text) follows the range the data belongs to, which
  // only changes once the new data is there.
  const stale = historyQuery?.isPlaceholderData === true;
  const [shownRange, setShownRange] = useState<AccountChartRange>(range);
  if (history != null && !stale && shownRange !== range) setShownRange(range); // adjusted while rendering, not in an effect

  const changeAmount = history?.changeAmount ?? 0;
  const rose = changeAmount > 0;
  const fell = changeAmount < 0;
  const deltaTone = rose ? MonoColors.positive : fell ? MonoColors.negative : MonoColors.textSecond;
  const deltaAmountFormatted = shown(rp(changeAmount, true), hidden);
  const deltaPctFormatted = history?.changeBp != null ? shownPct(pct(history.changeBp, true), hidden) : null;
  const deltaText = deltaPctFormatted ? `${deltaAmountFormatted} (${deltaPctFormatted})` : deltaAmountFormatted;

  const points = history?.points ?? [];
  // The y axis follows the balance, not zero: a balance that moves by a few percent would be a flat line on a
  // 0..max axis. The labels say the real amounts.
  const values = points.map(p => p.value);
  const axis = values.length > 0 ? niceRange(Math.min(...values), Math.max(...values)) : niceRange(0, 0);

  const first = points[0];
  const last = points[points.length - 1];
  const chartLabel =
    first && last
      ? accountChartAccessibilityLabel(
          formatShortDate(first.date),
          formatShortDate(last.date),
          shown(rp(first.value), hidden),
          shown(rp(last.value), hidden),
          shown(rp(Math.min(...values)), hidden),
          shown(rp(Math.max(...values)), hidden),
        )
      : '';

  const hasChart = history != null && points.length >= 2;
  // The range pill is part of the chart's card (under the plot), so the chart and its controls read as one block.
  const rangePill = (
    <View style={styles.rangeTabs} accessibilityRole="radiogroup" testID="account-range">
      {RANGES.map(r => {
        const selected = r.key === range;
        return (
          <Pressable
            key={r.key}
            onPress={() => setRange(r.key)}
            accessibilityRole="radio"
            accessibilityLabel={r.label()}
            accessibilityState={{ selected }}
            android_ripple={undefined}
            style={({ pressed }) => [styles.rangeTab, selected && styles.rangeTabSelected, pressed && !selected && styles.pressed]}
            testID={`account-range-${r.key}`}
          >
            <Text style={[styles.rangeTabText, selected && styles.rangeTabTextSelected]}>{r.label()}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container} testID="account-hero">
      <Text style={styles.caption}>{accountKindCaption(accountTypeName(detail.type))}</Text>
      <Amount value={detail.balance} variant="displayS" testID="account-balance" />

      {history != null && (
        <View style={[styles.deltaRow, stale && styles.stale]} testID="account-hero-delta">
          <View style={[styles.chip, { backgroundColor: rose ? CHIP_FILL_POSITIVE : fell ? CHIP_FILL_NEGATIVE : MonoColors.surface }]}>
            {(rose || fell) && <Triangle up={rose} color={deltaTone} />}
            <Text style={[styles.chipText, { color: deltaTone }]}>{deltaText}</Text>
          </View>
          <Text style={styles.vsText}>{accountChangeVsLabel(shownRange)}</Text>
        </View>
      )}

      {hasChart && (
        <LineAreaChart
          footer={rangePill}
          dimmed={stale}
          values={values}
          axis={axis}
          yLabel={tick => yLabel(tick, axis.high)}
          xLabelIndexes={labelIndexes(points.length, X_LABELS_MAX)}
          xLabel={index => xLabel(shownRange, points[index].date)}
          hideYLabels={hidden}
          accessibilityLabel={chartLabel}
          testID="account-chart"
          renderTooltip={index => {
            const point = points[index];
            const delta = point.delta ?? 0;
            const tone = delta === 0 ? MonoColors.textSecond : delta > 0 ? MonoColors.positive : MonoColors.negative;
            const pctText = point.deltaPctBp != null ? shownPct(pct(point.deltaPctBp, true), hidden) : null;
            const deltaLine = `${shown(rp(delta, true), hidden)}${pctText ? ` (${pctText})` : ''}`;
            return (
              <>
                <Text style={styles.tooltipDate}>{formatShortDate(point.date)}</Text>
                <View style={styles.tooltipRow}>
                  <View style={styles.tooltipDot} />
                  <Text style={styles.tooltipAmount}>{shown(rp(point.value), hidden)}</Text>
                </View>
                {point.delta != null && <Text style={[styles.tooltipDelta, { color: tone }]}>{deltaLine}</Text>}
              </>
            );
          }}
        />
      )}

      {/* No chart yet (fewer than two points): the range pill still shows, in a card of its own. */}
      {!hasChart && <View style={styles.pillCard}>{rangePill}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  caption: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { ...MonoText.chip },
  vsText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  rangeTabs: {
    flexDirection: 'row',
    minHeight: 44,
    padding: 4,
    borderRadius: 22,
    backgroundColor: MonoColors.card,
    borderWidth: 1,
    borderColor: MonoColors.border,
  },
  pillCard: { backgroundColor: MonoColors.surface, borderRadius: radius.lg, padding: 20 },
  rangeTab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  rangeTabSelected: { backgroundColor: MonoColors.text },
  rangeTabText: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  rangeTabTextSelected: { color: MonoColors.bg },
  pressed: { opacity: 0.7 },
  stale: { opacity: 0.5 },
  tooltipDate: { ...MonoText.caption, color: MonoColors.textSecond },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MonoColors.accent },
  tooltipAmount: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  tooltipDelta: { ...MonoText.caption, fontFamily: MonoText.bodyStrong.fontFamily },
});
