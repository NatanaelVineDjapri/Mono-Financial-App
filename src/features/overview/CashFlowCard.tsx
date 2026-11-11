// "Cash flow": six months of income (gold) against expenses (#737373) as paired bars, with
// the exact-value table beneath (CLAUDE.md rule 7). The bars are decorative: one
// accessible node carries every figure. Hidden mode masks the figures in the label and the
// table (through <Amount>).
import { StyleSheet, Text, View } from 'react-native';

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
import { PlotArea } from './PlotArea';

const CHART_HEIGHT = 130; // the plot, gridlines included
const PAD_TOP = 10; // PlotArea's own headroom above the top gridline
const BAR_WIDTH = 14;

export function CashFlowCard({ months }: { months: OverviewMonthFlow[] }) {
  const hidden = useHideAmounts(s => s.hidden);
  const scale = niceScale(Math.max(...months.flatMap(m => [m.income, m.expense])));
  const height = (value: number) => (value > 0 ? Math.max(2, Math.round((value / scale.top) * (CHART_HEIGHT - PAD_TOP))) : 0);
  const valuesText = months
    .map(m => cashFlowValuesText(monthAbbrev(m.period), shown(rp(m.income), hidden), shown(rp(m.expense), hidden)))
    .join('; ');

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
      <Text style={styles.caption}>{scale.top >= 1_000_000 ? `${lastSixMonthsLabel()} · ${axisInMillionsLabel()}` : lastSixMonthsLabel()}</Text>

      <View accessible accessibilityRole="image" accessibilityLabel={cashFlowAccessibilityLabel(valuesText)}>
        <PlotArea
          height={CHART_HEIGHT}
          ticks={scale.ticks}
          hidden={hidden}
          footer={() => (
            <View style={styles.monthRow}>
              {months.map(m => (
                <Text key={m.period} style={styles.month}>
                  {monthAbbrev(m.period)}
                </Text>
              ))}
            </View>
          )}
        >
          {() => (
            <View style={styles.columns}>
              {months.map(m => (
                <View key={m.period} style={styles.column}>
                  <View style={[styles.bar, { height: height(m.income), backgroundColor: MonoColors.accent }]} />
                  <View style={[styles.bar, { height: height(m.expense), backgroundColor: EXPENSE_BAR }]} />
                </View>
              ))}
            </View>
          )}
        </PlotArea>
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
  columns: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: BAR_WIDTH, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  monthRow: { flexDirection: 'row', paddingTop: 6 },
  month: { ...MonoText.caption, flex: 1, textAlign: 'center', color: MonoColors.textSecond },
});
