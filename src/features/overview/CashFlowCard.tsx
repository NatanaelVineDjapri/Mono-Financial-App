// "Cash flow": six months of income (gold) against expenses (#737373) as paired bars, with
// the exact-value table beneath (CLAUDE.md rule 7). Uses react-native-gifted-charts BarChart
// for rendering with paired bars per month. Hidden mode masks the figures in the label and
// the table (through <Amount>).
import { StyleSheet, Text, View } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- library not yet installed, see package.json
import { BarChart } from 'react-native-gifted-charts';

import { Card } from '@/components/Card';
import { ChartTable } from '@/components/ChartTable';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { niceScale } from '@/core/chartScale';
import { monthAbbrev } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { OverviewMonthFlow } from '@/domain/overview';
import {
    axisInMillionsLabel,
    cashFlowAccessibilityLabel,
    cashFlowTitle,
    cashFlowValuesText,
    expensesCardLabel,
    incomeCardLabel,
    lastSixMonthsLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { EXPENSE_BAR } from './palette';

const CHART_HEIGHT = 130;
const BAR_WIDTH = 14;
const BAR_SPACING = 3;

export function CashFlowCard({ months }: { months: OverviewMonthFlow[] }) {
  const hidden = useHideAmounts(s => s.hidden);
  const scale = niceScale(Math.max(...months.flatMap(m => [m.income, m.expense])));
  
  const valuesText = months
    .map(m => cashFlowValuesText(monthAbbrev(m.period), shown(rp(m.income), hidden), shown(rp(m.expense), hidden)))
    .join('; ');

  // Transform data for paired bars: income (gold) + expense (grey) per month
  const barData = months.flatMap((m, i) => [
    {
      value: m.income,
      label: i === 0 ? monthAbbrev(m.period) : '',
      frontColor: MonoColors.accent,
      spacing: BAR_SPACING,
      labelTextStyle: { ...MonoText.caption, color: MonoColors.textSecond },
    },
    {
      value: m.expense,
      frontColor: EXPENSE_BAR,
      label: monthAbbrev(m.period),
      labelTextStyle: { ...MonoText.caption, color: MonoColors.textSecond },
    },
  ]);

  return (
    <Card style={styles.card} testID="overview-cash-flow">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {cashFlowTitle()}
        </Text>
        <View style={styles.legend}>
          <View style={[styles.swatch, { backgroundColor: MonoColors.accent }]} />
          <Text style={styles.legendText}>{incomeCardLabel()}</Text>
          <View style={[styles.swatch, { backgroundColor: EXPENSE_BAR }]} />
          <Text style={styles.legendText}>{expensesCardLabel()}</Text>
        </View>
      </View>
      <Text style={styles.caption}>
        {scale.top >= 1_000_000 ? `${lastSixMonthsLabel()} · ${axisInMillionsLabel()}` : lastSixMonthsLabel()}
      </Text>

      <View accessible accessibilityRole="image" accessibilityLabel={cashFlowAccessibilityLabel(valuesText)}>
        <BarChart
          data={barData}
          height={CHART_HEIGHT}
          barWidth={BAR_WIDTH}
          spacing={BAR_SPACING}
          barBorderRadius={3}
          hideRules={false}
          rulesColor={MonoColors.border}
          rulesType="solid"
          xAxisThickness={0}
          yAxisThickness={0}
          yAxisTextStyle={{ ...MonoText.caption, color: MonoColors.textMeta }}
          xAxisLabelTextStyle={{ ...MonoText.caption, color: MonoColors.textSecond }}
          hideYAxisText={hidden}
          noOfSections={scale.ticks.length - 1}
          maxValue={scale.top}
          backgroundColor="transparent"
          disablePress
          isAnimated={false}
        />
      </View>

      <ChartTable
        columns={[{ label: incomeCardLabel() }, { label: expensesCardLabel() }]}
        rows={months.map(m => ({ label: monthAbbrev(m.period), values: [m.income, m.expense] }))}
        testID="overview-cash-flow-table"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { ...MonoText.caption, color: MonoColors.textSecond, marginRight: 6 },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
});
