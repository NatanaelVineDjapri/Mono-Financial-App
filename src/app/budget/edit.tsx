// Create / edit budget (DESIGN.md "F. Budgets" Create, PAGES.md F2, docs/screens
// "F · Create edit budget"). One form, three modes:
//   - add:   /budget/edit?month=YYYY-MM            (optional &categoryId= to preselect)
//   - edit:  /budget/edit?month=YYYY-MM&categoryId= (that category already has a budget)
//   - limit: /budget/edit?month=YYYY-MM&mode=limit  (the month's total limit)
// The allocation check compares the month's limit with every category budget
// (checkAllocation in src/domain/budget.ts). Over the limit, Save is disabled and the
// message comes from the catalogue (DESIGN.md section 14, Budget row). "Raise monthly
// limit to …" raises the limit inside the same save; nothing is written before Save.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { showToast } from '@/components/toast-store';
import { today } from '@/core/clock';
import { monthLabel } from '@/core/date';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { checkAllocation, saveBudget, setMonthlyLimit, type AllocationCheck, type BudgetFormContext } from '@/domain/budget';
import { DomainError } from '@/domain/errors';
import { useBudgetFormContext } from '@/features/budgets/useBudgets';
import {
    addCategoryBudgetLabel,
    allocatedLabel,
    allocationCheckLabel,
    alreadyAllocatedLabel,
    amountAboveZeroMessage,
    budgetCategoryHelper,
    budgetSavedToast,
    budgetSaveFailedMessage,
    budgetsErrorMessage,
    cancelLabel,
    categoryLabel,
    categoryWithoutBudgetLabel,
    chooseCategoryMessage,
    closeLabel,
    editCategoryBudgetTitle,
    fullyAllocatedMessage,
    guardMessage,
    monthlyLimitForLabel,
    monthlyLimitSavedToast,
    monthlyLimitTitle,
    noCategoriesLeftMessage,
    overMonthlyLimitBy,
    overMonthlyLimitHint,
    overMonthlyLimitHintForLimit,
    raisedFromLabel,
    raiseMonthlyLimitToLabel,
    repeatEveryMonthHelper,
    repeatEveryMonthLabel,
    retryLabel,
    saveBudgetLabel,
    saveLimitLabel,
    stepLabel,
    thisBudgetLabel,
    totalAllocatedLabel,
    totalMonthlyLimitLabel,
    unallocatedMessage,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

type Mode = 'add' | 'edit' | 'limit';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonth(raw: string | undefined): string {
  // Every entry point passes the month it was opened from. The fallback (calendar month
  // of today) only covers a malformed deep link.
  return raw && MONTH_RE.test(raw) ? raw : today().slice(0, 7);
}

function parseId(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : undefined;
}

export default function BudgetEditScreen() {
  const params = useLocalSearchParams<{ month?: string; categoryId?: string; mode?: string }>();
  const month = parseMonth(params.month);
  const categoryId = parseId(params.categoryId);
  const limitMode = params.mode === 'limit';
  const { data, isLoading, isError, refetch } = useBudgetFormContext(month, limitMode ? undefined : categoryId);

  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data) {
    return (
      <View style={[styles.screen, styles.centerFill]}>
        <Text style={styles.body}>{budgetsErrorMessage()}</Text>
        <Button label={retryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }

  const mode: Mode = limitMode ? 'limit' : data.editing ? 'edit' : 'add';
  // Remount when the loaded context changes identity (mode or edited budget), so the
  // form's initial state is always taken from the data it edits.
  return <BudgetForm key={`${mode}-${data.editing?.id ?? 'new'}`} mode={mode} context={data} preselectCategoryId={categoryId} />;
}

function CheckRow({ label, value, caption, strong, testID }: { label: string; value: string; caption?: string; strong?: boolean; testID?: string }) {
  return (
    <View style={[styles.checkRow, strong && styles.checkRowTotal]} testID={testID}>
      <View style={styles.checkLabelWrap}>
        <Text style={strong ? styles.checkLabelStrong : styles.checkLabel}>{label}</Text>
        {!!caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
      <Text style={strong ? styles.checkValueStrong : styles.checkValue}>{value}</Text>
    </View>
  );
}

function AllocationMessage({ check, mode, hidden, onRaise }: { check: AllocationCheck; mode: Mode; hidden: boolean; onRaise: () => void }) {
  if (check.status === 'over') {
    return (
      <View style={styles.messageBlock} testID="allocation-over">
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={16} color={MonoColors.negative} />
          <Text style={styles.messageText}>
            <Text style={styles.messageStrong}>{overMonthlyLimitBy(shown(rp(check.overBy), hidden))}</Text>{' '}
            {mode === 'limit' ? overMonthlyLimitHintForLimit() : overMonthlyLimitHint()}
          </Text>
        </View>
        {mode !== 'limit' && (
          <Button label={raiseMonthlyLimitToLabel(shown(rp(check.total), hidden))} variant="secondary" onPress={onRaise} testID="allocation-raise" />
        )}
      </View>
    );
  }
  return (
    <Text style={styles.messageNeutral} accessibilityLiveRegion="polite" testID={`allocation-${check.status}`}>
      {check.status === 'exact' ? fullyAllocatedMessage() : unallocatedMessage(shown(rp(check.unallocated), hidden))}
    </Text>
  );
}

function BudgetForm({ mode, context, preselectCategoryId }: { mode: Mode; context: BudgetFormContext; preselectCategoryId?: number }) {
  const router = useRouter();
  const db = useDb();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(state => state.hidden);

  const initialCategory =
    mode === 'edit'
      ? context.editing!.category_id
      : context.availableCategories.some(c => c.id === preselectCategoryId)
        ? preselectCategoryId!
        : null;
  const initialAmount = mode === 'edit' ? context.editing!.limit_amount : mode === 'limit' ? context.monthlyLimit?.amount ?? 0 : 0;
  const initialRepeat = mode === 'edit' ? context.editing!.repeat === 1 : mode === 'limit' ? context.monthlyLimit?.repeat ?? true : true;

  const [selectedCategory, setSelectedCategory] = useState<number | null>(initialCategory);
  const [amount, setAmount] = useState(initialAmount);
  const [repeat, setRepeat] = useState(initialRepeat);
  const [raisedLimit, setRaisedLimit] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const others = context.budgets.filter(b => b.id !== context.editing?.id);
  const allocatedOthers = others.reduce((sum, b) => sum + b.limit_amount, 0);
  const allocatedAll = context.budgets.reduce((sum, b) => sum + b.limit_amount, 0);
  const storedLimit = context.monthlyLimit?.amount ?? 0;
  const effectiveLimit = raisedLimit ?? storedLimit;
  const check = mode === 'limit' ? checkAllocation(amount, allocatedAll, 0) : checkAllocation(effectiveLimit, allocatedOthers, amount);

  const categoryName =
    mode === 'edit'
      ? context.editing!.category
      : context.availableCategories.find(c => c.id === selectedCategory)?.name ?? null;
  const noCategoriesLeft = mode === 'add' && context.availableCategories.length === 0;
  const amountError = showErrors && amount <= 0 ? amountAboveZeroMessage() : undefined;
  const categoryError = showErrors && mode === 'add' && selectedCategory === null ? chooseCategoryMessage() : undefined;
  const saveDisabled = check.status === 'over' || noCategoriesLeft;
  const money = (v: number) => shown(rp(v), hidden);

  const title = mode === 'limit' ? monthlyLimitTitle() : mode === 'edit' ? editCategoryBudgetTitle() : addCategoryBudgetLabel();

  async function onSave() {
    setSubmitError(null);
    if (amount <= 0 || (mode === 'add' && selectedCategory === null)) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'limit') {
        await setMonthlyLimit(db, context.month, amount, repeat);
        showToast(monthlyLimitSavedToast(money(amount)));
      } else {
        await saveBudget(db, {
          month: context.month,
          categoryId: selectedCategory!,
          limitAmount: amount,
          repeat,
          monthlyLimit: raisedLimit ?? undefined,
        });
        showToast(budgetSavedToast(categoryName ?? '', money(amount)));
      }
      await invalidateAfterWrite(queryClient);
      router.back();
    } catch (err) {
      if (err instanceof DomainError) {
        const overByAmount = typeof err.context.overBy === 'number' ? err.context.overBy : null;
        setSubmitError(err.code === 'over_monthly_limit' && overByAmount !== null ? overMonthlyLimitBy(money(overByAmount)) : guardMessage(err.code));
      } else {
        setSubmitError(budgetSaveFailedMessage());
      }
      await invalidateAfterWrite(queryClient);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()} testID="budget-edit-close">
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {mode !== 'limit' && (
          <View style={styles.section}>
            <Text style={styles.stepLabel}>{stepLabel(1, mode === 'edit' ? categoryLabel() : categoryWithoutBudgetLabel())}</Text>
            {noCategoriesLeft ? (
              <Text style={styles.body}>{noCategoriesLeftMessage()}</Text>
            ) : (
              <View style={styles.chips}>
                {mode === 'edit' ? (
                  <Chip label={context.editing!.category} selected testID={`budget-category-chip-${context.editing!.category_id}`} />
                ) : (
                  context.availableCategories.map(c => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={selectedCategory === c.id}
                      onPress={() => setSelectedCategory(c.id)}
                      testID={`budget-category-chip-${c.id}`}
                    />
                  ))
                )}
              </View>
            )}
            {categoryError ? (
              <Text style={styles.errorText}>{categoryError}</Text>
            ) : (
              <Text style={styles.helper}>{budgetCategoryHelper()}</Text>
            )}
          </View>
        )}

        <AmountField
          label={mode === 'limit' ? totalMonthlyLimitLabel(monthLabel(context.month)) : stepLabel(2, monthlyLimitForLabel(categoryName))}
          value={amount}
          onChangeValue={value => {
            setAmount(value);
            setSubmitError(null);
          }}
          error={amountError}
          testID="budget-amount"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{repeatEveryMonthLabel()}</Text>
            <Text style={styles.helper}>{repeatEveryMonthHelper(monthLabel(context.month))}</Text>
          </View>
          <MonoSwitch value={repeat} onValueChange={setRepeat} label={repeatEveryMonthLabel()} testID="budget-repeat" />
        </View>

        <View style={styles.checkCard} testID="allocation-check">
          <Text style={styles.stepLabel}>{allocationCheckLabel()}</Text>
          {mode === 'limit' ? (
            <>
              <CheckRow label={monthlyLimitTitle()} value={money(amount)} testID="allocation-limit" />
              <CheckRow label={allocatedLabel(context.budgets.length)} value={money(allocatedAll)} testID="allocation-allocated" />
              <CheckRow label={totalAllocatedLabel()} value={money(check.total)} strong testID="allocation-total" />
            </>
          ) : (
            <>
              <CheckRow
                label={monthlyLimitTitle()}
                value={money(effectiveLimit)}
                caption={raisedLimit !== null ? raisedFromLabel(money(storedLimit)) : undefined}
                testID="allocation-limit"
              />
              <CheckRow label={alreadyAllocatedLabel(others.length)} value={money(allocatedOthers)} testID="allocation-allocated" />
              <CheckRow label={thisBudgetLabel()} value={shown(rp(amount, true), hidden)} testID="allocation-this" />
              <CheckRow label={totalAllocatedLabel()} value={money(check.total)} strong testID="allocation-total" />
            </>
          )}
          <View style={styles.checkDivider} />
          <AllocationMessage check={check} mode={mode} hidden={hidden} onRaise={() => setRaisedLimit(check.total)} />
        </View>

        {!!submitError && (
          <View style={styles.messageRow} accessibilityLiveRegion="assertive" testID="budget-submit-error">
            <Icon name="alert" size={16} color={MonoColors.negative} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={cancelLabel()} variant="secondary" onPress={() => router.back()} style={styles.cancel} />
        <Button
          label={mode === 'limit' ? saveLimitLabel() : saveBudgetLabel()}
          onPress={() => void onSave()}
          disabled={saveDisabled}
          loading={saving}
          style={styles.save}
          testID="budget-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  centerFill: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: { paddingHorizontal: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  section: { gap: 8 },
  stepLabel: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  body: { ...MonoText.body, color: MonoColors.textSecond },
  helper: { ...MonoText.bodyS, color: MonoColors.textMeta },
  errorText: { ...MonoText.bodyS, color: MonoColors.negative, flexShrink: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...MonoText.bodyStrong, color: MonoColors.text },

  checkCard: { backgroundColor: MonoColors.card, borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border, padding: 16, gap: 4 },
  checkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: MonoColors.border,
  },
  checkRowTotal: { borderBottomWidth: 0 },
  checkLabelWrap: { flexShrink: 1, gap: 2 },
  checkLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
  checkLabelStrong: { ...MonoText.bodyStrong, color: MonoColors.text },
  checkValue: { ...MonoText.figureRow, color: MonoColors.text },
  checkValueStrong: { ...MonoText.figureRow, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  checkDivider: { height: 1.5, backgroundColor: MonoColors.text, marginVertical: 8 },

  messageBlock: { gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageText: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },
  messageStrong: { fontFamily: MonoText.bodyStrong.fontFamily },
  messageNeutral: { ...MonoText.bodyS, color: MonoColors.textSecond },

  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
    backgroundColor: MonoColors.bg,
  },
  cancel: { flex: 1 },
  save: { flex: 2 },
});
