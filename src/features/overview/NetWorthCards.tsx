// "Net worth history" (a line over the last six month ends, the goal as a dashed line, and
// the exact-value table) and "Where your money is" (one stacked bar by account, with a row
// per slice). Both draw with react-native-svg / plain Views; every figure is read from the
// views (v_net_worth_by_month, account balances) and the shares come from
// accountShares() in src/domain/overview.ts. Hidden mode masks the amounts and shares.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { ChartTable } from '@/components/ChartTable';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { labelIndexes, millionsCallout, niceScale } from '@/core/chartScale';
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
  othersCategoryLabel,
  rangeAllLabel,
  rangeOneYearLabel,
  rangeSixMonthsLabel,
  whereMoneyAccessibilityLabel,
  whereYourMoneyIsTitle,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SHARE_COLORS } from './palette';
import { PlotArea } from './PlotArea';

const CHART_HEIGHT = 140; // the plot, gridlines included
const X_LABELS_MAX = 6;
const PAD_X = 10; // keeps the end dots clear of the plot's edges

type Range = '6M' | '1Y' | 'All';
const RANGES: { key: Range; months: number | null; label: () => string }[] = [
  { key: '6M', months: 6, label: rangeSixMonthsLabel },
  { key: '1Y', months: 12, label: rangeOneYearLabel },
  { key: 'All', months: null, label: rangeAllLabel },
];

export interface NetWorthHistoryCardProps {
  history: NetWorthMonth[];
  goalTarget?: number; // the total-assets goal, drawn as a dashed line
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
  const hidden = useHideAmounts(s => s.hidden);
  const [range, setRange] = useState<Range>('1Y');
  if (history.length < 2) return null;

  const months = RANGES.find(r => r.key === range)?.months ?? null;
  const points = months == null ? history : history.slice(-months);
  const scale = niceScale(Math.max(goalTarget ?? 0, ...points.map(p => p.netWorth)));
  const last = points[points.length - 1];
  const valuesText = points.map(p => `${monthAbbrev(p.month)} ${shown(rp(p.netWorth), hidden)}`).join(', ');
  const xLabels = labelIndexes(points.length, X_LABELS_MAX);

  return (
    <Card style={styles.card} testID="overview-net-worth-history">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {netWorthHistoryTitle()}
        </Text>
        <RangeSwitch value={range} onChange={setRange} />
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={netWorthHistoryAccessibilityLabel(valuesText)}>
        <PlotArea
          height={CHART_HEIGHT}
          ticks={scale.ticks}
          hidden={hidden}
          footer={plotWidth => (
            <View style={styles.xRow}>
              {xLabels.map(i => (
                <Text
                  key={points[i].month}
                  style={[styles.xLabel, { left: pointX(i, points.length, plotWidth) - X_LABEL_HALF_WIDTH, width: X_LABEL_HALF_WIDTH * 2 }]}
                >
                  {monthAbbrev(points[i].month)}
                </Text>
              ))}
            </View>
          )}
        >
          {(plotWidth, yOf) => {
            const line = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${pointX(i, points.length, plotWidth).toFixed(1)} ${yOf(p.netWorth).toFixed(1)}`)
              .join(' ');
            const lastX = pointX(points.length - 1, points.length, plotWidth);
            return (
              <>
                <Svg width={plotWidth} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
                  {goalTarget != null && (
                    <Line x1={0} x2={plotWidth} y1={yOf(goalTarget)} y2={yOf(goalTarget)} stroke={MonoColors.textDisabled} strokeWidth={1} strokeDasharray="4 4" />
                  )}
                  <Path d={line} stroke={MonoColors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  {points.map((p, i) => (
                    <Circle key={p.month} cx={pointX(i, points.length, plotWidth)} cy={yOf(p.netWorth)} r={i === points.length - 1 ? 4.5 : 2} fill={i === points.length - 1 ? MonoColors.card : MonoColors.accent} stroke={MonoColors.accent} strokeWidth={i === points.length - 1 ? 2 : 0} />
                  ))}
                </Svg>
                {goalTarget != null && (
                  <Text style={[styles.callout, styles.goalLabel, { top: yOf(goalTarget) - 17 }]}>
                    {goalLineLabel(shownCompact(millionsCallout(goalTarget), hidden))}
                  </Text>
                )}
                <Text style={[styles.callout, styles.lastLabel, { top: yOf(last.netWorth) - 22, right: Math.max(0, plotWidth - lastX - 14) }]}>
                  {shownCompact(millionsCallout(last.netWorth), hidden)}
                </Text>
              </>
            );
          }}
        </PlotArea>
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

// x of the i-th of n points inside a plot `width` wide (edge padding so the end dots fit).
function pointX(i: number, n: number, width: number): number {
  return n === 1 ? width / 2 : PAD_X + (i * (width - PAD_X * 2)) / (n - 1);
}

export interface WhereYourMoneyCardProps {
  shares: AccountShareRow[];
}

export function WhereYourMoneyCard({ shares }: WhereYourMoneyCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  if (shares.length === 0) return null;
  const nameOf = (s: AccountShareRow) => (s.id === -1 ? othersCategoryLabel() : s.label);
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
          <View key={s.id} style={{ flex: s.shareBp, backgroundColor: colorOf(i) }} />
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

const X_LABEL_HALF_WIDTH = 20;

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'center' },
  rangeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rangeText: { ...MonoText.bodyS, color: MonoColors.textMeta },
  rangeTextSelected: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  rangeUnderline: { position: 'absolute', bottom: 8, width: 18, height: 2, borderRadius: 1, backgroundColor: MonoColors.text },
  xRow: { height: 22, marginTop: 6 },
  xLabel: { ...MonoText.caption, position: 'absolute', top: 0, textAlign: 'center', color: MonoColors.textSecond },
  callout: { ...MonoText.caption, position: 'absolute', color: MonoColors.textSecond },
  goalLabel: { right: 0 },
  lastLabel: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  rowName: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  rowPct: { ...MonoText.bodyS, color: MonoColors.textSecond, minWidth: 56, textAlign: 'right' },
});
