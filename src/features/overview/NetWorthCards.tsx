// "Net worth history" (a line over the month ends, the goal as a dashed line, and the
// exact-value table) and "Where your money is" (one stacked bar by account, with a row
// per slice). The line is drawn like the Overview's net cash flow chart (src/components/LineAreaChart),
// with the same pill switch under it.
// All figures read from views (v_net_worth_by_month, account balances) and shares from
// accountShares() in src/domain/overview.ts. Hidden mode masks amounts and shares.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { ChartTable } from '@/components/ChartTable';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { LineAreaChart } from '@/components/LineAreaChart';
import { axisLabel, labelIndexes, millionsCallout, niceRange } from '@/core/chartScale';
import { monthAbbrev, monthLabel } from '@/core/date';
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
    summaryOpen,
    whereMoneyAccessibilityLabel,
    whereYourMoneyIsTitle
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SHARE_COLORS } from './palette';

const X_LABELS_MAX = 4;

type Range = '6M' | '1Y' | 'All';
const RANGES: { key: Range; months: number | null; label: () => string }[] = [
  { key: '6M', months: 6, label: rangeSixMonthsLabel },
  { key: '1Y', months: 12, label: rangeOneYearLabel },
  { key: 'All', months: null, label: rangeAllLabel },
];

export interface NetWorthHistoryCardProps {
  history: NetWorthMonth[];
  goalTarget?: number;
  onOpenSummary?: () => void; // a tap on the card, or the link in it, opens the Summary page
}

// A y axis label, as on the net cash flow chart: millions once the axis reaches Rp1 million, thousands below it.
function yLabel(value: number, top: number): string {
  if (value === 0) return '0';
  return top >= 1_000_000 ? millionsCallout(value) : axisLabel(value, top);
}

// The pill of the net cash flow card. The buttons are 36 high inside a 44 pill; hitSlop makes the touch target 44.
function RangeSwitch({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <View style={styles.rangeTabs} accessibilityRole="radiogroup">
      {RANGES.map(r => {
        const selected = r.key === value;
        return (
          <Pressable
            key={r.key}
            onPress={() => onChange(r.key)}
            accessibilityRole="radio"
            accessibilityLabel={r.label()}
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            android_ripple={undefined}
            style={({ pressed }) => [styles.rangeTab, selected && styles.rangeTabSelected, pressed && !selected && styles.pressed]}
            testID={`overview-nw-range-${r.key}`}
          >
            <Text style={[styles.rangeTabText, selected && styles.rangeTabTextSelected]}>{r.label()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NetWorthHistoryCard({ history, goalTarget, onOpenSummary }: NetWorthHistoryCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const [range, setRange] = useState<Range>('1Y');
  if (history.length < 2) return null;

  const months = RANGES.find(r => r.key === range)?.months ?? null;
  const points = months == null ? history : history.slice(-months);
  const values = points.map(p => p.netWorth);
  // From zero, like the net cash flow chart, and always high enough to hold the goal line.
  const axis = niceRange(Math.min(0, ...values), Math.max(0, goalTarget ?? 0, ...values));
  const axisTop = Math.max(Math.abs(axis.low), Math.abs(axis.high));
  const longestTick = Math.max(...axis.ticks.map(t => yLabel(t, axisTop).length));
  const valuesText = points.map(p => `${monthAbbrev(p.month)} ${shown(rp(p.netWorth), hidden)}`).join(', ');

  return (
    // Touching the card opens the Summary; the chart and the range pill keep their own touches. A screen reader uses the
    // link under the title instead, so the card's contents are still read one by one.
    <Pressable onPress={onOpenSummary} disabled={!onOpenSummary} accessible={false} android_ripple={undefined} testID="nw-history-open-summary">
    <Card style={styles.card} testID="overview-net-worth-history">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {netWorthHistoryTitle()}
        </Text>
        {onOpenSummary && (
          <Pressable onPress={onOpenSummary} accessibilityRole="link" accessibilityLabel={summaryOpen()} android_ripple={undefined} style={styles.summaryLink} testID="nw-history-summary-link">
            <Text style={styles.summaryText}>{summaryOpen()}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        )}
      </View>

      {goalTarget != null && (
        <View style={styles.callouts}>
          <Text style={styles.callout}>{goalLineLabel(shownCompact(millionsCallout(goalTarget), hidden))}</Text>
        </View>
      )}

      <LineAreaChart
        compact
        values={values}
        axis={axis}
        yLabel={tick => yLabel(tick, axisTop)}
        yGutter={Math.max(44, longestTick * 7 + 10)}
        xLabelIndexes={labelIndexes(points.length, X_LABELS_MAX)}
        xLabel={index => monthAbbrev(points[index].month)}
        hideYLabels={hidden}
        referenceValue={goalTarget || undefined}
        endLabel={shownCompact(millionsCallout(values[values.length - 1]), hidden)}
        accessibilityLabel={netWorthHistoryAccessibilityLabel(valuesText)}
        testID="overview-nw-chart"
        renderTooltip={index => (
          <>
            <Text style={styles.tooltipDate}>{monthLabel(points[index].month)}</Text>
            <View style={styles.tooltipRow}>
              <View style={styles.tooltipDot} />
              <Text style={styles.tooltipAmount}>{shown(rp(points[index].netWorth), hidden)}</Text>
            </View>
          </>
        )}
      />

      <RangeSwitch value={range} onChange={setRange} />

      <ChartTable
        rows={points.map(p => ({ label: monthAbbrev(p.month), values: [p.netWorth] }))}
        collapsedByDefault={points.length > 6}
        showRowDividers
        testID="overview-net-worth-table"
      />
      <Text style={styles.caption}>{monthEndValuesNote()}</Text>
    </Card>
    </Pressable>
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
        <View key={s.id} style={[styles.row, i < shares.length - 1 && styles.rowDivider]}>
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
  card: { marginHorizontal: 16, gap: 12 },
  rangeTabs: {
    flexDirection: 'row',
    minHeight: 44,
    padding: 4,
    borderRadius: 22,
    backgroundColor: MonoColors.surface,
    borderWidth: 1,
    borderColor: MonoColors.border,
  },
  rangeTab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  rangeTabSelected: { backgroundColor: MonoColors.text },
  rangeTabText: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  rangeTabTextSelected: { color: MonoColors.bg },
  pressed: { opacity: 0.7 },
  tooltipDate: { ...MonoText.caption, color: MonoColors.textSecond },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MonoColors.accent },
  tooltipAmount: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  summaryLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  summaryText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  dot: { width: 8, height: 8, borderRadius: 2 },
  rowName: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  rowPct: { ...MonoText.bodyS, color: MonoColors.textSecond, minWidth: 56, textAlign: 'right' },
});
