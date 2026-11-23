// "Six-month trend": six periods of income (gold) against expenses (grey), the exact
// values in a table beneath (CLAUDE.md rule 7), and one rounding note. The current period
// carries a `*` until its last day, so a partial month is never read as a finished one.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { axisLabel, millionsFixed, niceScale, PAIR_EDGE, PAIR_INNER_GAP, PAIR_Y_AXIS_WIDTH, pairedBarSizes } from '@/core/chartScale';
import { formatDayMonth, monthAbbrev, monthName } from '@/core/date';
import { rp, shownCompact } from '@/core/money';
import type { ReportTrendRow } from '@/domain/reports';
import {
  cashFlowAccessibilityLabel,
  cashFlowValuesText,
  expensesCardLabel,
  incomeCardLabel,
  reportsColumnExpenses,
  reportsColumnIncome,
  reportsColumnMonth,
  reportsColumnNet,
  reportsRoundedNote,
  reportsSixMonthTrendTitle,
  reportsTrendCaption,
  reportsTrendPartialNote,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { ReportTable } from './ReportTable';

// The same bars as the Overview's cash flow card (gold income against grey expenses, a labelled y axis with its gridlines, the
// month under each pair), sized for six months instead of twelve.
const CHART_HEIGHT = 130;
const INNER_GAP = PAIR_INNER_GAP;
const Y_AXIS_WIDTH = PAIR_Y_AXIS_WIDTH;
const EDGE = PAIR_EDGE;

// The bars fill the width of the plot: the sizing is shared with the Overview's cash flow card (src/core/chartScale).
export const barSizes = pairedBarSizes;
const EXPENSE_BAR = MonoColors.textDisabled;
// The library reads `animationDuration` but its types don't declare it. Without a zero
// duration its label timers still fire after the card has gone away.
const NO_ANIMATION = { animationDuration: 0 };
// Also read by the library and missing from its types: the width of the y axis gutter, which the bar sizes are worked out from.
const AXIS_WIDTH = { yAxisLabelWidth: Y_AXIS_WIDTH };

function signedMillions(value: number): string {
  return value > 0 ? `+${millionsFixed(value)}` : millionsFixed(value);
}

export interface TrendReportCardProps {
  rows: ReportTrendRow[];
  today: string;
  partialPeriod: string | null;
}

export function TrendReportCard({ rows, today, partialPeriod }: TrendReportCardProps) {
  // The React Compiler freezes the data it memoizes, and gifted-charts writes a marker onto
  // its input while cloning it; this component opts out of the compiler.
  'use no memo';
  const hidden = useHideAmounts(s => s.hidden);
  const [chartWidth, setChartWidth] = useState(0);
  const { bar, gap } = barSizes(chartWidth, rows.length);

  const valuesText = rows
    .map(row => cashFlowValuesText(monthAbbrev(row.period), shownCompact(rp(row.income), hidden), shownCompact(rp(row.expense), hidden)))
    .join('; ');

  const scale = niceScale(Math.max(1, ...rows.flatMap(row => [row.income, row.expense])));
  const barData = rows.flatMap(row => [
    {
      value: row.income,
      // the month sits under the pair: the label box is as wide as the two bars and is centred
      label: monthAbbrev(row.period),
      labelWidth: bar * 2 + INNER_GAP,
      frontColor: MonoColors.accent,
      spacing: INNER_GAP,
      labelTextStyle: { ...MonoText.caption, color: MonoColors.textSecond, textAlign: 'center' as const },
    },
    {
      value: row.expense,
      frontColor: EXPENSE_BAR,
      label: '',
      spacing: gap,
    },
  ]);

  return (
    <Card style={styles.card} testID="reports-trend">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{reportsSixMonthTrendTitle()}</Text>
        <View style={styles.legend}>
          <View style={[styles.swatch, { backgroundColor: MonoColors.accent }]} />
          <Text style={styles.legendText}>{incomeCardLabel()}</Text>
          <View style={[styles.swatch, { backgroundColor: EXPENSE_BAR }]} />
          <Text style={styles.legendText}>{expensesCardLabel()}</Text>
        </View>
      </View>
      <Text style={styles.caption}>{reportsTrendCaption()}</Text>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={cashFlowAccessibilityLabel(valuesText)}
        onLayout={event => setChartWidth(Math.round(event.nativeEvent.layout.width))}
      >
        <BarChart
          data={barData}
          height={CHART_HEIGHT}
          barWidth={bar}
          spacing={gap}
          initialSpacing={EDGE}
          endSpacing={EDGE}
          barBorderRadius={3}
          hideRules={false}
          rulesColor={MonoColors.border}
          rulesType="solid"
          yAxisTextStyle={{ ...MonoText.caption, color: MonoColors.textMeta }}
          xAxisLabelTextStyle={{ ...MonoText.caption, color: MonoColors.textSecond }}
          hideYAxisText={hidden}
          noOfSections={scale.ticks.length - 1}
          yAxisLabelTexts={scale.ticks.map(t => axisLabel(t, scale.top))}
          maxValue={scale.top}
          yAxisThickness={0}
          xAxisThickness={0}
          backgroundColor="transparent"
          disablePress
          disableScroll
          isAnimated={false}
          {...NO_ANIMATION}
          {...AXIS_WIDTH}
        />
      </View>

      <ReportTable
        columns={[reportsColumnMonth(), reportsColumnIncome(), reportsColumnExpenses(), reportsColumnNet()]}
        rows={rows.map(row => ({
          label: `${monthAbbrev(row.period)}${row.partial ? ' *' : ''}`,
          cells: [
            { text: shownCompact(millionsFixed(row.income), hidden) },
            { text: shownCompact(millionsFixed(row.expense), hidden) },
            { text: shownCompact(signedMillions(row.net), hidden) },
          ],
        }))}
        testID="reports-trend-table"
      />

      <Text style={styles.note}>
        {partialPeriod ? reportsTrendPartialNote(monthName(partialPeriod), formatDayMonth(today)) : reportsRoundedNote()}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { ...MonoText.caption, color: MonoColors.textSecond, marginRight: 6 },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
});
