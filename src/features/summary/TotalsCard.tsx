// Net total, expenses, income and balance corrections of a range. Colour only reinforces the sign.
import { StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import type { SummaryTotals } from '@/domain/summary';
import { summaryCorrection, summaryExpense, summaryIncome, summaryNet } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Row({ label, value, kind, testID }: { label: string; value: number; kind?: 'income' | 'expense' | 'transfer'; testID: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Amount value={value} sign kind={value === 0 ? 'transfer' : kind} variant="figureS" />
    </View>
  );
}

export function TotalsCard({ totals }: { totals: SummaryTotals }) {
  return (
    <Card style={styles.card} testID="summary-totals">
      <Text style={styles.caption}>{summaryNet()}</Text>
      <Amount value={totals.net} sign kind={totals.net < 0 ? 'expense' : totals.net > 0 ? 'income' : 'transfer'} variant="displayS" testID="summary-net" />
      <View style={styles.rows}>
        <Row label={summaryExpense()} value={-totals.expense} kind="expense" testID="summary-expense" />
        <Row label={summaryIncome()} value={totals.income} kind="income" testID="summary-income" />
        {/* a correction is neither earning nor spending: never coloured */}
        <Row label={summaryCorrection()} value={totals.correction} kind="transfer" testID="summary-correction" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  caption: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  rows: { marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: MonoColors.border },
  label: { ...MonoText.body, color: MonoColors.textSecond },
});
