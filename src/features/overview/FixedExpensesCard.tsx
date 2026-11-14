import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { today } from '@/core/clock';
import { addDays, daysBetween, formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { RecurringDueRow, RecurringListRow } from '@/data/repo/recurring';
import { nextDue } from '@/domain/recurring';
import { openConfirmSheet } from '@/features/recurring/recurringConfirmStore';
import {
  fixedExpensesLabel,
  noDueExpensesMessage,
  recurringAllLabel,
  recurringNextOverview,
  recurringOthersWaiting,
  recurringOverdueOverview,
  recurringReviewAndRecord,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface FixedExpensesCardProps {
  due: RecurringDueRow[];
  templates: RecurringListRow[];
  onOpen: () => void;
}

export function FixedExpensesCard({ due, templates, onOpen }: FixedExpensesCardProps) {
  const hidden = useHideAmounts(s => s.hidden);

  // State (c): no templates — hide the whole section
  if (templates.length === 0) return null;

  const oldest = due[0];
  const restTotal = due.slice(1).reduce((sum, row) => sum + row.amount, 0);

  // "Berikutnya" for state (b)
  const tom = addDays(today(), 1);
  const next = templates
    .map(t => ({ ...t, dueOn: nextDue({ dayOfMonth: t.day_of_month, firstDueOn: t.first_due_on, endOn: t.end_on }, tom) }))
    .filter(t => t.dueOn)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];

  // N==1 opens sheet directly; N>1 opens list
  const handleReview = () => {
    if (oldest && due.length === 1) openConfirmSheet(oldest);
    else onOpen();
  };

  return (
    <View style={s.section}>
      <View style={s.heading}>
        <Text style={s.headingTitle}>{fixedExpensesLabel()}</Text>
        <Pressable onPress={onOpen} style={s.allBtn} hitSlop={8}>
          <Text style={s.allText}>{recurringAllLabel()}</Text>
          <Icon name="chevron-right" size={18} color={MonoColors.textSecond} />
        </Pressable>
      </View>

      {/* State (a): one or more due */}
      {oldest ? (
        <View style={s.waitingCard}>
          <View style={s.top}>
            <View style={s.iconTile}>
              <Icon name="flow" size={20} color={MonoColors.textSecond} />
            </View>
            <View style={s.main}>
              <Text style={s.name}>{oldest.name}</Text>
              <Text style={s.sub}>
                {oldest.due_on === today()
                  ? 'Jatuh tempo hari ini'
                  : recurringOverdueOverview(daysBetween(oldest.due_on, today()))}
                {' · '}{oldest.category_name}
              </Text>
            </View>
            <Text style={s.amount}>{shown(rp(oldest.amount), hidden)}</Text>
          </View>
          {due.length > 1 && (
            <Text style={s.others}>
              {recurringOthersWaiting(due.length - 1)} · {shown(rp(restTotal), hidden)}
            </Text>
          )}
          <Button label={recurringReviewAndRecord()} onPress={handleReview} style={s.btn} />
        </View>
      ) : (
        /* State (b): templates exist, nothing due */
        <View style={s.quietCard}>
          <Text style={s.empty}>{noDueExpensesMessage()}</Text>
          {next && (
            <Text style={s.next}>
              {recurringNextOverview(next.name, formatShortDate(next.dueOn!).replace(/ \d{4}$/, ''))}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: 16, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingTitle: { ...MonoText.titleM, color: MonoColors.text },
  allBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 2 },
  allText: { ...MonoText.bodyS, color: MonoColors.textSecond },

  // State (a) — waiting card: abu 1.5px border
  waitingCard: { backgroundColor: '#151516', borderColor: '#737373', borderWidth: 1.5, borderRadius: 16, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconTile: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 2 },
  name: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text },
  sub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  amount: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, lineHeight: 20, color: MonoColors.text, fontVariant: ['tabular-nums'] as never },
  others: { ...MonoText.bodyS, color: MonoColors.textSecond },
  btn: { height: 44 },

  // State (b) — quiet card: hairline border
  quietCard: { backgroundColor: MonoColors.card, borderColor: '#242425', borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  next: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
