// Account balance trend chart with delta comparison and scrub tooltip.
// Shows the balance over time (1M, 6M, 1Y, All) with interactive pointer.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Amount } from '@/components/Amount';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { axisLabel, labelIndexes, millionsCallout, niceRange } from '@/core/chartScale';
import { formatDayMonth, formatShortDate, monthAbbrev } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { AccountChartRange, AccountDetail } from '@/domain/accountDetail';
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
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { useAccountBalanceHistory } from './useAccountDetail';

const PAD_X = 8;
const CHART_HEIGHT = 140;
const Y_LABEL_WIDTH = 46; // the gutter for the y axis labels
const X_LABEL_WIDTH = 52;
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
  const [wrapWidth, setWrapWidth] = useState(0);

  const changeAmount = history?.changeAmount ?? 0;
  const deltaTone = changeAmount === 0 ? MonoColors.textSecond : changeAmount > 0 ? MonoColors.positive : MonoColors.negative;
  const deltaAmountFormatted = shown(rp(changeAmount, true), hidden);
  const deltaPctFormatted = history?.changeBp != null ? shownPct(pct(history.changeBp, true), hidden) : null;
  const deltaText = deltaPctFormatted ? `${deltaAmountFormatted} (${deltaPctFormatted})` : deltaAmountFormatted;

  const points = history?.points ?? [];
  // The y axis follows the balance, not zero: a balance that moves by a few percent would be a flat line on a
  // 0..max axis. The data is drawn relative to the axis' lowest line, and the labels say the real amounts.
  const values = points.map(p => p.value);
  const yRange = values.length > 0 ? niceRange(Math.min(...values), Math.max(...values)) : niceRange(0, 0);
  const yWidth = hidden ? 0 : Y_LABEL_WIDTH;
  const plotWidth = Math.max(160, wrapWidth - yWidth);
  const spacing = points.length > 1 ? (plotWidth - PAD_X * 2) / (points.length - 1) : 120;
  const xIndexes = labelIndexes(points.length, X_LABELS_MAX);

  const lineData = points.map(p => ({
    value: p.value - yRange.low,
    raw: p.value,
    date: p.date,
    delta: p.delta,
    deltaPctBp: p.deltaPctBp,
    dataPointRadius: 0,
    hideDataPoint: true,
  }));

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

  return (
    <View style={styles.container} testID="account-hero">
      <Text style={styles.caption}>{accountKindCaption(accountTypeName(detail.type))}</Text>
      <Amount value={detail.balance} variant="displayS" testID="account-balance" />

      {history != null && (
        <View style={styles.deltaRow} testID="account-hero-delta">
          <Text style={[styles.deltaText, { color: deltaTone }]}>{deltaText}</Text>
          <Text style={styles.vsText}>{accountChangeVsLabel(range)}</Text>
        </View>
      )}

      <View style={styles.rangeRow} accessibilityRole="tablist">
        {RANGES.map(r => {
          const selected = r.key === range;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              accessibilityRole="tab"
              accessibilityLabel={r.label()}
              accessibilityState={{ selected }}
              android_ripple={undefined}
              style={styles.rangeButton}
              testID={`account-range-${r.key}`}
            >
              <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{r.label()}</Text>
              {selected && <View style={styles.rangeUnderline} />}
            </Pressable>
          );
        })}
      </View>

      {history != null && points.length >= 2 && (
        <View
          style={styles.chartWrapper}
          testID="account-chart"
          accessible
          accessibilityRole="image"
          accessibilityLabel={chartLabel}
          onLayout={e => setWrapWidth(Math.round(e.nativeEvent.layout.width))}
        >
          {wrapWidth > 0 && (
          <LineChart
            data={lineData}
            interpolateMissingValues={false}
            height={CHART_HEIGHT}
            width={plotWidth}
            spacing={spacing}
            initialSpacing={PAD_X}
            endSpacing={PAD_X}
            color={MonoColors.accent}
            thickness={2.5}
            startFillColor="transparent"
            startOpacity={0}
            endOpacity={0}
            hideDataPoints={true}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={MonoColors.border}
            hideRules={false}
            rulesColor={MonoColors.border}
            rulesType="solid"
            noOfSections={yRange.ticks.length - 1}
            yAxisLabelTexts={yRange.ticks.map(t => yLabel(t, yRange.high))}
            yAxisLabelWidth={yWidth}
            yAxisTextStyle={{ ...MonoText.caption, color: MonoColors.textMeta }}
            maxValue={yRange.high - yRange.low}
            hideYAxisText={hidden}
            backgroundColor="transparent"
            disableScroll
            isAnimated={false}
            animationDuration={0}
            curved
            pointerConfig={{
              pointerStripHeight: CHART_HEIGHT,
              pointerStripWidth: 1.5,
              pointerStripColor: MonoColors.border,
              strokeDashArray: [4, 4],
              pointerColor: MonoColors.accent,
              pointerRadius: 5,
              autoAdjustPointerLabelPosition: true,
              pointerLabelWidth: 180,
              pointerLabelHeight: 52,
              shiftPointerLabelX: -90,
              shiftPointerLabelY: -58,
              activatePointersInstantlyOnTouch: true,
              pointerLabelComponent: (items: any[]) => {
                const item = items?.[0];
                if (!item) return null;
                const isPos = (item.delta ?? 0) >= 0;
                const pTone = (item.delta ?? 0) === 0 ? MonoColors.textSecond : isPos ? MonoColors.positive : MonoColors.negative;
                const pDeltaAmount = shown(rp(item.delta, true), hidden);
                const pDeltaPct = item.deltaPctBp != null ? shownPct(pct(item.deltaPctBp, true), hidden) : null;
                const pDeltaText = pDeltaPct ? `${pDeltaAmount} (${pDeltaPct})` : pDeltaAmount;

                return (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipDate}>{formatShortDate(item.date)}</Text>
                    <View style={styles.tooltipRow}>
                      <View style={[styles.tooltipDot, { backgroundColor: MonoColors.accent }]} />
                      <Text style={styles.tooltipAmount}>{shown(rp(item.raw), hidden)}</Text>
                    </View>
                    {item.delta != null && <Text style={[styles.tooltipDelta, { color: pTone }]}>{pDeltaText}</Text>}
                  </View>
                );
              },
            }}
          />
          )}
          {wrapWidth > 0 && (
            <View style={styles.xRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {xIndexes.map(i => {
                const x = yWidth + PAD_X + i * spacing - X_LABEL_WIDTH / 2;
                const left = Math.min(Math.max(0, x), Math.max(0, wrapWidth - X_LABEL_WIDTH));
                return (
                  <Text key={points[i].date} style={[styles.xLabel, { left, width: X_LABEL_WIDTH }]}>
                    {xLabel(range, points[i].date)}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  caption: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deltaText: { ...MonoText.bodyStrong, fontSize: 13 },
  vsText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rangeButton: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  rangeText: { ...MonoText.bodyS, color: MonoColors.textMeta },
  rangeTextSelected: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  rangeUnderline: { position: 'absolute', bottom: 2, left: 8, right: 8, height: 2, backgroundColor: MonoColors.text },
  chartWrapper: { marginTop: 6, marginHorizontal: -4 },
  xRow: { height: 18, marginTop: 4 },
  xLabel: { ...MonoText.caption, position: 'absolute', top: 0, textAlign: 'center', color: MonoColors.textMeta },
  tooltip: {
    backgroundColor: MonoColors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MonoColors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 3,
  },
  tooltipDate: { ...MonoText.caption, color: MonoColors.textSecond },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipDot: { width: 6, height: 6, borderRadius: 3 },
  tooltipAmount: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  tooltipDelta: { ...MonoText.caption, fontFamily: MonoText.bodyStrong.fontFamily, marginLeft: 12 },
});
