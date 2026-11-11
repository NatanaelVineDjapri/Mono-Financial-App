// The transaction form (Tx-Add, Tx-Add-Errors, Tx-Add-Transfer, and the edit form): Income,
// Expense or Transfer. It owns the form's state and nothing else: the rules are
// src/core/tx/validate.ts's (pure, tested), saving is the caller's `onSubmit` (which goes through
// src/core/tx/save.ts), and the data arrives read from the views. It writes no balance anywhere:
// "Balance after" is the account's balance plus or minus what is typed, computed on the spot.
//
// Errors appear after their field was touched or Save was tapped, never all at once on a fresh
// form; a short balance appears as soon as the amount makes it so. Save is disabled while an
// error is showing, and tapping it on an invalid form reveals what is wrong instead of saving.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Segmented, type SegmentedOption } from '@/components/Segmented';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { dayBefore } from '@/core/tx/calendar';
import {
    balanceAfter,
    validateTx,
    visibleErrors,
    type TxFieldError,
    type TxFieldKey,
    type TxFormValues,
    type TxType,
} from '@/core/tx/validate';
import type { TxFormData } from '@/domain/txForm';
import {
    aiDraftSaveButton,
    aiDraftSavingLabel,
    aiEditSaveContinue,
    aiEditSkip,
    aiEditTitle,
    addTransactionTitle,
    cancelLabel,
    chooseAccountPlaceholder,
    closeLabel,
    descriptionPlaceholder,
    editTransactionTitle,
    fieldsNeedAttention,
    formDescriptionLabel,
    formDescriptionOptionalLabel,
    formNotesOptionalLabel,
    notesPlaceholder,
    saveButtonLabel,
    savingLabel,
    TRANSFER_IN_FIRST_LINK,
    txFieldErrorMessage,
    txKindLabel,
    typeLockedHint
} from '@/i18n';
import { DraftProgressBar, DraftProgressText, SourceQuote } from '@/features/ai_chat/ui/DraftEditChrome';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AccountField, AmountCard, CategoryRow, DateRow, ErrorLine, TextBox, TransferAccounts, type ErrorView } from './formParts';
import { AccountSheet, CategorySheet, DateSheet, type AccountSheetRole } from './formSheets';

const QUICK_ADDS = [10000, 50000, 100000];
const TYPES: TxType[] = ['income', 'expense', 'transfer'];
const BAR_BORDER = '#272728';

export type SubmitResult = { ok: true } | { ok: false; message: string };

// "Ubah draf" (/ai-draft-edit): the same form, filled from an AI draft. Simpan saves THIS draft
// and moves on to the next; Lewati moves on without saving.
export interface DraftModeProps {
  index: number; // 0-based, of `total`
  total: number;
  sourceMessage: string;
  initialValues: TxFormValues;
  onSkip: () => void;
}

export interface TransactionFormProps {
  mode: 'add' | 'edit' | 'draft';
  draft?: DraftModeProps; // with mode 'draft'
  data: TxFormData;
  today: string;
  initialType?: TxType;
  initialAccountId?: number; // preselect this account (from Account detail's Add and Transfer)
  onCancel: () => void;
  onChat?: () => void;
  onSubmit: (values: TxFormValues) => Promise<SubmitResult>;
}

type SheetName = AccountSheetRole | 'category' | 'date' | null;

function initialValues(mode: 'add' | 'edit' | 'draft', data: TxFormData, today: string, initialType?: TxType, initialAccountId?: number, draft?: DraftModeProps): TxFormValues {
  if (mode === 'draft' && draft) return draft.initialValues;
  if (mode === 'edit' && data.record) {
    const r = data.record;
    return {
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      date: r.date,
      description: r.description,
      note: r.note,
    };
  }
  const preselected = data.accounts.find(a => a.id === initialAccountId && a.type !== 'forex');
  const firstRupiah = preselected ?? data.accounts.find(a => a.type !== 'forex');
  return {
    type: initialType ?? 'expense',
    amount: 0,
    categoryId: null,
    accountId: firstRupiah?.id ?? null,
    toAccountId: null,
    date: today,
    description: '',
    note: '',
  };
}

export function TransactionForm({ mode, draft, data, today, initialType, initialAccountId, onCancel, onChat, onSubmit }: TransactionFormProps) {
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(s => s.hidden);

  const [values, setValues] = useState<TxFormValues>(() => initialValues(mode, data, today, initialType, initialAccountId, draft));
  const [touched, setTouched] = useState<ReadonlySet<TxFieldKey>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);

  const set = useCallback((patch: Partial<TxFormValues>) => {
    setValues(v => ({ ...v, ...patch }));
    setServerError(null);
  }, []);
  const touch = useCallback((field: TxFieldKey) => setTouched(t => (t.has(field) ? t : new Set(t).add(field))), []);

  // Android back closes an open sheet before it leaves the screen.
  useEffect(() => {
    if (!sheet) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSheet(null);
      return true;
    });
    return () => subscription.remove();
  }, [sheet]);

  const errors = useMemo(
    () => validateTx(values, { today, accounts: data.accounts, categories: data.categories }),
    [values, today, data.accounts, data.categories],
  );
  const visible = useMemo(() => visibleErrors(errors, touched, submitted), [errors, touched, submitted]);

  const account = data.accounts.find(a => a.id === values.accountId);
  const toAccount = data.accounts.find(a => a.id === values.toAccountId);
  const isTransfer = values.type === 'transfer';
  const kindCategories = useMemo(() => data.categories.filter(c => c.kind === values.type), [data.categories, values.type]);

  const rpFormat = useCallback((n: number) => shown(rp(n), hidden), [hidden]);

  // "Transfer money in first": the same form, switched to a transfer into the short account.
  const switchToTransferInto = useCallback(
    (accountId: number) => {
      const other = data.accounts.find(a => a.type !== 'forex' && a.id !== accountId);
      setValues(v => ({ ...v, type: 'transfer', categoryId: null, accountId: other?.id ?? null, toAccountId: accountId }));
      setTouched(new Set());
      setSubmitted(false);
      setServerError(null);
    },
    [data.accounts],
  );

  const errorView = (field: TxFieldKey): ErrorView | undefined => {
    const error: TxFieldError | undefined = visible.find(e => e.field === field);
    if (!error) return undefined;
    const message = txFieldErrorMessage({ ...error, type: values.type }, rpFormat, formatShortDate);
    const link = message.linkText === TRANSFER_IN_FIRST_LINK && values.accountId != null;
    return { text: message.text, linkText: message.linkText, onLinkPress: link ? () => switchToTransferInto(values.accountId as number) : undefined };
  };

  const changeType = (next: TxType) => {
    if (next === values.type) return;
    // The amount, date and description stay; a category belongs to its kind, so it goes.
    setValues(v => ({ ...v, type: next, categoryId: null }));
    setTouched(t => {
      const n = new Set(t);
      n.delete('category');
      return n;
    });
    setServerError(null);
  };

  const segmentOptions: SegmentedOption[] = TYPES.map(type => {
    const locked = mode === 'edit' && ((data.record?.type === 'transfer') !== (type === 'transfer'));
    return { value: type, label: txKindLabel(type), disabled: locked, hint: locked ? typeLockedHint() : undefined };
  });

  const fieldCount = new Set(visible.map(e => e.field)).size;
  const hasVisibleErrors = visible.length > 0;
  const saveType = mode === 'edit' ? 'edit' : values.type;

  const onSavePress = async () => {
    if (errors.length > 0) {
      setSubmitted(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setServerError(null);
    const result = await onSubmit(values);
    setSaving(false);
    if (!result.ok) setServerError(result.message);
  };

  const accountsForSheet = data.accounts;
  const sheetSelected = sheet === 'to' ? values.toAccountId : values.accountId;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <IconButton label={closeLabel()} onPress={onCancel} testID="tx-form-close">
            <Icon name="close" color={MonoColors.text} />
          </IconButton>
          <Text style={styles.title} accessibilityRole="header">
            {mode === 'draft' ? aiEditTitle() : mode === 'edit' ? editTransactionTitle() : addTransactionTitle()}
          </Text>
          {mode === 'draft' && draft && <DraftProgressText index={draft.index} total={draft.total} />}
        </View>
      </View>
      {/* one segment for one draft would only be a white line: the bar is for two or more */}
      {mode === 'draft' && draft && draft.total > 1 && <DraftProgressBar index={draft.index} total={draft.total} />}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="tx-form-scroll">
        {mode === 'draft' && draft && <SourceQuote text={draft.sourceMessage} />}
        <Segmented options={segmentOptions} value={values.type} onChange={v => changeType(v as TxType)} testID="tx-type" />

        <AmountCard
          value={values.amount}
          onChange={amount => set({ amount })}
          onBlur={() => touch('amount')}
          label={isTransfer ? 'amountToMove' : 'amount'}
          quickAdds={QUICK_ADDS}
          error={errorView('amount')}
        />

        {!isTransfer && (
          <CategoryRow
            categories={kindCategories}
            selectedId={values.categoryId}
            onSelect={id => {
              set({ categoryId: id });
              touch('category');
            }}
            onMore={() => setSheet('category')}
            error={errorView('category')}
          />
        )}

        {isTransfer ? (
          <TransferAccounts
            from={account}
            to={toAccount}
            fromAfter={balanceAfter(account, values.amount, 'out')}
            toAfter={balanceAfter(toAccount, values.amount, 'in')}
            onPressFrom={() => setSheet('from')}
            onPressTo={() => setSheet('to')}
            onSwap={() => {
              set({ accountId: values.toAccountId, toAccountId: values.accountId });
              touch('toAccount');
            }}
            fromError={errorView('account')}
            toError={errorView('toAccount')}
            placeholder={chooseAccountPlaceholder()}
          />
        ) : (
          <AccountField
            account={account}
            balanceAfter={balanceAfter(account, values.amount, values.type === 'income' ? 'in' : 'out')}
            onPress={() => setSheet('account')}
            error={errorView('account')}
            placeholder={chooseAccountPlaceholder()}
          />
        )}

        <DateRow
          dateText={formatShortDate(values.date)}
          chosen={values.date === today ? 'today' : values.date === dayBefore(today) ? 'yesterday' : null}
          onPressField={() => setSheet('date')}
          onToday={() => {
            set({ date: today });
            touch('date');
          }}
          onYesterday={() => {
            set({ date: dayBefore(today) });
            touch('date');
          }}
          error={errorView('date')}
        />

        <TextBox
          label={isTransfer ? formDescriptionOptionalLabel() : formDescriptionLabel()}
          value={values.description}
          onChange={description => set({ description })}
          placeholder={descriptionPlaceholder()}
          testID="tx-description"
        />

        {!isTransfer && (
          <TextBox label={formNotesOptionalLabel()} value={values.note} onChange={note => set({ note })} placeholder={notesPlaceholder()} multiline testID="tx-note" />
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {hasVisibleErrors && <ErrorLine error={{ text: fieldsNeedAttention(fieldCount) }} testID="tx-error-summary" />}
        {!!serverError && <ErrorLine error={{ text: serverError }} testID="tx-server-error" />}
        <View style={styles.barRow}>
          {mode === 'draft' && draft ? (
            <Button label={aiEditSkip()} variant="secondary" onPress={draft.onSkip} disabled={saving} style={styles.cancelButton} testID="tx-skip" />
          ) : (
            <Button label={cancelLabel()} variant="secondary" onPress={onCancel} style={styles.cancelButton} testID="tx-cancel" />
          )}
          <Button
            label={
              mode === 'draft' && draft
                ? saving
                  ? aiDraftSavingLabel()
                  : draft.index + 1 >= draft.total
                    ? aiDraftSaveButton()
                    : aiEditSaveContinue()
                : saving
                  ? savingLabel()
                  : saveButtonLabel(saveType)
            }
            onPress={() => void onSavePress()}
            disabled={hasVisibleErrors || saving}
            style={styles.saveButton}
            testID="tx-save"
          />
        </View>
      </View>

      <AccountSheet
        visible={sheet === 'account' || sheet === 'from' || sheet === 'to'}
        role={sheet === 'from' || sheet === 'to' ? sheet : 'account'}
        accounts={accountsForSheet}
        selectedId={sheetSelected}
        onSelect={id => {
          if (sheet === 'to') {
            set({ toAccountId: id });
            touch('toAccount');
          } else {
            set({ accountId: id });
            touch('account');
          }
          setSheet(null);
        }}
        onClose={() => {
          touch(sheet === 'to' ? 'toAccount' : 'account');
          setSheet(null);
        }}
      />
      <CategorySheet
        visible={sheet === 'category'}
        kind={values.type === 'income' ? 'income' : 'expense'}
        categories={kindCategories}
        selectedId={values.categoryId}
        onSelect={id => {
          set({ categoryId: id });
          touch('category');
          setSheet(null);
        }}
        onClose={() => {
          touch('category');
          setSheet(null);
        }}
      />
      <DateSheet
        visible={sheet === 'date'}
        selected={values.date}
        today={today}
        onSelect={date => {
          set({ date });
          touch('date');
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12 },
  headerRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { padding: 16, gap: 20 },
  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: BAR_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 12 },
  cancelButton: { width: 104 },
  saveButton: { flex: 1 },
});
