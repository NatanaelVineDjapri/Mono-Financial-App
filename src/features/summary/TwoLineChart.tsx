// Income against expenses, month by month: income a solid silver line with a fade, expenses a dashed grey one (they
// differ by dash and lightness, not by hue alone). Touching the plot shows that month's two amounts.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path } from 'react-native-svg';

import { AreaGradient, CHART_LINE_WIDTH, DottedGrid } from '@/components/chartParts';
import { linePath } from '@/components/LineAreaChart';
import { axisLabel, niceScale } from '@/core/chartScale';
import { rp, shown } from '@/core/money';
import { summaryExpense, summaryIncome } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const CHART_H = 150;
const TOP_PAD = 10;
const X_LABEL_H = 24;
const Y_LABEL_W = 44;
const RIGHT_PAD = 14;
const TOOLTIP_W = 176;
const EXPENSE_STROKE = '#8A8A8A';
const EXPENSE_DASH = [7, 6];

export interface TwoLineChartProps {
  labels: string[]; // one per month, oldest first
  income: number[];
  expense: number[];
  hidden: boolean;
  accessibilityLabel: string;
}

export function TwoLineChart({ labels, income, expense, hidden, accessibilityLabel }: TwoLineChartProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;
  const scale = niceScale(Math.max(1, ...income, ...expense));
  const left = hidden ? 8 : Y_LABEL_W;
  const right = Math.max(left + 40, width - RIGHT_PAD);
  const step = count > 1 ? (right - left) / (count - 1) : 0;
  const xAt = (i: number) => (count > 1 ? left + i * step : (left + right) / 2);
  const yAt = (v: number) => TOP_PAD + (1 - v / scale.top) * CHART_H;
  const incomePoints = income.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const expensePoints = expense.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const floor = TOP_PAD + CHART_H;
  const incomeLine = linePath(incomePoints);
  const area = count > 0 ? `${incomeLine} L ${xAt(count - 1)} ${floor} L ${xAt(0)} ${floor} Z` : '';
  // at most six month labels, always the last
  const every = Math.ceil(count / 6) || 1;

  const pick = (x: number) => {
    if (count > 0) setActive(step === 0 ? 0 : Math.min(count - 1, Math.max(0, Math.round((x - left) / step))));
  };

  return (
    <View style={styles.panel} testID="summary-two-lines">
      <View style={styles.legend}>
        <View style={styles.solidKey} />
        <Text style={styles.legendText}>{summaryIncome()}</Text>
        <View style={styles.dashKey}>
          <View style={styles.dash} />
          <View style={styles.dash} />
        </View>
        <Text style={styles.legendText}>{summaryExpense()}</Text>
      </View>
      <View
        style={{ height: TOP_PAD + CHART_H + X_LABEL_H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLayout={e => setWidth(Math.round(e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        {width > 0 && count > 0 && (
          <>
            <Svg width={width} height={TOP_PAD + CHART_H + X_LABEL_H} style={StyleSheet.absoluteFill}>
              <Defs>
                <AreaGradient id="twoLineFill" />
              </Defs>
              <DottedGrid xs={labels.map((_, i) => xAt(i))} ys={scale.ticks.map(yAt)} left={left} right={right} top={TOP_PAD} bottom={floor} />
              <Path d={area} fill="url(#twoLineFill)" />
              <Path d={linePath(expensePoints)} fill="none" stroke={EXPENSE_STROKE} strokeWidth={2.5} strokeDasharray={EXPENSE_DASH} strokeLinecap="round" />
              <Path d={incomeLine} fill="none" stroke={MonoColors.accent} strokeWidth={CHART_LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
              {incomePoints.map((p, i) => <Circle key={`i-${i}`} cx={p.x} cy={p.y} r={i === active ? 5 : 3} fill={MonoColors.accent} />)}
              {expensePoints.map((p, i) => <Circle key={`e-${i}`} cx={p.x} cy={p.y} r={i === active ? 5 : 3} fill={MonoColors.surface} stroke={EXPENSE_STROKE} strokeWidth={2} />)}
              {active !== null && <Line x1={xAt(active)} x2={xAt(active)} y1={TOP_PAD} y2={floor} stroke={MonoColors.textMeta} strokeWidth={1} strokeDasharray={[4, 4]} />}
            </Svg>
            {!hidden &&
              scale.ticks.map(t => (
                <Text key={`y-${t}`} style={[styles.yLabel, { top: yAt(t) - 8 }]} accessibilityElementsHidden importantForAccessibility="no">
                  {t === 0 ? '0' : axisLabel(t, scale.top)}
                </Text>
              ))}
            {labels.map((label, i) =>
              (count - 1 - i) % every === 0 ? (
                <Text key={`x-${i}`} style={[styles.xLabel, { left: Math.min(Math.max(0, xAt(i) - 24), Math.max(0, width - 48)), top: floor + 8 }]} accessibilityElementsHidden importantForAccessibility="no">
                  {label}
                </Text>
              ) : null,
            )}
            {active !== null && (
              <View pointerEvents="none" style={[styles.tooltip, { left: Math.min(Math.max(0, xAt(active) - TOOLTIP_W / 2), Math.max(0, width - TOOLTIP_W)) }]} testID="summary-two-lines-tooltip">
                <Text style={styles.tooltipDate}>{labels[active]}</Text>
                <Text style={styles.tooltipText}>{`${summaryIncome()} ${shown(rp(income[active]), hidden)}`}</Text>
                <Text style={styles.tooltipText}>{`${summaryExpense()} ${shown(rp(expense[active]), hidden)}`}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: MonoColors.surface, borderRadius: radius.lg, padding: 16, gap: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  solidKey: { width: 16, height: 4, borderRadius: 2, backgroundColor: MonoColors.accent },
  dashKey: { flexDirection: 'row', gap: 3, marginLeft: 10 },
  dash: { width: 6, height: 3, backgroundColor: EXPENSE_STROKE },
  legendText: { ...MonoText.caption, color: MonoColors.textSecond },
  yLabel: { ...MonoText.caption, position: 'absolute', left: 0, width: Y_LABEL_W - 8, color: MonoColors.textMeta },
  xLabel: { ...MonoText.caption, position: 'absolute', width: 48, textAlign: 'center', color: MonoColors.textMeta },
  tooltip: { position: 'absolute', top: 0, width: TOOLTIP_W, backgroundColor: MonoColors.card, borderRadius: 8, borderWidth: 1, borderColor: MonoColors.border, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  tooltipDate: { ...MonoText.caption, color: MonoColors.textSecond },
  tooltipText: { ...MonoText.caption, color: MonoColors.text },
});
