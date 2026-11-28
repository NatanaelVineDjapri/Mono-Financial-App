// The transaction form (Tx-Add, Tx-Add-Errors, Tx-Add-Transfer, and the edit form): Income,
// Expense or Transfer. It owns the form's state and nothing else: the rules are
// src/core/tx/validate.ts's (pure, tested), saving is the caller's `onSubmit` (which goes through
// src/core/tx/save.ts), and the data arrives read from the views. It writes no balance anywhere:
// "Balance after" is the account's balance plus or minus what is typed, computed on the spot.
//
// Errors appear after their field was touched or Save was tapped, never all at once on a fresh
// form; a short balance appears as soon as the amount makes it so. Save is disabled while an
// error is showing, and tapping it on an invalid form reveals what is wrong instead of saving.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Segmented, type SegmentedOption } from '@/components/Segmented';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { money, rp, shown, toIdr } from '@/core/money';
import { dayBefore } from '@/core/tx/calendar';
import { suggestFromDescription } from '@/core/tx/suggest';
import {
    balanceAfter,
    validateTx,
    visibleErrors,
    type TxFieldError,
    type TxFieldKey,
    type FormPocket,
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
  txValasFieldError,
  typeLockedHint,
  valasAmountTitle,
  valasAmountToMoveTitle,
  valasPocketFromLabel,
  valasPocketToLabel,
  valasYouReceive,
  valasYouSend,
  txLocationCapturing,
  locationSaved,
  txLocationUnavailable,
  txLocationRetry,
  txLocationPlaceLabel,
  txLocationPlacePlaceholder,
} from '@/i18n';
import { DraftProgressBar, DraftProgressText, SourceQuote } from '@/features/ai_chat/ui/DraftEditChrome';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { exchangeSummary } from '@/features/valas/rates';
import { BalanceAfterLine, BudgetNote, CurrencyAmountCard, ExchangeSummaryCard, LiveValueLine, PocketChips } from '@/features/valas/txParts';
import { AccountField, AmountCard, CategoryRow, DateRow, ErrorLine, SubcategoryRow, TextBox, TransferAccounts, type ErrorView } from './formParts';
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
  initialToAccountId?: number; // preselect the destination of a transfer
  initialCategoryId?: number; // preselect a category (from a quick record)
  initialAmount?: number; // preselect the amount (from a quick record)
  initialDescription?: string; // preselect the note (from a quick record)
  onCancel: () => void;
  onChat?: () => void;
  // The Valas account can be used (through a pocket). Default: yes, except in the AI chat's draft editor.
  allowForex?: boolean;
  // "Atur kurs" in the missing-rate error: opens the Rates screen.
  onSetRates?: () => void;
  onSubmit: (values: TxFormValues) => Promise<SubmitResult>;
  locationStatus?: 'idle' | 'capturing' | 'ready' | 'unavailable';
  onLocationPress?: () => void;
  placeName?: string;
  onPlaceNameChange?: (value: string) => void;
}

type SheetName = AccountSheetRole | 'category' | 'date' | null;

// The pockets of a Valas account, in currency order.
function pocketsOfAccount(pockets: readonly FormPocket[], accountId: number | null | undefined): FormPocket[] {
  return accountId == null ? [] : pockets.filter(p => p.accountId === accountId);
}

// What a caller may prefill on a fresh form (Account detail's Add/Transfer, a quick record).
interface InitialPreset {
  type?: TxType;
  accountId?: number;
  toAccountId?: number;
  categoryId?: number;
  amount?: number;
  description?: string;
}

function initialValues(mode: 'add' | 'edit' | 'draft', data: TxFormData, today: string, allowForex: boolean, preset: InitialPreset, draft?: DraftModeProps): TxFormValues {
  if (mode === 'draft' && draft) return draft.initialValues;
  if (mode === 'edit' && data.record) {
    const r = data.record;
    return {
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId ?? null,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      currency: r.currency,
      toCurrency: r.toCurrency ?? undefined,
      amountTo: r.amountTo,
      date: r.date,
      description: r.description,
      note: r.note,
    };
  }
  const preselected = data.accounts.find(a => a.id === preset.accountId && (allowForex || a.type !== 'forex'));
  const first = preselected ?? data.accounts.find(a => a.type !== 'forex');
  const type = preset.type ?? 'expense';
  // A transfer shortcut supplies both sides. Keep the destination only when it exists, is
  // allowed, and differs from the source; the form's own validation rejects the rest anyway.
  const toPreselected = type === 'transfer'
    ? data.accounts.find(a => a.id === preset.toAccountId && a.id !== first?.id && (allowForex || a.type !== 'forex'))
    : undefined;
  // A quick record supplies the category, amount and note of a repeated entry. Each is kept only
  // when it still fits the chosen kind, so a shortcut whose category was deleted or renamed to
  // another kind opens a merely emptier form instead of one that cannot be saved.
  const category = data.categories.find(c => c.id === preset.categoryId && c.kind === type);
  const typedAmount = preset.amount ?? 0;
  const amount = Number.isSafeInteger(typedAmount) && typedAmount > 0 ? typedAmount : 0;
  const base: TxFormValues = {
    type,
    amount,
    categoryId: category?.id ?? null,
    accountId: first?.id ?? null,
    toAccountId: toPreselected?.id ?? null,
    date: today,
    description: preset.description?.trim() ?? '',
    note: '',
  };
  if (!allowForex || first?.type !== 'forex') return base;
  // The Valas account was chosen (from its detail): start on its first pocket; an exchange starts on
  // a swap between two of its pockets. A transfer shortcut's destination wins over the swap.
  const own = pocketsOfAccount(data.pockets, first.id);
  const currency = own[0]?.currency;
  if (type === 'transfer') {
    if (toPreselected) return { ...base, currency, toAccountId: toPreselected.id };
    return { ...base, currency, toAccountId: first.id, toCurrency: own[1]?.currency };
  }
  return { ...base, currency };
}

// "Balance after" for a Valas pocket, in the pocket's own currency.
function balanceAfterPocket(pocket: FormPocket, amount: number, direction: 'in' | 'out'): number {
  const safe = Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
  return direction === 'in' ? pocket.balance + safe : pocket.balance - safe;
}

export function TransactionForm({ mode, draft, data, today, initialType, initialAccountId, initialToAccountId, initialCategoryId, initialAmount, initialDescription, allowForex: allowForexProp, onSetRates, onCancel, onChat, onSubmit, locationStatus, onLocationPress, placeName, onPlaceNameChange }: TransactionFormProps) {
  const allowForex = allowForexProp ?? mode !== 'draft';
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(s => s.hidden);

  const [values, setValues] = useState<TxFormValues>(() => initialValues(mode, data, today, allowForex, {
    type: initialType,
    accountId: initialAccountId,
    toAccountId: initialToAccountId,
    categoryId: initialCategoryId,
    amount: initialAmount,
    description: initialDescription,
  }, draft));
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

  // A new record whose category was not chosen by hand takes it from the description (what the same words were filed
  // under before, or the sub-category they name). A choice made by the person is never replaced.
  const autoFilled = useRef(false);
  const onDescription = (description: string) => {
    if (mode !== 'add' || values.type === 'transfer' || (values.categoryId != null && !autoFilled.current)) return set({ description });
    const found = suggestFromDescription(description, values.type, data);
    autoFilled.current = found != null;
    set({ description, categoryId: found?.categoryId ?? null, subcategoryId: found?.subcategoryId ?? null });
  };

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
    () => validateTx(values, { today, accounts: data.accounts, categories: data.categories, subcategories: data.subcategories, allowForex, pockets: data.pockets, rates: data.rates }),
    [values, today, data.accounts, data.categories, data.subcategories, data.pockets, data.rates, allowForex],
  );
  const visible = useMemo(() => visibleErrors(errors, touched, submitted), [errors, touched, submitted]);

  const account = data.accounts.find(a => a.id === values.accountId);
  const toAccount = data.accounts.find(a => a.id === values.toAccountId);
  const isTransfer = values.type === 'transfer';
  const kindCategories = useMemo(() => data.categories.filter(c => c.kind === values.type), [data.categories, values.type]);
  // The sub-categories of the chosen category (none for a transfer): the optional second step under the category.
  const categorySubs = useMemo(
    () => (isTransfer || values.categoryId == null ? [] : (data.subcategories ?? []).filter(s => s.categoryId === values.categoryId)),
    [data.subcategories, isTransfer, values.categoryId],
  );

  // Valas: the pocket each side uses, the currency it is in, and what the typed amount is worth.
  const accountPockets = useMemo(() => pocketsOfAccount(data.pockets, values.accountId), [data.pockets, values.accountId]);
  const toPockets = useMemo(() => pocketsOfAccount(data.pockets, values.toAccountId), [data.pockets, values.toAccountId]);
  const fromForex = account?.type === 'forex' && allowForex;
  const toForex = toAccount?.type === 'forex' && allowForex;
  const srcCurrency = fromForex ? (values.currency ?? '') : 'IDR';
  const dstCurrency = isTransfer ? (toForex ? (values.toCurrency ?? '') : 'IDR') : srcCurrency;
  const srcPocket = fromForex ? accountPockets.find(p => p.currency === srcCurrency) : undefined;
  const dstPocket = toForex ? toPockets.find(p => p.currency === dstCurrency) : undefined;
  const exchange = isTransfer && !!account && !!toAccount && srcCurrency !== dstCurrency && srcCurrency !== '' && dstCurrency !== '';
  const srcRate = srcCurrency !== 'IDR' ? data.rates[srcCurrency] : undefined;
  const typedValueIdr = srcPocket && srcRate != null && values.amount > 0 ? toIdr(values.amount, srcRate, srcPocket.minorFactor) : null;
  const categoryName = data.categories.find(c => c.id === values.categoryId)?.name ?? '';
  const sideOf = (currency: string, pocket: FormPocket | undefined) => ({ currency, amount: 0, minorFactor: pocket?.minorFactor ?? 1 });
  const summary = useMemo(
    () =>
      exchange
        ? exchangeSummary(
            { ...sideOf(srcCurrency, srcPocket), amount: values.amount },
            { ...sideOf(dstCurrency, dstPocket), amount: values.amountTo ?? 0 },
            data.rates,
          )
        : null,
    [exchange, srcCurrency, dstCurrency, srcPocket, dstPocket, values.amount, values.amountTo, data.rates],
  );

  // Picking an account sets the currency that goes with it: a rupiah account is rupiah, a Valas
  // account starts on its first pocket (or keeps the one already chosen).
  const currencyFor = (accountId: number, current: string | undefined, avoid?: string): string | undefined => {
    const picked = data.accounts.find(a => a.id === accountId);
    if (!picked || picked.type !== 'forex') return undefined;
    const own = pocketsOfAccount(data.pockets, accountId);
    if (current && current !== avoid && own.some(p => p.currency === current)) return current;
    return own.find(p => p.currency !== avoid)?.currency ?? own[0]?.currency;
  };

  const rpFormat = useCallback((n: number) => shown(rp(n), hidden), [hidden]);

  // "Transfer money in first": the same form, switched to a transfer into the short account.
  const switchToTransferInto = useCallback(
    (accountId: number) => {
      const other = data.accounts.find(a => a.type !== 'forex' && a.id !== accountId);
      setValues(v => ({ ...v, type: 'transfer', categoryId: null, subcategoryId: null, accountId: other?.id ?? null, toAccountId: accountId }));
      setTouched(new Set());
      setSubmitted(false);
      setServerError(null);
    },
    [data.accounts],
  );

  const errorView = (field: TxFieldKey): ErrorView | undefined => {
    const error: TxFieldError | undefined = visible.find(e => e.field === field);
    if (!error) return undefined;
    // The Valas errors are worded in their own function (a pocket's currency, its rate, an exchange).
    if (error.code === 'pocket_required' || error.code === 'missing_rate' || error.code === 'amount_to_required' || error.code === 'same_pocket' || (error.code === 'insufficient_balance' && error.currency)) {
      const cur = error.currency ?? '';
      const factor = error.minorFactor ?? 100;
      const valas = txValasFieldError({ ...error, type: values.type }, n => shown(money(n, cur, factor), hidden));
      return { text: valas.text, linkText: valas.linkText, onLinkPress: valas.linkText ? onSetRates : undefined };
    }
    const message = txFieldErrorMessage({ ...error, type: values.type }, rpFormat, formatShortDate);
    const link = message.linkText === TRANSFER_IN_FIRST_LINK && values.accountId != null;
    return { text: message.text, linkText: message.linkText, onLinkPress: link ? () => switchToTransferInto(values.accountId as number) : undefined };
  };

  const changeType = (next: TxType) => {
    if (next === values.type) return;
    // The amount, date and description stay; a category belongs to its kind, so it goes.
    autoFilled.current = false;
    setValues(v => ({ ...v, type: next, categoryId: null, subcategoryId: null }));
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

        {exchange ? (
          <>
            <CurrencyAmountCard
              key={`send-${srcCurrency}`}
              currency={srcCurrency}
              minorFactor={srcPocket?.minorFactor ?? 100}
              value={values.amount}
              onChange={amount => set({ amount })}
              onBlur={() => touch('amount')}
              title={valasYouSend()}
              error={errorView('amount')}
              testID="tx-amount"
            >
              <BalanceAfterLine balance={srcPocket ? srcPocket.balance - values.amount : null} currency={srcCurrency} minorFactor={srcPocket?.minorFactor ?? 100} />
            </CurrencyAmountCard>
            <CurrencyAmountCard
              key={`receive-${dstCurrency}`}
              currency={dstCurrency}
              minorFactor={dstPocket?.minorFactor ?? 1}
              value={values.amountTo ?? 0}
              onChange={amountTo => set({ amountTo })}
              onBlur={() => touch('amountTo')}
              title={valasYouReceive()}
              error={errorView('amountTo')}
              testID="tx-amount-to"
            />
          </>
        ) : fromForex && srcPocket ? (
          <CurrencyAmountCard
            key={srcCurrency}
            currency={srcCurrency}
            minorFactor={srcPocket.minorFactor}
            value={values.amount}
            onChange={amount => set({ amount })}
            onBlur={() => touch('amount')}
            title={isTransfer ? valasAmountToMoveTitle(srcCurrency) : valasAmountTitle(srcCurrency)}
            error={errorView('amount')}
          >
            <LiveValueLine currency={srcCurrency} valueIdr={typedValueIdr} rateE4={srcRate ?? null} />
            <BalanceAfterLine balance={balanceAfterPocket(srcPocket, values.amount, values.type === 'income' ? 'in' : 'out')} currency={srcCurrency} minorFactor={srcPocket.minorFactor} />
          </CurrencyAmountCard>
        ) : (
          <AmountCard
            value={values.amount}
            onChange={amount => set({ amount })}
            onBlur={() => touch('amount')}
            label={isTransfer ? 'amountToMove' : 'amount'}
            quickAdds={QUICK_ADDS}
            error={errorView('amount')}
          />
        )}
        {exchange && summary && <ExchangeSummaryCard summary={summary} />}
        {values.type === 'expense' && fromForex && <BudgetNote category={categoryName} valueIdr={values.categoryId != null ? typedValueIdr : null} />}

        {!isTransfer && (
          <CategoryRow
            categories={kindCategories}
            selectedId={values.categoryId}
            onSelect={id => {
              autoFilled.current = false;
              set({ categoryId: id, subcategoryId: id === values.categoryId ? values.subcategoryId : null });
              touch('category');
            }}
            onMore={() => setSheet('category')}
            error={errorView('category')}
          />
        )}

        {categorySubs.length > 0 && <SubcategoryRow
            subcategories={categorySubs}
            selectedId={values.subcategoryId ?? null}
            onSelect={id => {
              autoFilled.current = false;
              set({ subcategoryId: id });
            }}
          />}

        {isTransfer ? (
          <TransferAccounts
            from={account}
            to={toAccount}
            fromAfter={fromForex ? null : balanceAfter(account, values.amount, 'out')}
            toAfter={toForex ? null : balanceAfter(toAccount, exchange ? (values.amountTo ?? 0) : values.amount, 'in')}
            onPressFrom={() => setSheet('from')}
            onPressTo={() => setSheet('to')}
            onSwap={() => {
              set({ accountId: values.toAccountId, toAccountId: values.accountId, currency: values.toCurrency, toCurrency: values.currency, amount: values.amountTo ?? values.amount, amountTo: values.amount });
              touch('toAccount');
            }}
            fromError={fromForex ? undefined : errorView('account')}
            toError={toForex ? undefined : errorView('toAccount')}
            placeholder={chooseAccountPlaceholder()}
          />
        ) : (
          <AccountField
            account={account}
            balanceAfter={fromForex ? null : balanceAfter(account, values.amount, values.type === 'income' ? 'in' : 'out')}
            onPress={() => setSheet('account')}
            error={fromForex ? undefined : errorView('account')}
            placeholder={chooseAccountPlaceholder()}
          />
        )}

        {fromForex && (
          <PocketChips
            pockets={accountPockets}
            selected={values.currency}
            label={isTransfer ? valasPocketFromLabel() : undefined}
            onSelect={currency => {
              set({ currency });
              touch('account');
            }}
            error={errorView('account')}
            testID="tx-pocket-chips"
          />
        )}
        {isTransfer && toForex && (
          <PocketChips
            pockets={toPockets}
            selected={values.toCurrency}
            label={valasPocketToLabel()}
            onSelect={toCurrency => {
              set({ toCurrency });
              touch('toAccount');
            }}
            error={errorView('toAccount')}
            testID="tx-pocket-chips-to"
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

        {locationStatus && locationStatus !== 'idle' && (
          <>
            <Pressable style={styles.locationChip} onPress={onLocationPress} accessibilityRole="button">
              <Text style={styles.locationChipText}>
                {locationStatus === 'capturing' ? txLocationCapturing() : locationStatus === 'ready' ? locationSaved() : txLocationUnavailable()}
              </Text>
              {locationStatus === 'unavailable' && <Text style={styles.locationRetryText}>{txLocationRetry()}</Text>}
            </Pressable>
            {locationStatus === 'ready' && (
              <TextBox label={txLocationPlaceLabel()} value={placeName ?? ''} onChange={value => onPlaceNameChange?.(value.slice(0, 60))} placeholder={txLocationPlacePlaceholder()} testID="tx-location-place" />
            )}
          </>
        )}

        <TextBox
          label={isTransfer ? formDescriptionOptionalLabel() : formDescriptionLabel()}
          value={values.description}
          onChange={onDescription}
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
        allowForex={allowForex}
        onSelect={id => {
          if (sheet === 'to') {
            // A Valas pocket on the receiving side differs from the sending one when both are Valas.
            set({ toAccountId: id, toCurrency: currencyFor(id, values.toCurrency, values.accountId === id ? srcCurrency : undefined) });
            touch('toAccount');
          } else {
            set({ accountId: id, currency: currencyFor(id, values.currency) });
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
          autoFilled.current = false;
          set({ categoryId: id, subcategoryId: id === values.categoryId ? values.subcategoryId : null });
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
  // The board's header pill (the Chat button of Tx-Add): 44 high, outlined, icon and label.
  content: { padding: 16, gap: 20 },
  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: BAR_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 12 },
  cancelButton: { width: 104 },
  saveButton: { flex: 1 },
  locationChip: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, paddingHorizontal: 10, paddingVertical: 7 },
  locationChipText: { ...MonoText.caption, color: MonoColors.textSecond },
  locationRetryText: { ...MonoText.caption, color: MonoColors.text },
});
