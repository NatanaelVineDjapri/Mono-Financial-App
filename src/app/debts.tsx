// Utang piutang (/debts, from More): what is owed to you, what you owe, and the settled ones below.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { today as todayLocal } from '@/core/clock';
import { formatShortDate } from '@/core/date';
import { debtTotals, type DebtRow } from '@/domain/debts';
import { DebtHeader } from '@/features/debts/parts';
import { useDebts } from '@/features/debts/useDebts';
import {
  debtDueOn,
  debtOverdue,
  debtPaidOff,
  debtsAdd,
  debtsEmptyBody,
  debtsEmptyTitle,
  debtsIOwe,
  debtsLoadError,
  debtsOwedToMe,
  debtsSettled,
  debtsTitle,
  retryLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Row({ debt, last, onPress }: { debt: DebtRow; last: boolean; onPress: () => void }) {
  const paid = debt.remaining === 0;
  const overdue = !paid && debt.due_on != null && debt.due_on < todayLocal();
  const sub = paid ? debtPaidOff() : debt.due_on ? (overdue ? debtOverdue : debtDueOn)(formatShortDate(debt.due_on)) : formatShortDate(debt.started_on);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${debt.person}, ${sub}`} style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]} testID={`debt-row-${debt.account_id}`}>
      <View style={styles.rowText}>
        <Text style={styles.name}>{debt.person}</Text>
        <View style={styles.subLine}>
          {overdue && <Icon name="alert" size={16} color={MonoColors.negative} />}
          <Text style={[styles.sub, overdue && styles.overdue]}>{sub}</Text>
        </View>
      </View>
      <Amount value={paid ? debt.total : debt.remaining} variant="figureRow" style={paid ? { color: MonoColors.textSecond } : undefined} />
      <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
    </Pressable>
  );
}

function Section({ title, total, rows, onOpen }: { title: string; total?: number; rows: DebtRow[]; onOpen: (id: number) => void }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          {title}
        </Text>
        {total != null && <Amount value={total} variant="figureRow" />}
      </View>
      <View style={styles.card}>
        {rows.map((debt, i) => (
          <Row key={debt.account_id} debt={debt} last={i === rows.length - 1} onPress={() => onOpen(debt.account_id)} />
        ))}
      </View>
    </View>
  );
}

export default function DebtsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isError, refetch } = useDebts();
  const open = (id: number) => router.push(`/debt/${id}` as never);
  const debts = data ?? [];
  const totals = debtTotals(debts);
  const owing = (direction: DebtRow['direction']) => debts.filter(d => d.direction === direction && d.remaining > 0);

  return (
    <View style={styles.screen}>
      <DebtHeader title={debtsTitle()} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {isError && (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>{debtsLoadError()}</Text>
            <Button label={retryLabel()} onPress={() => void refetch()} />
          </View>
        )}
        {data && debts.length === 0 && (
          <View style={styles.empty} testID="debts-empty">
            <Icon name="transfer" size={26} color={MonoColors.textSecond} />
            <Text style={styles.emptyTitle}>{debtsEmptyTitle()}</Text>
            <Text style={styles.emptyBody}>{debtsEmptyBody()}</Text>
          </View>
        )}
        <Section title={debtsOwedToMe()} total={totals.owedToMe} rows={owing('lent')} onOpen={open} />
        <Section title={debtsIOwe()} total={totals.iOwe} rows={owing('borrowed')} onOpen={open} />
        <Section title={debtsSettled()} rows={debts.filter(d => d.remaining === 0)} onOpen={open} />
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        <Button label={debtsAdd()} icon="plus" onPress={() => router.push('/debt/new' as never)} testID="debts-add" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 20 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  pressed: { opacity: 0.8 },
  rowText: { flex: 1, gap: 2 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { ...MonoText.caption, color: MonoColors.textMeta, flexShrink: 1 },
  overdue: { color: MonoColors.negative },
  empty: { alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  bar: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: MonoColors.border },
});
