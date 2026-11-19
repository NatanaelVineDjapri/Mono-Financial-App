// The Overview's net cash flow block: a restrained card with the range's label, the net figure, its change against the
// range before (a chip: green with a plus when it rises, red with a minus when it falls), a gold line of the running
// total, a Week / Month / Year switch, and In / Out tiles whose thin bars compare the two (In green, Out gold).
// The chart has an accessibility label and touch tooltip; the card's own note says what is counted.
// Consumption only: transfers between your own accounts are never counted.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { labelIndexes, niceRange } from '@/core/chartScale';
import { formatDayMonth, formatShortDate, monthAbbrev, monthName } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { FlowRange, FlowRangeKey } from '@/domain/cashFlowRanges';
import {
  consumptionOnlyNote,
  flowAgainst,
  flowChartA11y,
  flowIn,
  flowNoCompare,
  flowOut,
  flowRangeName,
  flowSegment,
  flowTileA11y,
  flowTitle,
  flowVs,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { Triangle } from './parts';

const KEYS: FlowRangeKey[] = ['week', 'month', 'year'];
const CHART_HEIGHT = 104;
const PAD_X = 6;
const NO_ANIMATION = { animationDuration: 0 };

export interface NetCashFlowCardProps {
  ranges: Record<FlowRangeKey, FlowRange>;
  onOpenTransactions?: (type: 'income' | 'expense') => void;
}

// A bucket's name: the day for week and month, the month for the year.
function bucketLabel(key: FlowRangeKey, id: string): string {
  return key === 'year' ? monthAbbrev(id) : formatDayMonth(id);
}

function Tile({ label, amount, share, tone, onPress, testID, right = false }: { label: string; amount: number; share: number; tone: string; onPress?: () => void; testID: string; right?: boolean }) {
  const hidden = useHideAmounts(s => s.hidden);
  const body = (
    <>
      <Text style={styles.tileLabel}>{label}</Text>
      <Amount value={amount} variant="figureM" style={styles.tileAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} />
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${share}%`, backgroundColor: tone }]} testID={`${testID}-bar`} />
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={flowTileA11y(label, shown(rp(amount), hidden))}
      android_ripple={undefined}
      style={({ pressed }) => [styles.tile, right && styles.tileRight, pressed && styles.pressed]}
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.tile, right && styles.tileRight]} testID={testID}>{body}</View>
  );
}

export function NetCashFlowCard({ ranges, onOpenTransactions }: NetCashFlowCardProps) {
  // gifted-charts writes onto the data it is given, which the React Compiler freezes: opt out.
  'use no memo';
  const hidden = useHideAmounts(s => s.hidden);
  const [key, setKey] = useState<FlowRangeKey>('month');
  const [wrapWidth, setWrapWidth] = useState(0);
  const range = ranges[key];

  const month = monthName(range.period);
  const rangeName = flowRangeName(key, month);
  const title = flowTitle(rangeName);
  const rising = range.netChangeBp != null && range.netChangeBp >= 0;
  const tone = rising ? MonoColors.positive : MonoColors.negative;
  const changeText = range.netChangeBp == null ? null : shownPct(pct(range.netChangeBp, true), hidden);

  // The running total is drawn from the axis' lowest line, and the tooltip and the table say the real amounts.
  const cumulative = range.points.map(p => p.cumulative);
  const yRange = niceRange(Math.min(0, ...cumulative), Math.max(0, ...cumulative));
  const plotWidth = Math.max(160, wrapWidth);
  const spacing = range.points.length > 1 ? (plotWidth - PAD_X * 2) / (range.points.length - 1) : 120;
  const lineData = range.points.map(p => ({
    value: p.cumulative - yRange.low,
    raw: p.cumulative,
    id: p.key,
    dataPointRadius: 0,
    hideDataPoint: true,
  }));
  const xLabels = labelIndexes(range.points.length, 4);

  const biggest = Math.max(range.income, range.expense, 1);
  const inShare = Math.round((range.income * 100) / biggest);
  const outShare = Math.round((range.expense * 100) / biggest);
  const shortRange = key === 'month' ? monthAbbrev(range.period) : rangeName;
  const first = range.points[0];
  const last = range.points[range.points.length - 1];

  return (
    <Card style={styles.card} testID="overview-net-cash-flow-card">
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Amount value={range.net} sign variant="figureL" style={styles.net} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} testID="flow-net" />

      {changeText !== null ? (
        <View style={styles.changeRow} accessible accessibilityLabel={flowVs(changeText, flowAgainst(key, monthName(range.previousPeriod)))} testID="flow-change">
          <View style={[styles.chip, { backgroundColor: rising ? 'rgba(74,222,128,0.14)' : 'rgba(255,107,107,0.14)' }]}>
            <Triangle up={rising} color={tone} />
            <Text style={[styles.chipText, { color: tone }]}>{flowVs(changeText, flowAgainst(key, monthName(range.previousPeriod)))}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noCompare} testID="flow-change">{flowNoCompare()}</Text>
      )}

      {first && last && (
        <View
          style={styles.chartWrap}
          accessible
          accessibilityRole="image"
          accessibilityLabel={flowChartA11y(title, shown(rp(range.net, true), hidden), formatShortDate(range.start), formatShortDate(range.end))}
          onLayout={e => setWrapWidth(Math.round(e.nativeEvent.layout.width))}
          testID="flow-chart"
        >
          {wrapWidth > 0 && (
            <LineChart
              data={lineData}
              areaChart
              interpolateMissingValues={false}
              height={CHART_HEIGHT}
              width={plotWidth}
              spacing={spacing}
              initialSpacing={PAD_X}
              endSpacing={PAD_X}
              color={MonoColors.accent}
              thickness={2}
              startFillColor={MonoColors.accent}
              endFillColor={MonoColors.accent}
              startOpacity={0.16}
              endOpacity={0}
              hideDataPoints
              hideRules
              hideYAxisText
              yAxisThickness={0}
              xAxisThickness={0}
              yAxisLabelWidth={0}
              maxValue={yRange.high - yRange.low}
              noOfSections={3}
              backgroundColor="transparent"
              disableScroll
              isAnimated={false}
              {...NO_ANIMATION}
              pointerConfig={{
                pointerStripHeight: CHART_HEIGHT,
                pointerStripWidth: 1,
                pointerStripColor: MonoColors.border,
                pointerColor: MonoColors.accent,
                pointerRadius: 4,
                autoAdjustPointerLabelPosition: true,
                pointerLabelWidth: 130,
                pointerLabelHeight: 28,
                shiftPointerLabelX: -65,
                shiftPointerLabelY: -34,
                activatePointersInstantlyOnTouch: true,
                pointerLabelComponent: (items: { raw?: number; id?: string }[]) => {
                  const item = items?.[0];
                  if (!item || item.raw == null || !item.id) return null;
                  return (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipText}>{`${bucketLabel(key, item.id)} · ${shown(rp(item.raw), hidden)}`}</Text>
                    </View>
                  );
                },
              }}
            />
          )}
          <View style={styles.xRow} importantForAccessibility="no-hide-descendants">
            {xLabels.map(i => (
              <Text key={i} style={styles.xLabel}>{bucketLabel(key, range.points[i].key)}</Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.rangeTabs} accessibilityRole="radiogroup" testID="flow-segmented">
        {KEYS.map(option => {
          const selected = option === key;
          return (
            <Pressable
              key={option}
              onPress={() => setKey(option)}
              accessibilityRole="radio"
              accessibilityLabel={flowSegment(option)}
              accessibilityState={{ selected }}
              android_ripple={undefined}
              style={({ pressed }) => [styles.rangeTab, selected && styles.rangeTabSelected, pressed && !selected && styles.pressed]}
            >
              <Text style={[styles.rangeTabText, selected && styles.rangeTabTextSelected]}>{flowSegment(option)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tiles}>
        <Tile label={flowIn(shortRange)} amount={range.income} share={inShare} tone={MonoColors.positive} onPress={onOpenTransactions ? () => onOpenTransactions('income') : undefined} testID="overview-income-card" />
        <Tile label={flowOut(shortRange)} amount={range.expense} share={outShare} tone={MonoColors.accent} onPress={onOpenTransactions ? () => onOpenTransactions('expense') : undefined} testID="overview-expenses-card" right />
      </View>

      <Text style={styles.note}>{consumptionOnlyNote()}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: MonoColors.border, gap: 10 },
  title: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  net: { color: MonoColors.text, fontFamily: MonoText.heroBalance.fontFamily },
  changeRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { ...MonoText.chip },
  noCompare: { ...MonoText.bodyS, color: MonoColors.textSecond },
  chartWrap: { marginTop: 2, marginBottom: 2 },
  xRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD_X, marginTop: 6 },
  xLabel: { ...MonoText.caption, color: MonoColors.textMeta },
  tooltip: { backgroundColor: MonoColors.bg, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  tooltipText: { ...MonoText.caption, color: MonoColors.text },
  tiles: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: MonoColors.border },
  tile: { flex: 1, minWidth: 0, gap: 8, paddingVertical: 12 },
  tileRight: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: MonoColors.border },
  tileLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  tileAmount: { fontFamily: MonoText.figureCard.fontFamily, color: MonoColors.text },
  bar: { height: 3, borderRadius: 2, backgroundColor: MonoColors.border, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  pressed: { opacity: 0.7 },
  rangeTabs: { flexDirection: 'row', height: 44, borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  rangeTab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  rangeTabSelected: { borderBottomColor: MonoColors.accent },
  rangeTabText: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  rangeTabTextSelected: { color: MonoColors.text },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
});
