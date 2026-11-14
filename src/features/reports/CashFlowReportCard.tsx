// "Cash flow" for the selected period/range: income and expenses in their sign colours,
// the net, and the savings rate read from the same integer basis-point arithmetic as
// v_savings_rate. Transfers never enter these figures (v_period_flow excludes them).
import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { pct } from '@/core/money';
import type { ReportFlow } from '@/domain/reports';
import {
  cashFlowTitle,
  expensesCardLabel,
  incomeCardLabel,
  reportsFlowCaption,
  reportsNetCashFlowLabel,
  reportsSavingsRateLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface CashFlowReportCardProps {
  flow: ReportFlow;
  rangeText: string;
}

function FlowRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={strong ? styles.labelStrong : styles.label}>{label}</Text>
      {value}
    </View>
  );
}

export function CashFlowReportCard({ flow, rangeText }: CashFlowReportCardProps) {
  const netKind = flow.net > 0 ? 'income' : flow.net < 0 ? 'expense' : undefined;
  return (
    <Card style={styles.card} testID="reports-cash-flow">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{cashFlowTitle()}</Text>
        <Text style={styles.caption}>{reportsFlowCaption(rangeText)}</Text>
      </View>

      <View style={styles.rows}>
        <FlowRow label={incomeCardLabel()} value={<Amount value={flow.income} sign kind="income" variant="figureRow" />} />
        <FlowRow label={expensesCardLabel()} value={<Amount value={-flow.expense} kind="expense" variant="figureRow" />} />
        <View style={styles.divider} />
        <FlowRow
          strong
          label={reportsNetCashFlowLabel()}
          value={<Amount value={flow.net} sign kind={netKind} variant="figureRow" />}
        />
        <View style={styles.divider} />
        <FlowRow
          label={reportsSavingsRateLabel()}
          value={<Text style={styles.rate}>{flow.savingsRateBp == null ? '—' : pct(flow.savingsRateBp)}</Text>}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 2 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  rows: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, gap: 12 },
  label: { ...MonoText.body, color: MonoColors.textSecond },
  labelStrong: { ...MonoText.bodyStrong, color: MonoColors.text },
  divider: { height: 1, backgroundColor: MonoColors.border, marginVertical: 4 },
  rate: { ...MonoText.figureRow, color: MonoColors.text },
});
