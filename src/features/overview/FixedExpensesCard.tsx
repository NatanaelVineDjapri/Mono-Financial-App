import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { daysBetween, formatShortDate, addDays } from '@/core/date';
import { today } from '@/core/clock';
import { rp, shown } from '@/core/money';
import type { RecurringDueRow, RecurringListRow } from '@/data/repo/recurring';
import { nextDue } from '@/domain/recurring';
import { recurringAllLabel, fixedExpensesLabel, noDueExpensesMessage, recurringNextOverview, recurringOthersWaiting, recurringOverdueOverview, recurringReviewAndRecord } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface FixedExpensesCardProps {
  due: RecurringDueRow[];
  templates: RecurringListRow[];
  onOpen: () => void;
  onRecord?: (due: RecurringDueRow) => void;
}

export function FixedExpensesCard({ due, templates, onOpen, onRecord }: FixedExpensesCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  if (templates.length === 0) return null;
  const oldest = due[0];
  const totalOthers = due.slice(1).reduce((sum, row) => sum + row.amount, 0);
  const next = templates.map(t => ({ ...t, dueOn: nextDue({ dayOfMonth: t.day_of_month, firstDueOn: t.first_due_on, endOn: t.end_on }, addDays(today(), 1)) }))
    .filter(t => t.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  const review = () => oldest && due.length === 1 && onRecord ? onRecord(oldest) : onOpen();
  return <View style={styles.section}>
    <View style={styles.heading}><Text style={styles.headingTitle}>{fixedExpensesLabel()}</Text><Pressable onPress={onOpen} style={styles.all}><Text style={styles.allText}>{recurringAllLabel()}</Text><Icon name="chevron-right" size={18} color={MonoColors.textSecond} /></Pressable></View>
    <View style={[styles.card, oldest && styles.waitingCard]}>
      {oldest ? <>
        <View style={styles.top}><View style={styles.iconTile}><Icon name="flow" size={20} color={MonoColors.textSecond} /></View><View style={styles.main}><Text style={styles.name}>{oldest.name}</Text><Text style={styles.sub}>{oldest.due_on === today() ? 'Jatuh tempo hari ini' : recurringOverdueOverview(daysBetween(oldest.due_on, today()))} · {oldest.category_name}</Text></View><Text style={styles.amount}>{shown(rp(oldest.amount), hidden)}</Text></View>
        {due.length > 1 && <Text style={styles.others}>{recurringOthersWaiting(due.length - 1)} · {shown(rp(totalOthers), hidden)}</Text>}
        <Button label={recurringReviewAndRecord()} onPress={review} style={styles.button} />
      </> : <><Text style={styles.empty}>{noDueExpensesMessage()}</Text>{next && <Text style={styles.next}>{recurringNextOverview(next.name, formatShortDate(next.dueOn!).replace(/ \d{4}$/, ''))}</Text>}</>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingTitle: { ...MonoText.titleM, color: MonoColors.text },
  all: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 2 },
  allText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  card: { backgroundColor: MonoColors.card, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: '#242425' },
  waitingCard: { backgroundColor: '#151516', borderColor: '#737373', borderWidth: 1.5 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconTile: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 2 },
  name: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text },
  sub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  amount: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text, fontVariant: ['tabular-nums'] as never },
  others: { ...MonoText.bodyS, color: MonoColors.textSecond },
  button: { height: 44 },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  next: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
