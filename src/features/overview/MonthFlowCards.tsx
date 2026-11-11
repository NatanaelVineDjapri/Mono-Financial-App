// Expenses and Income for the month, side by side (grid of 2, gap 12), then the slim
// "Net cash flow" row and the note that transfers are excluded. Each card: a gold icon
// disc with the label beside it on one line, the amount (20/26, 700) and the change against last month: Expenses
// in neutral grey, Income in green on a rise (red on a fall), each with a triangle. Amounts go through <Amount>,
// percentages through shownPct (hidden mode masks both).
import { StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { monthAbbrev } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { OverviewFlow } from '@/domain/overview';
import {
  overviewChangeVsLabel,
  consumptionOnlyNote,
  expensesCardLabel,
  incomeCardLabel,
  monthFlowCardAccessibilityLabel,
  netCashFlowLabel,
  noChangeVsMonthLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { GoldDisc, Triangle } from './parts';

export interface MonthFlowCardsProps {
  period: string;
  previousPeriod: string;
  month: OverviewFlow;
  expenseChangeBp: number | null;
  incomeChangeBp: number | null;
}

interface FlowCardProps {
  label: string;
  icon: 'arrow-down' | 'arrow-up';
  amount: number;
  changeBp: number | null;
  previousPeriod: string;
  changeColor: string;
  testID: string;
}

function FlowCard({ label, icon, amount, changeBp, previousPeriod, changeColor, testID }: FlowCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const prevMonth = monthAbbrev(previousPeriod);
  const pctText = changeBp == null ? null : shownPct(pct(Math.abs(changeBp)), hidden);
  const changeText = pctText ? overviewChangeVsLabel(pctText, prevMonth) : noChangeVsMonthLabel(prevMonth);
  return (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={monthFlowCardAccessibilityLabel(label, shown(rp(amount), hidden), changeText)}
      testID={testID}
    >
      <View style={styles.head}>
        <GoldDisc icon={icon} />
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Amount value={amount} variant="figureCard" />
      <View style={styles.changeRow}>
        {changeBp != null && <Triangle up={changeBp >= 0} color={changeColor} />}
        <Text style={[styles.change, { color: changeColor }]}>{changeText}</Text>
      </View>
    </Card>
  );
}

export function MonthFlowCards({ period, previousPeriod, month, expenseChangeBp, incomeChangeBp }: MonthFlowCardsProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <FlowCard
          label={expensesCardLabel()}
          icon="arrow-down"
          amount={month.expense}
          changeBp={expenseChangeBp}
          previousPeriod={previousPeriod}
          changeColor={MonoColors.textSecond}
          testID="overview-expenses-card"
        />
        <FlowCard
          label={incomeCardLabel()}
          icon="arrow-up"
          amount={month.income}
          changeBp={incomeChangeBp}
          previousPeriod={previousPeriod}
          changeColor={incomeChangeBp != null && incomeChangeBp < 0 ? MonoColors.negative : MonoColors.positive}
          testID="overview-income-card"
        />
      </View>
      <Card style={styles.netRow} testID="overview-net-cash-flow">
        <Text style={styles.netLabel}>{netCashFlowLabel(monthAbbrev(period))}</Text>
        <Amount value={month.net} sign kind={month.net < 0 ? 'expense' : month.net > 0 ? 'income' : undefined} variant="figureS" />
      </Card>
      <Text style={styles.note}>{consumptionOnlyNote()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12 },
  grid: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, gap: 8 },
  // The icon disc and the label share one line (the label wraps at large text sizes).
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  change: { ...MonoText.caption, flexShrink: 1 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  netLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
});
