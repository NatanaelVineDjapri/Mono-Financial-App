// Shared confirmation sheet for fixed expenses — mounted once in _layout.tsx so every
// entry point (list, Overview card, notification tap) uses the same UI and logic.
// CLAUDE.md rule 10: confirm writes expense + event in one exclusive transaction.
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { nowIso } from '@/core/clock';
import { addDays, formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { confirmRecurring, nextDue, skipRecurring } from '@/domain/recurring';
import { deleteTransaction } from '@/domain/transactions';
import {
  recurringAfter,
  recurringAmount,
  recurringCategory,
  recurringConfirmDue,
  recurringConfirmTitle,
  recurringDate,
  recurringPayFrom,
  recurringRecord,
  recurringSavedToast,
  recurringSkip,
  recurringSkipNote,
  recurringUsualAmount,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import { closeConfirmSheet, useConfirmSheet } from './recurringConfirmStore';

export function RecurringConfirmHost() {
  const due = useConfirmSheet(s => s.due);
  if (!due) return null;
  return <Sheet due={due} />;
}

function Sheet({ due }: { due: NonNullable<ReturnType<typeof useConfirmSheet['getState']>['due']> }) {
  const db = useDb();
  const qc = useQueryClient();
  const hidden = useHideAmounts(s => s.hidden);
  const [amount, setAmount] = useState(due.amount);
  const [busy, setBusy] = useState(false);

  // Fetch live account balance
  const [bal, setBal] = useState<number | null>(null);
  const [acctName, setAcctName] = useState('…');
  useState(() => {
    db.getFirstAsync<{ name: string; balance: number }>(
      'select name, balance from v_account_balance where id = $id',
      { $id: due.account_id },
    ).then(row => {
      if (row) { setBal(row.balance); setAcctName(row.name); }
    });
  });

  const following = nextDue(
    { dayOfMonth: due.day_of_month, firstDueOn: due.due_on },
    addDays(due.due_on, 1),
  );

  const save = async () => {
    setBusy(true);
    try {
      const result = await confirmRecurring(
        db,
        { recurringId: due.recurring_id, dueOn: due.due_on, accountId: due.account_id, categoryId: due.category_id, amount, date: due.due_on, description: due.name },
        nowIso(),
      );
      await qc.invalidateQueries();
      closeConfirmSheet();
      showToast(
        recurringSavedToast(acctName, shown(rp(result.balanceAfter), hidden)),
        {
          actionLabel: 'Urungkan',
          onAction: async () => {
            await deleteTransaction(db, result.transactionId);
            await qc.invalidateQueries();
          },
        },
      );
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await skipRecurring(db, due.recurring_id, due.due_on, nowIso());
    await qc.invalidateQueries();
    closeConfirmSheet();
  };

  const balanceAfterPreview = bal !== null ? bal - amount : null;

  return (
    <Modal transparent animationType="slide" onRequestClose={closeConfirmSheet}>
      <View style={s.scrim}>
        <ScrollView
          style={s.sheetScroll}
          contentContainerStyle={s.sheet}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={closeConfirmSheet} style={s.closeBtn} hitSlop={8}>
            <Icon name="close" color={MonoColors.text} />
          </Pressable>
          <Text style={s.title}>{recurringConfirmTitle(due.name)}</Text>
          <Text style={s.sub}>{recurringConfirmDue(formatShortDate(due.due_on))}</Text>

          <AmountField label={recurringAmount()} value={amount} onChangeValue={setAmount} helperText={recurringUsualAmount()} />
          <InfoRow label={recurringCategory()} value={due.category_name} />
          <InfoRow label={recurringPayFrom()} value={acctName} />
          <InfoRow label={recurringDate()} value={formatShortDate(due.due_on)} />

          {balanceAfterPreview !== null && (
            <Text style={s.after}>{recurringAfter(acctName, shown(rp(balanceAfterPreview), hidden))}</Text>
          )}

          <Button
            label={recurringRecord()}
            onPress={() => void save()}
            disabled={amount <= 0 || (bal !== null && amount > bal)}
            loading={busy}
          />
          <Button label={recurringSkip()} variant="secondary" onPress={() => void skip()} />
          <Text style={s.note}>
            {recurringSkipNote(following ? formatShortDate(following) : '—')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.sub}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheetScroll: { flexGrow: 0 },
  sheet: { backgroundColor: MonoColors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, paddingBottom: 36 },
  closeBtn: { position: 'absolute', right: 12, top: 12, padding: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text, paddingRight: 36 },
  sub: { ...MonoText.bodyS, color: MonoColors.textMeta },
  infoRow: { borderBottomWidth: 1, borderBottomColor: MonoColors.border, paddingVertical: 8, gap: 2 },
  infoValue: { ...MonoText.body, color: MonoColors.text },
  after: { ...MonoText.bodyStrong, color: MonoColors.text },
  note: { ...MonoText.bodyS, color: MonoColors.textMeta, textAlign: 'center' },
});
