// "Net worth history" (a line over the last six month ends, the goal as a dashed line, and
// the exact-value table) and "Where your money is" (one stacked bar by account, with a row
// per slice). Line chart uses react-native-gifted-charts LineChart for rendering.
// All figures read from views (v_net_worth_by_month, account balances) and shares from
// accountShares() in src/domain/overview.ts. Hidden mode masks amounts and shares.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { ChartTable } from '@/components/ChartTable';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { axisLabel, millionsCallout, niceScale } from '@/core/chartScale';
import { monthAbbrev } from '@/core/date';
import { pct, rp, shown, shownCompact, shownPct } from '@/core/money';
import type { NetWorthMonth } from '@/domain/net-worth';
import type { AccountShareRow } from '@/domain/overview';
import {
    byAccountCaption,
    goalLineLabel,
    monthEndValuesNote,
    netWorthHistoryAccessibilityLabel,
    netWorthHistoryTitle,
    rangeAllLabel,
    rangeOneYearLabel,
    rangeSixMonthsLabel,
    whereMoneyAccessibilityLabel,
    whereYourMoneyIsTitle
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SHARE_COLORS } from './palette';

const CHART_HEIGHT = 140;
const PAD_X = 10;
// The library reads `animationDuration` but its types don't declare it. Without a zero
// duration its width/label timers still fire after the card has gone away.
const NO_ANIMATION = { animationDuration: 0 };

type Range = '6M' | '1Y' | 'All';
const RANGES: { key: Range; months: number | null; label: () => string }[] = [
  { key: '6M', months: 6, label: rangeSixMonthsLabel },
  { key: '1Y', months: 12, label: rangeOneYearLabel },
  { key: 'All', months: null, label: rangeAllLabel },
];

export interface NetWorthHistoryCardProps {
  history: NetWorthMonth[];
  goalTarget?: number;
}

function RangeSwitch({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <View style={styles.rangeRow} accessibilityRole="tablist">
      {RANGES.map(r => {
        const selected = r.key === value;
        return (
          <Pressable
            key={r.key}
            onPress={() => onChange(r.key)}
            accessibilityRole="tab"
            accessibilityLabel={r.label()}
            accessibilityState={{ selected }}
            android_ripple={undefined}
            style={styles.rangeButton}
            testID={`overview-nw-range-${r.key}`}
          >
            <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{r.label()}</Text>
            {selected && <View style={styles.rangeUnderline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function NetWorthHistoryCard({ history, goalTarget }: NetWorthHistoryCardProps) {
  // The React Compiler freezes the data it memoizes, and gifted-charts writes a marker onto its input while
  // cloning it ("Cannot add new property 'isActiveClone'"), so this component opts out of the compiler.
  'use no memo';
  const hidden = useHideAmounts(s => s.hidden);
  const [range, setRange] = useState<Range>('1Y');
  if (history.length < 2) return null;

  const months = RANGES.find(r => r.key === range)?.months ?? null;
  const points = months == null ? history : history.slice(-months);
  const scale = niceScale(Math.max(goalTarget ?? 0, ...points.map(p => p.netWorth)));
  const valuesText = points.map(p => `${monthAbbrev(p.month)} ${shown(rp(p.netWorth), hidden)}`).join(', ');

  // Transform data for LineChart
  const lastValue = points[points.length - 1].netWorth;
  const lineData = points.map((p, i) => {
    const isLast = i === points.length - 1;
    return {
      value: p.netWorth,
      label: monthAbbrev(p.month),
      dataPointRadius: isLast ? 4.5 : 2,
      dataPointColor: isLast ? MonoColors.card : MonoColors.accent,
      dataPointStrokeColor: MonoColors.accent,
      dataPointStrokeWidth: isLast ? 2 : 0,
      labelTextStyle: { ...MonoText.caption, color: MonoColors.textSecond },
      // The latest value sits by its own point (not in a row above the chart), so it reads
      // as part of the line. Narrow width + left shift keeps it inside the card edge.
      ...(isLast && {
        dataPointLabelComponent: () => (
          <Text numberOfLines={1} style={styles.pointLabel}>
            {shownCompact(millionsCallout(lastValue), hidden)}
          </Text>
        ),
        dataPointLabelWidth: 72,
        dataPointLabelShiftX: -44,
        dataPointLabelShiftY: -12,
      }),
    };
  });

  // Goal line data (if provided)
  const goalData = goalTarget
    ? points.map(() => ({
        value: goalTarget,
        // white dots on the goal line (the library's default is blue)
        dataPointColor: MonoColors.text,
        dataPointRadius: 2,
      }))
    : undefined;

  return (
    <Card style={styles.card} testID="overview-net-worth-history">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {netWorthHistoryTitle()}
        </Text>
        <RangeSwitch value={range} onChange={setRange} />
      </View>

      {goalTarget != null && (
        <View style={styles.callouts}>
          <Text style={styles.callout}>{goalLineLabel(shownCompact(millionsCallout(goalTarget), hidden))}</Text>
        </View>
      )}

      <View accessible accessibilityRole="image" accessibilityLabel={netWorthHistoryAccessibilityLabel(valuesText)}>
        <LineChart
          data={lineData}
          data2={goalData}
          // Every point has a value, so there is nothing to interpolate; this also skips the library's clone.
          interpolateMissingValues={false}
          height={CHART_HEIGHT}
          spacing={points.length > 1 ? (300 - PAD_X * 2) / (points.length - 1) : 150}
          initialSpacing={PAD_X}
          endSpacing={PAD_X}
          color={MonoColors.accent}
          color2={MonoColors.textDisabled}
          dataPointsColor2={MonoColors.text}
          thickness={2}
          strokeDashArray2={[4, 4]}
          startFillColor="transparent"
          startOpacity={0}
          endOpacity={0}
          hideDataPoints={false}
          textColor={MonoColors.textSecond}
          textFontSize={12}
          xAxisLabelTextStyle={{ ...MonoText.caption, color: MonoColors.textSecond }}
          yAxisTextStyle={{ ...MonoText.caption, color: MonoColors.textMeta }}
          yAxisThickness={0}
          xAxisThickness={0}
          hideRules={false}
          rulesColor={MonoColors.border}
          rulesType="solid"
          noOfSections={scale.ticks.length - 1}
          yAxisLabelTexts={scale.ticks.map(t => axisLabel(t, scale.top))}
          maxValue={scale.top}
          hideYAxisText={hidden}
          backgroundColor="transparent"
          disableScroll
          isAnimated={false}
          {...NO_ANIMATION}
          curved
        />
      </View>

      <ChartTable
        rows={points.map(p => ({ label: monthAbbrev(p.month), values: [p.netWorth] }))}
        collapsedByDefault={points.length > 6}
        testID="overview-net-worth-table"
      />
      <Text style={styles.caption}>{monthEndValuesNote()}</Text>
    </Card>
  );
}

export interface WhereYourMoneyCardProps {
  shares: AccountShareRow[];
}

export function WhereYourMoneyCard({ shares }: WhereYourMoneyCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  if (shares.length === 0) return null;
  const nameOf = (s: AccountShareRow) => s.label;
  const colorOf = (i: number) => SHARE_COLORS[Math.min(i, SHARE_COLORS.length - 1)];
  const valuesText = shares.map(s => `${nameOf(s)} ${shown(rp(s.amount), hidden)} ${shownPct(pct(s.shareBp), hidden)}`).join(', ');

  return (
    <Card style={styles.card} testID="overview-where-money">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {whereYourMoneyIsTitle()}
        </Text>
        <Text style={styles.caption}>{byAccountCaption()}</Text>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={whereMoneyAccessibilityLabel(valuesText)} style={styles.stack}>
        {shares.map((s, i) => (
          s.shareBp > 0 && <View key={s.id} style={{ flex: s.shareBp, backgroundColor: colorOf(i) }} />
        ))}
      </View>
      {shares.map((s, i) => (
        <View key={s.id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colorOf(i) }]} />
          <Text style={styles.rowName}>{nameOf(s)}</Text>
          <Amount value={s.amount} variant="figureRow" />
          <Text style={styles.rowPct}>{shownPct(pct(s.shareBp), hidden)}</Text>
        </View>
      ))}
    </Card>
  );
}


const styles = StyleSheet.create({
  callouts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  callout: { ...MonoText.caption, color: MonoColors.textSecond },
  pointLabel: { ...MonoText.caption, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text, textAlign: 'right' },
  card: { marginHorizontal: 16, gap: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'center' },
  rangeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rangeText: { ...MonoText.bodyS, color: MonoColors.textMeta },
  rangeTextSelected: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  rangeUnderline: { position: 'absolute', bottom: 8, width: 18, height: 2, borderRadius: 1, backgroundColor: MonoColors.text },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  rowName: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  rowPct: { ...MonoText.bodyS, color: MonoColors.textSecond, minWidth: 56, textAlign: 'right' },
});
