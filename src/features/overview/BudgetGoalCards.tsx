// Budget summary (this month's limit, spent, left, and the over-limit alert) and the goal
// card. Both read figures the views already produce (v_month_budget / v_budget_status,
// v_goal_progress); nothing is derived here beyond formatting. The progress bars are the
// shared ProgressBar: an over-limit bar keeps its striped red overflow plus icon and text.
import { StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate, monthShortLabel } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { BudgetCategoryRow, BudgetMonthRow } from '@/data/repo/budgets';
import type { GoalProgressRow } from '@/data/repo/goals';
import {
  allGoalsLabel,
  budgetLeftLabel,
  budgetSummaryTitle,
  detailsLabel,
  goalCompleteLabel,
  goalOfTargetLabel,
  goalRemainingLabel,
  goalTargetDateLabel,
  goalsTitle,
  overLimitAlert,
  percentUsedLabel,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SectionHeader } from './SectionHeader';

export interface BudgetSummaryCardProps {
  month: string;
  limit: BudgetMonthRow;
  overCategory?: BudgetCategoryRow; // the first category over its own limit, if any
  onOpen: () => void;
}

export function BudgetSummaryCard({ month, limit, overCategory, onOpen }: BudgetSummaryCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const over = limit.over_by > 0;
  const title = budgetSummaryTitle(monthShortLabel(month));
  return (
    <View style={styles.section} testID="overview-budget">
      <SectionHeader title={title} linkLabel={detailsLabel()} onPress={onOpen} />
      <Card style={styles.card}>
        <View style={styles.amountRow}>
          <Amount value={limit.total_spent} variant="figureM" />
          <Text style={styles.of}>{goalOfTargetLabel(shown(rp(limit.monthly_limit), hidden))}</Text>
        </View>
        <ProgressBar
          valueBp={limit.used_bp}
          label={title}
          overAmount={over ? limit.over_by : undefined}
          accessibilityLabel={`${title}, ${shown(rp(limit.total_spent), hidden)} ${goalOfTargetLabel(shown(rp(limit.monthly_limit), hidden))}, ${percentUsedLabel(shownPct(pct(limit.used_bp), hidden))}`}
        />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{percentUsedLabel(shownPct(pct(limit.used_bp), hidden))}</Text>
          {!over && <Text style={styles.meta}>{budgetLeftLabel(shown(rp(limit.remaining), hidden))}</Text>}
        </View>
        {!!overCategory && (
          <View style={styles.alert} accessible accessibilityLabel={overLimitAlert(overCategory.category, shown(rp(overCategory.over_by), hidden))}>
            <Icon name="alert" size={16} color={MonoColors.negative} />
            <Text style={styles.alertText}>{overLimitAlert(overCategory.category, shown(rp(overCategory.over_by), hidden))}</Text>
          </View>
        )}
      </Card>
    </View>
  );
}

export interface GoalCardProps {
  goal: GoalProgressRow;
  onOpenAll: () => void;
}

export function GoalCard({ goal, onOpenAll }: GoalCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const percent = shownPct(pct(goal.progress_bp), hidden);
  return (
    <View style={styles.section} testID="overview-goal">
      <SectionHeader title={goalsTitle()} linkLabel={allGoalsLabel()} onPress={onOpenAll} />
      <Card style={styles.card}>
        <View style={styles.goalHead}>
          <Text style={styles.goalName}>{goal.name}</Text>
          {!!goal.target_date && <Text style={styles.meta}>{goalTargetDateLabel(formatShortDate(goal.target_date))}</Text>}
        </View>
        <View style={styles.amountRow}>
          <Amount value={goal.current_amount} variant="figureM" />
          <Text style={styles.of}>{goalOfTargetLabel(shown(rp(goal.target_amount), hidden))}</Text>
        </View>
        <ProgressBar valueBp={goal.progress_bp} label={goal.name} />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{goalCompleteLabel(percent)}</Text>
          <Text style={styles.meta}>{goalRemainingLabel(shown(rp(goal.remaining), hidden))}</Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { marginHorizontal: 16, gap: 12 },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  of: { ...MonoText.bodyS, color: MonoColors.textSecond },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertText: { ...MonoText.bodyS, color: MonoColors.negative, flex: 1 },
  goalHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, rowGap: 4 },
  goalName: { ...MonoText.bodyStrong, color: MonoColors.text },
});
