// Goals screen (DESIGN.md "G. Goals"). Back arrow returns to More.
// Progress is always read from v_goal_progress — never typed in.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeaderButton } from '@/components/HeaderButton';
import { HeaderRow } from '@/components/HeaderRow';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import type { GoalProgressRow } from '@/data/repo/goals';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useGoalProgress } from '@/features/goals/useGoals';
import { fullMonthsUntil, neededGoalPace } from '@/domain/goalMath';
import {
    addGoalLabel,
    goalAchieved,
    goalAccountLinkedLabel,
    goalCalculatedLabel,
    goalLinkCTA,
    goalNeededPaceLabel,
    goalNotLinkedLabel,
    goalOfTargetLabel,
  goalRemainingLabel,
    goalCompleteLabel,
    goalsEmptyBody,
    goalsEmptyTitle,
    goalsFooterNote,
    goalsTitle,
    goalBackLabel,
    goalBackText,
    goalNoTargetDate,
    goalPastDueLabel,
    goalTargetAccessibilityLabel,
    goalTargetDateLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

interface GoalCardProps {
  goal: GoalProgressRow;
  accountName?: string;
  onPress: () => void;
}

function GoalCard({ goal, accountName, onPress }: GoalCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const percentBp = Math.min(10000, Math.max(0, goal.progress_bp));
  const isAchieved = goal.current_amount >= goal.target_amount;
  const today = new Date().toISOString().slice(0, 10);
  const ml = goal.target_date ? fullMonthsUntil(today, goal.target_date) : null;
  const pace = neededGoalPace(goal.remaining, ml);
  const isPastDue = !!goal.target_date && goal.target_date < today && !isAchieved;

  // Not linked: dark card with "Belum tertaut ke akun" message
  const isNotLinked = goal.mode === 'account' && goal.account_id == null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={goalTargetAccessibilityLabel(goal.name, shown(rp(goal.current_amount, false), hidden), shown(rp(goal.target_amount, false), hidden), isAchieved ? goalAchieved() : pct(percentBp))}
      testID={`goal-card-${goal.id}`}
    >
      <Card style={isNotLinked ? styles.cardNotLinked : styles.card}>
        {/* Top row: name + target date */}
        <View style={styles.cardHead}>
          <Text style={styles.goalName} numberOfLines={1} testID={`goal-name-${goal.id}`}>
            {goal.name}
          </Text>
          <Text style={styles.targetDate}>{goal.target_date ? goalTargetDateLabel(formatShortDate(goal.target_date)) : goalNoTargetDate()}</Text>
        </View>

        <View style={styles.linkRow}>
          <Icon name="info" size={16} color={MonoColors.textMeta} />
          <Text style={styles.linkText} numberOfLines={1}>
            {goal.mode === 'total_assets'
              ? goalCalculatedLabel()
              : isNotLinked
                ? goalNotLinkedLabel()
                : goalAccountLinkedLabel(accountName ?? '')}
          </Text>
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
                {` ${goalOfTargetLabel(shown(rp(goal.target_amount, false), hidden))}`}
              </Text>
            </View>

            {/* Progress bar emas */}
            <ProgressBar
              valueBp={percentBp}
              label={goal.name}
              capAtFull
              accessibilityLabel={`${goal.name} kemajuan`}
              style={styles.progress}
              testID={`goal-progress-${goal.id}`}
            />

            {/* Meta rows */}
            <View style={styles.metaContainer}>
              {isAchieved ? (
                <Text style={styles.achievedLabel}>{goalAchieved()}</Text>
              ) : (
                <>
                  <View style={styles.metaRow}>
                    <Text style={styles.completeText}>{goalCompleteLabel(shownPct(pct(percentBp), hidden))}</Text>
                    <Text style={styles.remainingText}>{goalRemainingLabel(shown(rp(goal.remaining), hidden))}</Text>
                  </View>
                  {isPastDue ? (
                    <View style={styles.statusRow}><Icon name="info" size={16} color={MonoColors.textMeta} /><Text style={styles.paceText}>{goalPastDueLabel()}</Text></View>
                  ) : pace != null ? (
                    <View style={styles.paceRow}><Text style={styles.paceText}>{goalNeededPaceLabel('')}</Text><Text style={styles.paceValue}>{shown(rp(pace), hidden)} / bulan</Text></View>
                  ) : null}
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
      <View testID="goals-header" style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={goalBackLabel()}
          hitSlop={4}
          android_ripple={undefined}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          testID="goals-back"
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{goalBackText()}</Text>
        </Pressable>
      </View>
      <HeaderRow title={goalsTitle()} right={<HeaderButton icon="plus" label={addGoalLabel()} onPress={onAdd} testID="goals-add" />} withTopInset={false} />

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
          <Button
            label={addGoalLabel()}
            icon="plus"
            onPress={onAdd}
            style={styles.addButton}
            testID="goals-add-bottom"
          />
        )}

        {goals.length > 0 && (
          <View style={styles.footer}>
            <Icon name="info" size={16} color={MonoColors.textMeta} />
            <Text style={styles.footerNote}>{goalsFooterNote()}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, paddingBottom: 0 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backPressed: { opacity: 0.7 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16, gap: 12 },

  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  card: { padding: 16, gap: 9, borderRadius: 20 },
  cardNotLinked: { backgroundColor: '#101011', padding: 16, borderRadius: 20 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  goalName: { ...MonoText.bodyStrong, color: MonoColors.text, fontSize: 13, flex: 1 },
  targetDate: { ...MonoText.caption, color: MonoColors.textSecond },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkText: { ...MonoText.caption, color: MonoColors.textMeta },

  notLinkedText: { ...MonoText.body, color: MonoColors.textSecond },

  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  currentAmount: { ...MonoText.figureM, color: MonoColors.text, fontSize: 18 },
  ofTargetInline: { ...MonoText.bodyS, color: MonoColors.textSecond },

  progress: { marginTop: 4 },

  metaContainer: { gap: 2, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completeText: { ...MonoText.bodyS, color: MonoColors.text, fontWeight: '700' },
  achievedLabel: { ...MonoText.bodyStrong, color: MonoColors.accent },
  remainingText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  paceText: { ...MonoText.bodyS, color: MonoColors.text },
  paceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 8 },
  paceValue: { ...MonoText.bodyS, color: MonoColors.text, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 8 },

  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 15, fontSize: 10 },

  addButton: { marginTop: 4 },
});
