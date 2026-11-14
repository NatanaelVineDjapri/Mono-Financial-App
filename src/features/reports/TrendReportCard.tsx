// "Six-month trend": six periods of income (gold) against expenses (grey), the exact
// values in a table beneath (CLAUDE.md rule 7), and one rounding note. The current period
// carries a `*` until its last day, so a partial month is never read as a finished one.
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { millionsFixed } from '@/core/chartScale';
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

const CHART_HEIGHT = 104;
const BAR_WIDTH = 16;
const INNER_GAP = 3;
const PAIR_GAP = 12;
const EXPENSE_BAR = MonoColors.textDisabled;
// The library reads `animationDuration` but its types don't declare it. Without a zero
// duration its label timers still fire after the card has gone away.
const NO_ANIMATION = { animationDuration: 0 };

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

  const valuesText = rows
    .map(row => cashFlowValuesText(monthAbbrev(row.period), shownCompact(rp(row.income), hidden), shownCompact(rp(row.expense), hidden)))
    .join('; ');

  const maxValue = Math.max(1, ...rows.flatMap(row => [row.income, row.expense]));
  const barData = rows.flatMap(row => [
    {
      value: row.income,
      frontColor: MonoColors.accent,
      spacing: INNER_GAP,
    },
    {
      value: row.expense,
      frontColor: EXPENSE_BAR,
      spacing: PAIR_GAP,
    },
  ]);

  return (
    <Card style={styles.card} testID="reports-trend">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{reportsSixMonthTrendTitle()}</Text>
        <Text style={styles.caption}>{reportsTrendCaption()}</Text>
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={cashFlowAccessibilityLabel(valuesText)}>
        <BarChart
          data={barData}
          height={CHART_HEIGHT}
          barWidth={BAR_WIDTH}
          spacing={PAIR_GAP}
          initialSpacing={4}
          endSpacing={4}
          barBorderRadius={3}
          maxValue={maxValue}
          hideRules
          hideYAxisText
          noOfSections={1}
          yAxisThickness={0}
          xAxisThickness={0}
          backgroundColor="transparent"
          disablePress
          disableScroll
          isAnimated={false}
          {...NO_ANIMATION}
        />
      </View>

      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: MonoColors.accent }]} />
        <Text style={styles.legendText}>{incomeCardLabel()}</Text>
        <View style={[styles.swatch, { backgroundColor: EXPENSE_BAR }]} />
        <Text style={styles.legendText}>{expensesCardLabel()}</Text>
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
  header: { gap: 2 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { ...MonoText.caption, color: MonoColors.textSecond, marginRight: 8 },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
});
