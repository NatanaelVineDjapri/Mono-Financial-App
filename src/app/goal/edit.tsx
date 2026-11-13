// Create / edit goal (DESIGN.md "G. Goals" — Goal-Edit board).
// Route: /goal/edit (new)  or  /goal/edit?id=N (edit).
// Progress is never typed in — always read from v_goal_progress.
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { HeaderButton } from '@/components/HeaderButton';
import { AccountLogo } from '@/components/AccountLogo';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccountsForForm } from '@/data/repo/accounts';
import type { GoalMode } from '@/data/repo/goals';
import { useGoalById, useGoalMutations } from '@/features/goals/useGoals';
import { GoalMonthSheet } from '@/features/goals/GoalMonthSheet';
import { guessAccountLogo } from '@/features/accounts/logos';
import {
    cancelLabel,
    closeLabel,
    editGoalTitle,
    goalAccountRequired,
    goalAmountRequired,
    goalCurrentBalanceNote,
    goalDeleteNote,
    goalDeleteLabel,
    goalDeleteConfirmTitle,
    goalDeleteConfirmBody,
    goalDeletedToast,
    goalAchievedPreview,
    goalChooseDate,
    goalMonthlyValue,
    goalLinkedAccountLabel,
    goalModeOneAccountLabel,
    goalModeOneAccountSub,
    goalModeTotalAssetsLabel,
    goalModeTotalAssetsSub,
    goalNameLabel,
    goalNamePlaceholder,
    goalNameRequired,
    goalNameTooLong,
    goalPreviewLabel,
    goalPreviewMonthsLeft,
    goalPreviewNeededPace,
    goalPreviewRemaining,
    goalPreviewSavedSoFar,
    goalProgressSourceLabel,
    goalTargetAmountLabel,
    goalTargetDateLabel2,
    newGoalTitle,
    saveGoalLabel,
    undoLabel,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// ── helpers ───────────────────────────────────────────────────────────────────

function monthsLeft(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth()),
  );
}

function neededPace(remaining: number, months: number): number | null {
  if (months <= 0) return null;
  return Math.ceil(remaining / months);
}

// ── Mode tile ─────────────────────────────────────────────────────────────────

function ModeTile({
  selected,
  label,
  sub,
  onPress,
  testID,
}: {
  selected: boolean;
  label: string;
  sub: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.modeTile, selected && styles.modeTileSelected]}
      testID={testID}
    >
      {selected && (
        <View style={styles.modeTileCheck}>
          <Icon name="check" size={16} color={MonoColors.bg} />
        </View>
      )}
      <Text style={[styles.modeTileLabel, selected && styles.modeTileLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.modeTileSub}>{sub}</Text>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GoalEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goalId = id ? Number(id) : undefined;
  const isEditing = goalId != null;

  const hidden = useHideAmounts(s => s.hidden);
  const { data: existing } = useGoalById(goalId);
  const { create, update, remove } = useGoalMutations();
  const db = useDb();

  // Form state — initialized from existing goal or defaults
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GoalMode>('total_assets');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [targetAmount, setTargetAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const initializedRef = useRef(false);

  // Errors
  const [nameErr, setNameErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [accountErr, setAccountErr] = useState('');

  // Load existing data into form when editing (once)
  useEffect(() => {
    if (!existing || initializedRef.current) return;
    setName(existing.name);
    setMode(existing.mode);
    setAccountId(existing.account_id);
    setTargetAmount(existing.target_amount);
    setTargetDate(existing.target_date ?? '');
    initializedRef.current = true;
  }, [existing]);

  // Accounts list for picker
  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'for-goal'],
    queryFn: () => listAccountsForForm(db),
  });

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  // Preview: use existing.current_amount/remaining when editing, else derive from account balance
  const previewCurrent =
    isEditing && existing
      ? existing.current_amount
      : mode === 'account' && selectedAccount
        ? selectedAccount.balance
        : null;

  const previewRemaining =
    targetAmount > 0 && previewCurrent != null
      ? Math.max(targetAmount - previewCurrent, 0)
      : null;

  const ml = targetDate ? monthsLeft(targetDate) : null;
  const pace =
    previewRemaining != null && ml != null ? neededPace(previewRemaining, ml) : null;

  // Validation
  function validate(): boolean {
    let ok = true;
    const trimmed = name.trim();
    if (!trimmed) { setNameErr(goalNameRequired()); ok = false; }
    else if (trimmed.length > 40) { setNameErr(goalNameTooLong()); ok = false; }
    else setNameErr('');

    if (targetAmount <= 0) { setAmountErr(goalAmountRequired()); ok = false; }
    else setAmountErr('');

    if (mode === 'account' && !accountId) { setAccountErr(goalAccountRequired()); ok = false; }
    else setAccountErr('');

    return ok;
  }

  const onSave = useCallback(async () => {
    if (!validate()) return;
    const input = {
      name: name.trim(),
      mode,
      accountId: mode === 'account' ? accountId : null,
      targetAmount,
      targetDate: targetDate || null,
    };
    if (isEditing && goalId != null) {
      await update.mutateAsync({
        id: goalId,
        patch: { name: input.name, targetAmount: input.targetAmount, targetDate: input.targetDate },
      });
    } else {
      await create.mutateAsync(input);
    }
    router.back();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mode, accountId, targetAmount, targetDate, isEditing, goalId]);

  const onDelete = useCallback(() => setDeleteDialogOpen(true), []);
  const confirmDelete = useCallback(async () => {
    if (goalId == null) return;
    const deleted = { name: name.trim(), mode, accountId, targetAmount, targetDate: targetDate || null };
    setDeleteDialogOpen(false);
    await remove.mutateAsync(goalId);
    showToast(goalDeletedToast(), {
      actionLabel: undoLabel(),
      onAction: () => { void create.mutateAsync(deleted); },
    });
    router.back();
  }, [accountId, create, goalId, mode, name, remove, router, targetAmount, targetDate]);

  const saving = create.isPending || update.isPending;

  const onMonthSelect = (month: string) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    setTargetDate(`${month}-${String(lastDay).padStart(2, '0')}`);
    setMonthSheetOpen(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()}>
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.headerTitle}>{isEditing ? editGoalTitle() : newGoalTitle()}</Text>
        {isEditing && (
          <HeaderButton icon="trash" label={goalDeleteLabel()} onPress={onDelete} testID="goal-delete" />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Field
          label={goalNameLabel()}
          placeholder={goalNamePlaceholder()}
          value={name}
          onChangeText={t => { setName(t); setNameErr(''); }}
          error={nameErr || undefined}
          autoCapitalize="words"
          testID="goal-name"
        />

        {/* Mode selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{goalProgressSourceLabel()}</Text>
          <View style={styles.modeTiles}>
            <ModeTile
              selected={mode === 'account'}
              label={goalModeOneAccountLabel()}
              sub={goalModeOneAccountSub()}
              onPress={() => setMode('account')}
              testID="goal-mode-account"
            />
            <ModeTile
              selected={mode === 'total_assets'}
              label={goalModeTotalAssetsLabel()}
              sub={goalModeTotalAssetsSub()}
              onPress={() => setMode('total_assets')}
              testID="goal-mode-total"
            />
          </View>
        </View>

        {/* Account picker (only when mode = 'account') */}
        {mode === 'account' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{goalLinkedAccountLabel()}</Text>
            {accounts.map(acc => (
              <Pressable
                key={acc.id}
                onPress={() => { setAccountId(acc.id); setAccountErr(''); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: accountId === acc.id }}
                style={[styles.accountRow, accountId === acc.id && styles.accountRowSelected]}
                testID={`goal-account-${acc.id}`}
              >
                <AccountLogo iconKey={acc.icon ?? guessAccountLogo(acc.name, acc.type)} type={acc.type} />
                <Text style={styles.accountName}>{acc.name}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
              </Pressable>
            ))}
            {!!accountErr && <Text style={styles.error}>{accountErr}</Text>}
            {/* Current balance note */}
            {selectedAccount && (
              <Text style={styles.balanceNote}>
                {goalCurrentBalanceNote(shown(rp(selectedAccount.balance), hidden))}
              </Text>
            )}
          </View>
        )}

        {/* Target amount */}
        <AmountField
          label={goalTargetAmountLabel()}
          value={targetAmount}
          onChangeValue={v => { setTargetAmount(v); setAmountErr(''); }}
          error={amountErr || undefined}
          testID="goal-target-amount"
        />

        {/* Target date */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{goalTargetDateLabel2()}</Text>
          <Pressable
            onPress={() => setMonthSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={goalTargetDateLabel2()}
            style={styles.dateField}
            testID="goal-target-date"
          >
            <Text style={[styles.dateFieldText, !targetDate && styles.dateFieldPlaceholder]}>
              {targetDate ? formatShortDate(targetDate) : goalChooseDate()}
            </Text>
            <Icon name="calendar" size={20} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* Preview */}
        {previewCurrent != null && targetAmount > 0 && (
          <Card style={styles.previewCard}>
            <Text style={styles.sectionLabel}>{goalPreviewLabel()}</Text>
            <PreviewRow label={goalPreviewSavedSoFar()} value={shown(rp(previewCurrent), hidden)} />
            {previewRemaining === 0 ? (
              <View style={styles.achievedPreview}>
                <Icon name="check" size={16} color={MonoColors.text} />
                <Text style={styles.achievedPreviewText}>{goalAchievedPreview()}</Text>
              </View>
            ) : previewRemaining != null && (
              <PreviewRow
                label={goalPreviewRemaining()}
                value={shown(rp(previewRemaining), hidden)}
              />
            )}
            {previewRemaining !== 0 && ml != null && targetDate && (
              <PreviewRow
                label={goalPreviewMonthsLeft(ml, formatShortDate(targetDate))}
                value={String(ml)}
              />
            )}
            {previewRemaining !== 0 && pace != null && (
              <PreviewRow
                label={goalPreviewNeededPace()}
                value={goalMonthlyValue(shown(rp(pace), hidden))}
              />
            )}
          </Card>
        )}

        {/* Delete note */}
        {isEditing && (
          <View style={styles.deleteNoteRow}>
            <Icon name="info" size={16} color={MonoColors.textMeta} />
            <Text style={styles.deleteNote}>{goalDeleteNote()}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={cancelLabel()} variant="secondary" onPress={() => router.back()} style={styles.barBtn} />
        <Button
          label={saveGoalLabel()}
          onPress={onSave}
          loading={saving}
          disabled={saving}
          style={styles.barBtn}
          testID="goal-save"
        />
      </View>
      <GoalMonthSheet
        visible={monthSheetOpen}
        selected={(targetDate || new Date().toISOString().slice(0, 7)).slice(0, 7)}
        onSelect={onMonthSelect}
        onClose={() => setMonthSheetOpen(false)}
      />
      <Modal transparent visible={deleteDialogOpen} animationType="fade" onRequestClose={() => setDeleteDialogOpen(false)}>
        <View style={styles.dialogScrim}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.dialogTitle}>{goalDeleteConfirmTitle(name.trim())}</Text>
            <Text style={styles.dialogBody}>{goalDeleteConfirmBody()}</Text>
            <View style={styles.dialogActions}>
              <Button label={cancelLabel()} variant="secondary" onPress={() => setDeleteDialogOpen(false)} style={styles.dialogButton} />
              <Button label={goalDeleteLabel()} onPress={() => void confirmDelete()} style={styles.dialogButton} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PreviewRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={[styles.previewValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const BAR_BORDER = '#272728';

const styles = StyleSheet.create({
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
  sectionLabel: {
    ...MonoText.label,
    color: MonoColors.textMeta,
  },

  modeTiles: { flexDirection: 'row', gap: 8 },
  modeTile: {
    flex: 1,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    gap: 2,
  },
  modeTileSelected: {
    borderColor: MonoColors.text,
    backgroundColor: MonoColors.raised,
  },
  modeTileCheck: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: MonoColors.text,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  modeTileLabel: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  modeTileLabelSelected: { color: MonoColors.text },
  modeTileSub: { ...MonoText.caption, color: MonoColors.textMeta },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
  },
  accountRowSelected: { borderColor: MonoColors.text },
  accountName: { ...MonoText.body, color: MonoColors.text, flex: 1, marginLeft: 10 },
  balanceNote: { ...MonoText.caption, color: MonoColors.accent, lineHeight: 18 },

  error: { ...MonoText.bodyS, color: MonoColors.negative },

  previewCard: { gap: 6, padding: 16 },
  dateField: { minHeight: 48, borderWidth: 1, borderColor: MonoColors.border, borderRadius: radius.md, backgroundColor: MonoColors.card, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldText: { ...MonoText.body, color: MonoColors.text },
  dateFieldPlaceholder: { color: MonoColors.textDisabled },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BAR_BORDER,
    paddingBottom: 8,
    paddingTop: 2,
  },
  previewLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  previewValue: { ...MonoText.figureRow, color: MonoColors.text },
  achievedPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  achievedPreviewText: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },

  deleteNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  deleteNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },

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
  dialogScrim: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.62)' },
  dialog: { width: '100%', maxWidth: 360, borderWidth: 1.5, borderColor: MonoColors.textDisabled, borderRadius: 16, backgroundColor: '#151516', padding: 20, gap: 12 },
  dialogTitle: { ...MonoText.titleM, color: MonoColors.text },
  dialogBody: { ...MonoText.body, color: MonoColors.textSecond },
  dialogActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  dialogButton: { flex: 1 },
});
