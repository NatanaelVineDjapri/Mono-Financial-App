// Goals screen (DESIGN.md "G. Goals"). Back arrow returns to More.
// Progress is always read from v_goal_progress — never typed in.
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeaderButton } from '@/components/HeaderButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown } from '@/core/money';
import type { GoalProgressRow } from '@/data/repo/goals';
import { useGoalProgress } from '@/features/goals/useGoals';
import {
    addGoalLabel,
    goalAccountLinkedLabel,
    goalCalculatedLabel,
    goalCompleteLabel,
    goalLinkCTA,
    goalNotLinkedLabel,
    goalOfTargetLabel,
    goalRemainingLabel,
    goalTargetDateLabel,
    goalsEmptyBody,
    goalsEmptyTitle,
    goalsFooterNote,
    goalsTitle
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// Months from today to a target date — returns null when target_date is null.
function monthsLeft(targetDate: string | null): number | null {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const diff =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(0, diff);
}

// Needed monthly pace in whole rupiah (remaining / months), or null when not computable.
function neededPace(remaining: number, months: number | null): number | null {
  if (months == null || months <= 0) return null;
  return Math.ceil(remaining / months);
}

interface GoalCardProps {
  goal: GoalProgressRow;
  accountName?: string;
  onEdit: () => void;
}

function GoalItem({ goal, accountName, onEdit }: GoalCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const percent = shown(pct(goal.progress_bp, false), hidden);
  const ml = monthsLeft(goal.target_date);
  const pace = neededPace(goal.remaining, ml);

  const sourceNote =
    goal.mode === 'total_assets'
      ? goalCalculatedLabel()
      : accountName
        ? goalAccountLinkedLabel(accountName)
        : goalNotLinkedLabel();

  return (
    <Card style={styles.card} testID={`goal-card-${goal.id}`}>
      {/* Top row: name + target date */}
      <View style={styles.cardHead}>
        <View style={styles.nameRow}>
          <Text style={styles.goalName} testID={`goal-name-${goal.id}`}>
            {goal.name}
          </Text>
          <View style={styles.sourcePill}>
            <Icon name="target" size={16} color={MonoColors.textMeta} />
            <Text style={styles.sourceText}>{sourceNote}</Text>
          </View>
        </View>
        {!!goal.target_date && (
          <Text style={styles.targetDate}>{goalTargetDateLabel(formatShortDate(goal.target_date))}</Text>
        )}
      </View>

      {/* Amount */}
      <View style={styles.amountRow}>
        <Amount value={goal.current_amount} variant="figureM" testID={`goal-amount-${goal.id}`} />
        <Text style={styles.ofTarget}>{goalOfTargetLabel(shown(rp(goal.target_amount), hidden))}</Text>
      </View>

      {/* Progress bar */}
      <ProgressBar valueBp={goal.progress_bp} label={goal.name} />

      {/* Percent + remaining */}
      <View style={styles.metaRow}>
        <Text style={[styles.meta, styles.metaAccent]}>{goalCompleteLabel(percent)}</Text>
        <Text style={styles.meta}>{goalRemainingLabel(shown(rp(goal.remaining), hidden))}</Text>
      </View>

      {/* Pace row */}
      {goal.remaining > 0 && pace != null && (
        <View style={styles.paceRow}>
          <Text style={styles.meta}>Needed pace, estimate</Text>
          <Text style={styles.meta}>{shown(rp(pace), hidden)} / month</Text>
        </View>
      )}

      {/* CTA when not linked */}
      {goal.mode === 'account' && goal.account_id == null && (
        <Text style={styles.linkCTA}>{goalLinkCTA()}</Text>
      )}

      {/* Edit button */}
      <View style={styles.editButtonWrap}>
        <HeaderButton
          icon="pencil"
          label={`Edit ${goal.name}`}
          onPress={onEdit}
          testID={`goal-edit-${goal.id}`}
        />
      </View>
    </Card>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: goals = [], isLoading } = useGoalProgress();

  const onEdit = (id: number) =>
    router.push({ pathname: '/goal/edit', params: { id: String(id) } } as never);
  const onAdd = () => router.push('/goal/edit' as never);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={goalsTitle()}
        right={<HeaderButton icon="plus" label={addGoalLabel()} onPress={onAdd} testID="goals-add" />}
        testID="goals-header"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        testID="goals-scroll"
      >
        {!isLoading && goals.length === 0 && (
          <View style={styles.empty}>
            <Icon name="target" size={26} color={MonoColors.textDisabled} />
            <Text style={styles.emptyTitle}>{goalsEmptyTitle()}</Text>
            <Text style={styles.emptyBody}>{goalsEmptyBody()}</Text>
            <Button label={addGoalLabel()} onPress={onAdd} icon="plus" testID="goals-add-empty" />
          </View>
        )}

        {goals.map(goal => (
          <GoalItem key={goal.id} goal={goal} onEdit={() => onEdit(goal.id)} />
        ))}

        {goals.length > 0 && (
          <View style={styles.footer}>
            <Icon name="info" size={16} color={MonoColors.textMeta} />
            <Text style={styles.footerNote}>{goalsFooterNote()}</Text>
          </View>
        )}

        {goals.length > 0 && (
          <Button
            label={addGoalLabel()}
            icon="plus"
            variant="secondary"
            onPress={onAdd}
            style={styles.addButton}
            testID="goals-add-bottom"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, gap: 16, paddingTop: 8 },

  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  card: { gap: 10 },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', columnGap: 12, rowGap: 4 },
  nameRow: { gap: 4, flex: 1 },
  goalName: { ...MonoText.bodyStrong, color: MonoColors.text },
  sourcePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sourceText: { ...MonoText.caption, color: MonoColors.textMeta },
  targetDate: { ...MonoText.bodyS, color: MonoColors.textSecond },

  amountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  ofTarget: { ...MonoText.bodyS, color: MonoColors.textSecond },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  paceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  metaAccent: { color: MonoColors.accent },

  linkCTA: { ...MonoText.bodyS, color: MonoColors.accent },

  editButtonWrap: { alignSelf: 'flex-end', marginTop: 4 },

  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },

  addButton: { marginTop: 8 },
});
