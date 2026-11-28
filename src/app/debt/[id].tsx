// One debt (/debt/[id]): what remains, a payment (all of what remains by default, or part of it), the history, delete.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { nowIso, today as todayLocal } from '@/core/clock';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { deleteDebt, payDebt, type DebtError } from '@/domain/debts';
import { DebtHeader, PickRow } from '@/features/debts/parts';
import { useDebt, useDebtAccounts } from '@/features/debts/useDebts';
import { AmountCard, ErrorLine } from '@/features/transactions/form/formParts';
import { AccountSheet, DateSheet } from '@/features/transactions/form/formSheets';
import {
  cancelLabel,
  debtAccountLabel,
  debtDateLabel,
  debtDelete,
  debtDeleteBody,
  debtDeleteTitle,
  debtDueOn,
  debtErrorText,
  debtHistory,
  debtMoveText,
  debtNotFound,
  debtOfTotal,
  debtOverdue,
  debtPaidOff,
  debtPayButton,
  debtPayTitle,
  debtPickAccount,
  debtRemaining,
  debtsTitle,
  removeConfirmLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function DebtScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const hidden = useHideAmounts(s => s.hidden);
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, isLoading } = useDebt(id);
  const { data: rows } = useDebtAccounts();
  const accounts = useMemo(() => (rows ?? []).map(a => ({ id: a.id, name: a.name, type: a.type, icon: a.icon, balance: a.balance, openingDate: a.opening_date })), [rows]);
  const today = useMemo(() => todayLocal(), []);

  const [typed, setTyped] = useState<number | null>(null); // null: all of what remains
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<'account' | 'date' | null>(null);
  const [error, setError] = useState<DebtError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const debt = data?.debt;
  if (isLoading || !data) return <View style={styles.screen} />;
  if (!debt) {
    return (
      <View style={styles.screen}>
        <DebtHeader title={debtsTitle()} onBack={() => router.back()} />
        <Text style={styles.missing}>{debtNotFound()}</Text>
      </View>
    );
  }

  const lent = debt.direction === 'lent';
  const amount = typed ?? debt.remaining;
  // the account the money moved through last, until another is picked
  const lastName = data.moves[data.moves.length - 1]?.account_name;
  const account = accounts.find(a => a.id === accountId) ?? accounts.find(a => a.name === lastName) ?? accounts[0];
  const overdue = debt.remaining > 0 && debt.due_on != null && debt.due_on < today;

  const pay = async () => {
    if (saving) return;
    setSaving(true);
    const result = await payDebt(db, id, { amount, accountId: account?.id ?? null, date, description: debtMoveText(lent, true, debt.person) }, today, nowIso());
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setTyped(null);
    setError(null);
    await invalidateAfterWrite(queryClient);
  };

  const remove = async () => {
    setConfirming(false);
    const result = await deleteDebt(db, id);
    if (!result.ok) return setError(result.error);
    await invalidateAfterWrite(queryClient);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <DebtHeader title={debt.person} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card} testID="debt-summary">
          <Text style={styles.label}>{debt.remaining === 0 ? debtPaidOff() : debtRemaining()}</Text>
          <Amount value={debt.remaining} variant="figureCard" />
          <Text style={styles.caption}>{debtOfTotal(shown(rp(debt.total), hidden))}</Text>
          {debt.due_on && debt.remaining > 0 && <Text style={[styles.caption, overdue && styles.overdue]}>{(overdue ? debtOverdue : debtDueOn)(formatShortDate(debt.due_on))}</Text>}
          {!!debt.note && <Text style={styles.caption}>{debt.note}</Text>}
        </View>

        {debt.remaining > 0 && (
          <View style={styles.section} testID="debt-pay">
            <Text style={styles.heading} accessibilityRole="header">
              {debtPayTitle(lent)}
            </Text>
            <AmountCard value={amount} onChange={value => { setTyped(value); setError(null); }} onBlur={() => undefined} label="amount" quickAdds={[]} />
            <PickRow label={debtAccountLabel(!lent)} value={account?.name ?? debtPickAccount()} empty={!account} onPress={() => setSheet('account')} testID="debt-account" />
            <PickRow label={debtDateLabel()} value={formatShortDate(date)} onPress={() => setSheet('date')} testID="debt-date" />
            <Button label={debtPayButton()} onPress={() => void pay()} disabled={saving} testID="debt-pay-save" />
          </View>
        )}
        {error && <ErrorLine error={{ text: debtErrorText(error) }} testID="debt-error" />}

        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {debtHistory()}
          </Text>
          {data.moves.map(move => (
            <Pressable key={move.id} onPress={() => router.push(`/tx/${move.id}` as never)} accessibilityRole="button" style={styles.move} testID={`debt-move-${move.id}`}>
              <View style={styles.moveText}>
                <Text style={styles.moveName}>{debtMoveText(lent, move.repayment === 1, debt.person)}</Text>
                <Text style={styles.caption}>
                  {formatShortDate(move.occurred_on)} · {move.account_name}
                </Text>
              </View>
              <Amount value={move.amount} variant="figureRow" />
            </Pressable>
          ))}
        </View>

        <Button label={debtDelete()} variant="secondary" onPress={() => setConfirming(true)} testID="debt-delete" />
      </ScrollView>

      <AccountSheet
        visible={sheet === 'account'}
        role="account"
        accounts={accounts}
        selectedId={account?.id ?? null}
        onSelect={next => {
          setAccountId(next);
          setError(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'date'}
        selected={date}
        today={today}
        onSelect={next => {
          setDate(next);
          setError(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ConfirmDialog
        visible={confirming}
        icon="trash"
        title={debtDeleteTitle()}
        message={[{ text: debtDeleteBody() }]}
        cancelLabel={cancelLabel()}
        confirmLabel={removeConfirmLabel()}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
        testID="debt-delete-dialog"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 20 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, padding: 16, gap: 4 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  overdue: { color: MonoColors.negative },
  section: { gap: 12 },
  heading: { ...MonoText.titleM, color: MonoColors.text },
  move: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: MonoColors.border, paddingVertical: 8 },
  moveText: { flex: 1, gap: 2 },
  moveName: { ...MonoText.body, color: MonoColors.text },
  missing: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center', padding: 32 },
});
