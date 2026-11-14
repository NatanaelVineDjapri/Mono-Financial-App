// Create / edit a fixed expense template (PAGES.md L2 / board "Recurring-Edit").
// Route: /recurring/edit (new)  or  /recurring/edit?id=N (edit).
// Confirm-first: this only saves the template; nothing hits the ledger until the user
// confirms a due date (CLAUDE.md rule 10).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { AccountLogo } from '@/components/AccountLogo';
import { MonoSwitch } from '@/components/MonoSwitch';
import { today, nowIso } from '@/core/clock';
import { formatShortDate } from '@/core/date';
import { rp } from '@/core/money';
import { DateSheet } from '@/features/recurring/DateSheet';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccountsForForm } from '@/data/repo/accounts';
import { listCategories } from '@/data/repo/categories';
import { getRecurring } from '@/data/repo/recurring';
import { guessAccountLogo } from '@/features/accounts/logos';
import { archiveRecurring, createRecurring, updateRecurring } from '@/domain/recurring';
import {
  cancelLabel,
  closeLabel,
  recurringAccountRequired,
  recurringAmount,
  recurringAmountRequired,
  recurringAmountVaries,
  recurringAmountVariesHint,
  recurringCategory,
  recurringClampHint,
  recurringDay,
  recurringEditTitle,
  recurringEndInvalid,
  recurringEnds,
  recurringFirstDue,
  recurringName,
  recurringNameHint,
  recurringNameRequired,
  recurringNewTitle,
  recurringNoEnd,
  recurringPayFrom,
  recurringRemind,
  recurringRemindHint,
  recurringRepeats,
  recurringSave,
  recurringStop,
  recurringStopBody,
  recurringStopTitle,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const BAR_BORDER = '#272728';

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[s.chip, selected && s.chipSelected]}
    >
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// ── Day stepper ───────────────────────────────────────────────────────────────

function DayStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(1, value - 1))}
        style={s.stepBtn}
        accessibilityRole="button"
        accessibilityLabel="Kurangi tanggal"
      >
        <Icon name="minus" size={18} color={MonoColors.text} />
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(31, value + 1))}
        style={s.stepBtn}
        accessibilityRole="button"
        accessibilityLabel="Tambah tanggal"
      >
        <Icon name="plus" size={18} color={MonoColors.text} />
      </Pressable>
    </View>
  );
}

// ── Switch row ────────────────────────────────────────────────────────────────

function SwitchRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.switchRow}>
      <View style={s.switchText}>
        <Text style={s.switchLabel}>{label}</Text>
        <Text style={s.switchHint}>{hint}</Text>
      </View>
      <MonoSwitch label={label} value={value} onValueChange={onChange} />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RecurringEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recurringId = id ? Number(id) : undefined;
  const isEditing = recurringId != null;
  const db = useDb();
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: [...queryKeys.recurring, recurringId],
    enabled: recurringId != null,
    queryFn: () => getRecurring(db, recurringId!),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'for-recurring'],
    queryFn: () => listAccountsForForm(db),
  });

  const { data: categories = [] } = useQuery({
    queryKey: [...queryKeys.categories, 'expense'],
    queryFn: () => listCategories(db, { kind: 'expense' }),
  });

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [varies, setVaries] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [day, setDay] = useState(1);
  const [firstDue, setFirstDue] = useState(today());
  const [endOn, setEndOn] = useState('');
  const [remind, setRemind] = useState(true);
  const [stopVisible, setStopVisible] = useState(false);
  const [firstDueOpen, setFirstDueOpen] = useState(false);
  const [endOnOpen, setEndOnOpen] = useState(false);
  const initializedRef = useRef(false);

  // Errors — only shown after first save attempt
  const [nameErr, setNameErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [accountErr, setAccountErr] = useState('');
  const [endErr, setEndErr] = useState('');

  // Populate from existing when editing (once)
  useEffect(() => {
    if (!existing || initializedRef.current) return;
    setName(existing.name);
    setAmount(existing.amount);
    setVaries(!!existing.amount_varies);
    setCategoryId(existing.category_id);
    setAccountId(existing.account_id);
    setDay(existing.day_of_month);
    setFirstDue(existing.first_due_on);
    setEndOn(existing.end_on ?? '');
    setRemind(!!existing.remind);
    initializedRef.current = true;
  }, [existing]);

  const idrAccounts = accounts.filter(a => a.type !== 'forex');
  const selectedAccount = idrAccounts.find(a => a.id === accountId) ?? null;

  function validate(): boolean {
    let ok = true;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) { setNameErr(recurringNameRequired()); ok = false; }
    else setNameErr('');
    if (amount <= 0) { setAmountErr(recurringAmountRequired()); ok = false; }
    else setAmountErr('');
    if (accountId == null) { setAccountErr(recurringAccountRequired()); ok = false; }
    else setAccountErr('');
    if (endOn && endOn < firstDue) { setEndErr(recurringEndInvalid()); ok = false; }
    else setEndErr('');
    return ok;
  }

  const onSave = useCallback(async () => {
    if (!validate()) return;
    if (accountId == null || categoryId == null) return;
    const input = {
      name: name.trim(), amount, amountVaries: varies, accountId,
      categoryId, dayOfMonth: day, firstDueOn: firstDue,
      endOn: endOn || null, remind,
    };
    if (isEditing && recurringId != null) {
      await updateRecurring(db, recurringId, input);
    } else {
      await createRecurring(db, input, nowIso());
    }
    await qc.invalidateQueries();
    router.back();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, amount, varies, accountId, categoryId, day, firstDue, endOn, remind, isEditing, recurringId]);

  const onStop = useCallback(async () => {
    if (!recurringId) return;
    setStopVisible(false);
    await archiveRecurring(db, recurringId);
    await qc.invalidateQueries();
    router.back();
  }, [db, qc, recurringId, router]);

  return (
    <KeyboardAvoidingView style={s.screen} behavior="padding">
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()}>
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={s.headerTitle}>
          {isEditing ? recurringEditTitle() : recurringNewTitle()}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Field
          label={recurringName()}
          placeholder={recurringNameHint()}
          value={name}
          onChangeText={t => { setName(t); setNameErr(''); }}
          error={nameErr || undefined}
          maxLength={40}
        />

        {/* Amount */}
        <AmountField
          label={recurringAmount()}
          value={amount}
          onChangeValue={v => { setAmount(v); setAmountErr(''); }}
          error={amountErr || undefined}
        />

        {/* Amount varies switch */}
        <SwitchRow
          label={recurringAmountVaries()}
          hint={recurringAmountVariesHint()}
          value={varies}
          onChange={setVaries}
        />

        {/* Category */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{recurringCategory()}</Text>
          <View style={s.chips}>
            {categories.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </View>
        </View>

        {/* Pay from (IDR accounts only) */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{recurringPayFrom()}</Text>
          {idrAccounts.map(a => (
            <Pressable
              key={a.id}
              onPress={() => { setAccountId(a.id); setAccountErr(''); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: accountId === a.id }}
              style={[s.accountRow, accountId === a.id && s.accountRowSelected]}
            >
              <AccountLogo iconKey={a.icon ?? guessAccountLogo(a.name, a.type)} type={a.type} />
              <Text style={s.accountName}>{a.name}</Text>
              <Text style={s.accountBalance}>{rp(a.balance)}</Text>
            </Pressable>
          ))}
          {!!accountErr && <Text style={s.error}>{accountErr}</Text>}
          {selectedAccount && (
            <Text style={s.balanceNote}>Saldo {rp(selectedAccount.balance)}</Text>
          )}
        </View>

        {/* Repeats */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{recurringRepeats()}</Text>
          <View style={s.stepperRow}>
            <Text style={s.stepperLabel}>{recurringDay(day)}</Text>
            <DayStepper value={day} onChange={setDay} />
          </View>
          <Text style={s.hint}>{recurringClampHint()}</Text>
        </View>

        {/* First due */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{recurringFirstDue()}</Text>
          <Pressable
            onPress={() => setFirstDueOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={recurringFirstDue()}
            style={s.dateField}
          >
            <Text style={s.dateFieldText}>{formatShortDate(firstDue)}</Text>
            <Icon name="calendar" size={20} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* Ends */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{recurringEnds()}</Text>
          <Pressable
            onPress={() => setEndOnOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={recurringEnds()}
            style={s.dateField}
          >
            <Text style={[s.dateFieldText, !endOn && s.dateFieldPlaceholder]}>
              {endOn ? formatShortDate(endOn) : recurringNoEnd()}
            </Text>
            <Icon name="calendar" size={20} color={MonoColors.textSecond} />
          </Pressable>
          {!!endErr && <Text style={s.error}>{endErr}</Text>}
        </View>

        {/* Remind */}
        <SwitchRow
          label={recurringRemind()}
          hint={recurringRemindHint()}
          value={remind}
          onChange={setRemind}
        />

        {/* Stop (edit only) */}
        {isEditing && (
          <View style={s.stopRow}>
            <Icon name="info" size={16} color={MonoColors.textMeta} />
            <Text style={s.stopNote}>{recurringStopBody()}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 16 }]}>
        {isEditing ? (
          <Button label={recurringStop()} variant="secondary" onPress={() => setStopVisible(true)} style={s.barBtn} />
        ) : (
          <Button label={cancelLabel()} variant="secondary" onPress={() => router.back()} style={s.barBtn} />
        )}
        <Button label={recurringSave()} onPress={() => void onSave()} style={s.barBtn} />
      </View>

      <ConfirmDialog
        visible={stopVisible}
        icon="alert"
        title={recurringStopTitle(name.trim())}
        message={[{ text: recurringStopBody() }]}
        cancelLabel={cancelLabel()}
        confirmLabel={recurringStop()}
        onCancel={() => setStopVisible(false)}
        onConfirm={() => void onStop()}
      />

      <DateSheet
        visible={firstDueOpen}
        selected={firstDue}
        title={recurringFirstDue()}
        onSelect={d => { setFirstDue(d); setFirstDueOpen(false); }}
        onClose={() => setFirstDueOpen(false)}
      />
      <DateSheet
        visible={endOnOpen}
        selected={endOn}
        title={recurringEnds()}
        subtitle={recurringNoEnd()}
        optional
        onSelect={d => { setEndOn(d); setEndErr(''); setEndOnOpen(false); }}
        onClose={() => setEndOnOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },

  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 16,
    paddingBottom: 4,
  },
  headerTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1, paddingHorizontal: 4 },

  content: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },

  section: { gap: 8 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: MonoColors.text, backgroundColor: MonoColors.raised },
  chipText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  chipTextSelected: { color: MonoColors.text },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    gap: 10,
  },
  accountRowSelected: { borderColor: MonoColors.text },
  accountName: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  accountBalance: { ...MonoText.bodyS, color: MonoColors.textSecond, fontVariant: ['tabular-nums'] as never },
  balanceNote: { ...MonoText.caption, color: MonoColors.accent },
  error: { ...MonoText.bodyS, color: MonoColors.negative },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
  },
  stepperLabel: { ...MonoText.body, color: MonoColors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...MonoText.titleM, color: MonoColors.text, minWidth: 32, textAlign: 'center' },

  hint: { ...MonoText.caption, color: MonoColors.textMeta },

  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    gap: 8,
  },
  dateFieldText: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  dateFieldPlaceholder: { color: MonoColors.textDisabled },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...MonoText.body, color: MonoColors.text },
  switchHint: { ...MonoText.caption, color: MonoColors.textMeta },

  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stopNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },

  bar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BAR_BORDER,
    backgroundColor: MonoColors.bg,
  },
  barBtn: { flex: 1 },
});
