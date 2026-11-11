// Goals screen (DESIGN.md "G. Goals"). Back arrow returns to More.
// Progress is always read from v_goal_progress — never typed in.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown } from '@/core/money';
import type { GoalProgressRow } from '@/data/repo/goals';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useGoalProgress } from '@/features/goals/useGoals';
import {
    addGoalLabel,
    goalCompleteLabel,
    goalLinkCTA,
    goalOfTargetLabel,
    goalRemainingLabel,
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
  onPress: () => void;
}

function GoalItem({ goal, accountName, onPress }: GoalCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const percent = shown(pct(goal.progress_bp, false), hidden);
  const ml = monthsLeft(goal.target_date);
  const pace = neededPace(goal.remaining, ml);

  const sourceNote =
    goal.mode === 'total_assets'
      ? 'Calculated: all accounts added together'
      : accountName
        ? `Linked account: ${accountName}`
        : 'Not linked to an account yet';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={styles.goalItem}
      testID={`goal-card-${goal.id}`}
    >
      {/* Top row: name + target date */}
      <View style={styles.goalHead}>
        <View style={styles.nameCol}>
          <Text style={styles.goalName} testID={`goal-name-${goal.id}`}>
            {goal.name}
          </Text>
          <Text style={styles.sourceNote}>{sourceNote}</Text>
        </View>
        {!!goal.target_date && (
          <Text style={styles.targetDate}>{`Target ${formatShortDate(goal.target_date)}`}</Text>
        )}
      </View>

      {/* Amount */}
      <Amount value={goal.current_amount} variant="displayS" style={styles.amount} testID={`goal-amount-${goal.id}`} />
      <Text style={styles.ofTarget}>{goalOfTargetLabel(shown(rp(goal.target_amount), hidden))}</Text>

      {/* Percent + remaining in one row */}
      <View style={styles.metaRow}>
        <Text style={styles.percentText}>{goalCompleteLabel(percent)}</Text>
        <Text style={styles.remainingText}>{goalRemainingLabel(shown(rp(goal.remaining), hidden))}</Text>
      </View>

      {/* Pace row */}
      {goal.remaining > 0 && pace != null && (
        <View style={styles.paceRow}>
          <Text style={styles.paceLabel}>Needed pace, estimate</Text>
          <Text style={styles.paceValue}>{shown(rp(pace), hidden)} / month</Text>
        </View>
      )}

      {/* CTA when not linked */}
      {goal.mode === 'account' && goal.account_id == null && (
        <Text style={styles.linkCTA}>{goalLinkCTA()}</Text>
      )}
    </Pressable>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: goals = [], isLoading } = useGoalProgress();
  const { data: overview } = useAccountsOverview();

  // Build a map: account_id -> account.name for quick lookup
  const accountMap = new Map<number, string>();
  if (overview) {
    for (const group of overview.groups) {
      for (const acc of group.accounts) {
        accountMap.set(acc.id, acc.name);
      }
    }
  }

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

        {goals.map(goal => {
          const accountName = goal.account_id ? accountMap.get(goal.account_id) : undefined;
          return <GoalItem key={goal.id} goal={goal} accountName={accountName} onPress={() => onEdit(goal.id)} />;
        })}

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
  content: { paddingHorizontal: 20, gap: 20, paddingTop: 12 },

  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  goalItem: { gap: 6, paddingVertical: 8 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  nameCol: { flex: 1, gap: 2 },
  goalName: { ...MonoText.bodyStrong, color: MonoColors.text, fontSize: 16 },
  sourceNote: { ...MonoText.caption, color: MonoColors.textMeta },
  targetDate: { ...MonoText.bodyS, color: MonoColors.textSecond },

  amount: { marginTop: 4 },
  ofTarget: { ...MonoText.bodyS, color: MonoColors.textSecond, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  percentText: { ...MonoText.bodyS, color: MonoColors.text },
  remainingText: { ...MonoText.bodyS, color: MonoColors.textSecond },

  paceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  paceLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
  paceValue: { ...MonoText.bodyS, color: MonoColors.accent },

  linkCTA: { ...MonoText.bodyS, color: MonoColors.accent, marginTop: 4 },

  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 18 },

  addButton: { marginTop: 8 },
});
