// Goals screen (DESIGN.md "G. Goals"). Back arrow returns to More.
// Progress is always read from v_goal_progress — never typed in.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeaderButton } from '@/components/HeaderButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { GoalProgressRow } from '@/data/repo/goals';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useGoalProgress } from '@/features/goals/useGoals';
import {
    addGoalLabel,
    goalAchieved,
    goalLinkCTA,
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

function GoalCard({ goal, accountName, onPress }: GoalCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const percentBp = goal.progress_bp;
  const isAchieved = percentBp >= 10000;
  const ml = monthsLeft(goal.target_date);
  const pace = neededPace(goal.remaining, ml);

  // Not linked: dark card with "Belum tertaut ke akun" message
  const isNotLinked = goal.mode === 'account' && goal.account_id == null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`goal-card-${goal.id}`}
    >
      <Card style={isNotLinked ? styles.cardNotLinked : styles.card}>
        {/* Top row: name + target date */}
        <View style={styles.cardHead}>
          <Text style={styles.goalName} numberOfLines={1} testID={`goal-name-${goal.id}`}>
            {goal.name}
          </Text>
          {!!goal.target_date && (
            <Text style={styles.targetDate}>{`Target ${formatShortDate(goal.target_date)}`}</Text>
          )}
        </View>

        {isNotLinked ? (
          <Text style={styles.notLinkedText}>{goalLinkCTA()}</Text>
        ) : (
          <>
            {/* Amount row: current + "dari" + target on same baseline */}
            <View style={styles.amountRow}>
              <Text style={styles.currentAmount} testID={`goal-amount-${goal.id}`}>
                {shown(rp(goal.current_amount, false), hidden)}
              </Text>
              <Text style={styles.ofTargetInline}>
                {` dari ${shown(rp(goal.target_amount, false), hidden)}`}
              </Text>
            </View>

            {/* Progress bar emas */}
            <ProgressBar
              valueBp={percentBp}
              label={goal.name}
              style={styles.progress}
              testID={`goal-progress-${goal.id}`}
            />

            {/* Meta rows */}
            <View style={styles.metaContainer}>
              {isAchieved ? (
                <Text style={styles.achievedLabel}>{goalAchieved()}</Text>
              ) : (
                <>
                  <Text style={styles.remainingText}>
                    {goalRemainingLabel(shown(rp(goal.remaining), hidden))}
                  </Text>
                  {pace != null && goal.remaining > 0 && (
                    <Text style={styles.paceText}>
                      {`${shown(rp(pace), hidden)} / bulan`}
                    </Text>
                  )}
                </>
              )}
            </View>
          </>
        )}
      </Card>
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
          return <GoalCard key={goal.id} goal={goal} accountName={accountName} onPress={() => onEdit(goal.id)} />;
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
  content: { paddingHorizontal: 20, gap: 16, paddingTop: 12 },

  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  card: { padding: 16, gap: 12 },
  cardNotLinked: { backgroundColor: '#101011' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  goalName: { ...MonoText.bodyStrong, color: MonoColors.text, fontSize: 16, flex: 1 },
  targetDate: { ...MonoText.bodyS, color: MonoColors.textSecond },

  notLinkedText: { ...MonoText.body, color: MonoColors.textSecond },

  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  currentAmount: { ...MonoText.figureM, color: MonoColors.text },
  ofTargetInline: { ...MonoText.bodyS, color: MonoColors.textSecond },

  progress: { marginTop: 4 },

  metaContainer: { gap: 4, marginTop: 4 },
  achievedLabel: { ...MonoText.bodyStrong, color: MonoColors.accent },
  remainingText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  paceText: { ...MonoText.bodyS, color: MonoColors.text },

  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 18 },

  addButton: { marginTop: 8 },
});
