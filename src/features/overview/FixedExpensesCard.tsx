// "Fixed expenses": the card with the 1.5 gold frame. One row per expense due today with
// "Review and record", then the next one coming up. Fixed expenses are templates — nothing
// is written from here (CLAUDE.md rule 10); the button opens the confirm flow.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import type { RecurringDueRow } from '@/data/repo/recurring';
import {
  dueTodayLabel,
  fixedExpensesLabel,
  nextDueLabel,
  noDueExpensesMessage,
  recurringAccessibilityLabel,
  reviewAndRecordLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface FixedExpensesCardProps {
  dueToday: RecurringDueRow[];
  nextDue?: RecurringDueRow;
  onOpen: () => void;
}

export function FixedExpensesCard({ dueToday, nextDue, onOpen }: FixedExpensesCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  return (
    <Card outlined style={styles.card} testID="overview-fixed-expenses">
      <Text style={styles.title} accessibilityRole="header">
        {fixedExpensesLabel()}
      </Text>
      {dueToday.length === 0 && !nextDue ? (
        <Text style={styles.empty}>{noDueExpensesMessage()}</Text>
      ) : (
        <>
          {dueToday.map(due => (
            <Pressable
              key={due.recurring_id}
              onPress={onOpen}
              accessibilityRole="button"
              accessibilityLabel={recurringAccessibilityLabel(due.name, dueTodayLabel(), shown(rp(due.amount), hidden))}
              style={styles.row}
              testID={`overview-recurring-${due.recurring_id}`}
            >
              <View style={styles.left}>
                <Text style={styles.name}>{due.name}</Text>
                <Text style={styles.due}>{dueTodayLabel()}</Text>
              </View>
              <View style={styles.right}>
                <Amount value={due.amount} variant="figureRow" />
                <Button label={reviewAndRecordLabel()} variant="secondary" onPress={onOpen} style={styles.button} />
              </View>
            </Pressable>
          ))}
          {nextDue && <Text style={styles.next}>{nextDueLabel(nextDue.name, nextDue.due_on, shown(rp(nextDue.amount), hidden))}</Text>}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  left: { flex: 1, gap: 4 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  due: { ...MonoText.caption, color: MonoColors.textMeta },
  right: { alignItems: 'flex-end', gap: 8 },
  button: { minWidth: 120 },
  next: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
