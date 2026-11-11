// Create / edit goal (DESIGN.md "G. Goals" — Goal-Edit board).
// Route: /goal/edit (new)  or  /goal/edit?id=N (edit).
// Progress is never typed in — always read from v_goal_progress.
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
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
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccounts } from '@/data/repo/accounts';
import type { GoalMode } from '@/data/repo/goals';
import { useGoalById, useGoalMutations } from '@/features/goals/useGoals';
import {
    cancelLabel,
    closeLabel,
    editGoalTitle,
    goalAccountRequired,
    goalAmountRequired,
    goalCurrentBalanceNote,
    goalDeleteNote,
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
    goalPreviewNeededPace,
    goalPreviewRemaining,
    goalPreviewSavedSoFar,
    goalProgressSourceLabel,
    goalTargetAmountLabel,
    goalTargetDateLabel2,
    newGoalTitle,
    saveGoalLabel
} from '@/i18n/id';
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

  // Form state
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GoalMode>('total_assets');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [targetAmount, setTargetAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');

  // Errors
  const [nameErr, setNameErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [accountErr, setAccountErr] = useState('');

  // Load existing data into form when editing
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setMode(existing.mode);
    setAccountId(existing.account_id);
    setTargetAmount(existing.target_amount);
    setTargetDate(existing.target_date ?? '');
  }, [existing]);

  // Accounts list for picker
  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'for-goal'],
    queryFn: () => listAccounts(db, { includeArchived: false }),
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

  const onDelete = useCallback(() => {
    Alert.alert('Delete goal', `Delete "${name.trim()}"? This never changes accounts or transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (goalId != null) await remove.mutateAsync(goalId);
          router.back();
        },
      },
    ]);
  }, [name, goalId, remove, router]);

  const saving = create.isPending || update.isPending;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()}>
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.headerTitle}>{isEditing ? editGoalTitle() : newGoalTitle()}</Text>
        {isEditing && (
          <IconButton label="Delete goal" onPress={onDelete}>
            <Icon name="trash" color={MonoColors.negative} />
          </IconButton>
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
        <Field
          label={goalTargetDateLabel2()}
          placeholder="31 Dec 2027"
          value={targetDate}
          onChangeText={setTargetDate}
          testID="goal-target-date"
        />

        {/* Preview */}
        {previewCurrent != null && targetAmount > 0 && (
          <Card style={styles.previewCard}>
            <Text style={styles.sectionLabel}>{goalPreviewLabel()}</Text>
            <PreviewRow label={goalPreviewSavedSoFar()} value={shown(rp(previewCurrent), hidden)} />
            {previewRemaining != null && (
              <PreviewRow
                label={goalPreviewRemaining()}
                value={shown(rp(previewRemaining), hidden)}
                valueColor={MonoColors.negative}
              />
            )}
            {ml != null && targetDate && (
              <PreviewRow
                label={`Months left, to ${formatShortDate(targetDate)}`}
                value={String(ml)}
              />
            )}
            {pace != null && (
              <PreviewRow
                label={goalPreviewNeededPace()}
                value={`${shown(rp(pace), hidden)} / month`}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  headerTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1, paddingHorizontal: 4 },

  content: { paddingHorizontal: 16, gap: 20, paddingTop: 8 },

  section: { gap: 10 },
  sectionLabel: {
    ...MonoText.label,
    color: MonoColors.textMeta,
    textTransform: 'uppercase',
  },

  modeTiles: { flexDirection: 'row', gap: 10 },
  modeTile: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    gap: 4,
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
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
  },
  accountRowSelected: { borderColor: MonoColors.text },
  accountName: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  balanceNote: { ...MonoText.caption, color: MonoColors.accent, lineHeight: 18 },

  error: { ...MonoText.bodyS, color: MonoColors.negative },

  previewCard: { gap: 10 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  previewValue: { ...MonoText.figureRow, color: MonoColors.text },

  deleteNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  deleteNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },

  bar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BAR_BORDER,
    backgroundColor: MonoColors.bg,
  },
  barBtn: { flex: 1 },
});
