// A new debt (/debt/new): lent or borrowed, who, how much, which account, when, and an optional due date.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Icon } from '@/components/Icon';
import { Segmented } from '@/components/Segmented';
import { nowIso, today as todayLocal } from '@/core/clock';
import { formatShortDate } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { createDebt, type DebtDirection, type DebtError } from '@/domain/debts';
import { DebtHeader, PickRow, TextField } from '@/features/debts/parts';
import { useDebtAccounts } from '@/features/debts/useDebts';
import { AmountCard, ErrorLine } from '@/features/transactions/form/formParts';
import { AccountSheet, DateSheet } from '@/features/transactions/form/formSheets';
import {
  debtAccountLabel,
  debtAccountNameFor,
  debtBorrowed,
  debtDateLabel,
  debtDueClear,
  debtDueLabel,
  debtDueNone,
  debtErrorText,
  debtLent,
  debtMoveText,
  debtNewTitle,
  debtNoteLabel,
  debtPersonLabel,
  debtPersonPlaceholder,
  debtPickAccount,
  debtSave,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';

export default function NewDebtScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const { data: rows } = useDebtAccounts();
  const accounts = useMemo(() => (rows ?? []).map(a => ({ id: a.id, name: a.name, type: a.type, icon: a.icon, balance: a.balance, openingDate: a.opening_date })), [rows]);
  const today = useMemo(() => todayLocal(), []);

  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'account' | 'date' | 'due' | null>(null);
  const [error, setError] = useState<DebtError | null>(null);
  const [saving, setSaving] = useState(false);

  const lent = direction === 'lent';
  const account = accounts.find(a => a.id === accountId) ?? accounts[0];

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const name = person.trim();
    const result = await createDebt(
      db,
      { direction, person: name, amount, accountId: account?.id ?? null, date, dueOn, note, accountName: debtAccountNameFor(lent, name), description: debtMoveText(lent, false, name) },
      today,
      nowIso(),
    );
    setSaving(false);
    if (!result.ok) return setError(result.error);
    await invalidateAfterWrite(queryClient);
    router.back();
  };
  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setError(null);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <DebtHeader title={debtNewTitle()} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[
            { value: 'lent', label: debtLent() },
            { value: 'borrowed', label: debtBorrowed() },
          ]}
          value={direction}
          onChange={value => changed(setDirection)(value as DebtDirection)}
          testID="debt-direction"
        />
        <TextField label={debtPersonLabel(lent)} value={person} onChange={changed(setPerson)} placeholder={debtPersonPlaceholder()} maxLength={30} testID="debt-person" />
        <AmountCard value={amount} onChange={changed(setAmount)} onBlur={() => undefined} label="amount" quickAdds={[]} />
        <PickRow label={debtAccountLabel(lent)} value={account?.name ?? debtPickAccount()} empty={!account} onPress={() => setSheet('account')} testID="debt-account" />
        <PickRow label={debtDateLabel()} value={formatShortDate(date)} onPress={() => setSheet('date')} testID="debt-date" />
        <PickRow label={debtDueLabel()} value={dueOn ? formatShortDate(dueOn) : debtDueNone()} empty={!dueOn} onPress={() => setSheet('due')} testID="debt-due">
          {dueOn && (
            <IconButton label={debtDueClear()} onPress={() => setDueOn(null)} testID="debt-due-clear">
              <Icon name="close" size={16} color={MonoColors.textSecond} />
            </IconButton>
          )}
        </PickRow>
        <TextField label={debtNoteLabel()} value={note} onChange={setNote} maxLength={120} testID="debt-note" />
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {error && <ErrorLine error={{ text: debtErrorText(error) }} testID="debt-error" />}
        <Button label={debtSave()} onPress={() => void save()} disabled={saving} testID="debt-save" />
      </View>

      <AccountSheet
        visible={sheet === 'account'}
        role="account"
        accounts={accounts}
        selectedId={account?.id ?? null}
        onSelect={id => {
          changed(setAccountId)(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'date'}
        selected={date}
        today={today}
        onSelect={next => {
          changed(setDate)(next);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'due'}
        selected={dueOn ?? date}
        today={today}
        allowFuture
        onSelect={next => {
          changed(setDueOn)(next);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 16 },
  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: MonoColors.border },
});
