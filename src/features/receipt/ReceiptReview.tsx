// Hasil scan (board Receipt-Review): what the scan found, as a draft expense to check before saving.
// A dashed draft card (shop, date, the total as chips to pick from, category, account), a notice
// when a similar expense already exists, and Batal / Simpan pengeluaran. The photo shows as a thumbnail
// (a cached copy, deleted when this screen closes) and nothing is a transaction until Simpan, which goes through the same save function as the
// manual form (source 'scan'), so every guard and the rupiah value apply.
//
// The shop, the total, the category, the account and the date can all be changed here; the form's
// own rules (validate.ts) decide what blocks Simpan. "Balance after" is the account's balance minus
// the total, worked out on the spot and never stored.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { balanceAfter, visibleErrors, type TxFieldError, type TxFieldKey } from '@/core/tx/validate';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { findSimilarExpense } from '@/data/repo/transactions';
import type { TxFormData } from '@/domain/txForm';
import type { AiErrorCode } from '@/features/ai_chat/client';
import { errorMessage } from '@/features/ai_chat/messages';
import type { TidyContext, TidyResult } from '@/features/ai_chat/receiptTidy';
import { ErrorLine, parseDigits, type ErrorView } from '@/features/transactions/form/formParts';
import { AccountSheet, CategorySheet, DateSheet } from '@/features/transactions/form/formSheets';
import { useAddSubmit } from '@/features/transactions/form/useTxForm';
import {
  receiptAccountLabel,
  receiptAiAdjusted,
  receiptAiBusy,
  receiptAiButton,
  receiptAiNote,
  receiptAiNothingChanged,
  receiptCategoryByAi,
  receiptConsentCancel,
  receiptConsentConfirm,
  receiptConsentLead,
  receiptConsentRest,
  receiptConsentStrong,
  receiptConsentTitle,
  receiptBackLabel,
  receiptBalanceAfter,
  receiptCancelLabel,
  receiptCategoryLabel,
  receiptChooseCategory,
  receiptDateLabel,
  receiptDateLine,
  receiptDraftTag,
  receiptNotSavedLabel,
  receiptOnDeviceNote,
  receiptOnDeviceTitle,
  receiptReviewTitle,
  receiptSaveLabel,
  receiptSavingLabel,
  receiptShopLabel,
  receiptSimilarNotice,
  receiptTotalOwnLabel,
  receiptTotalPick,
  receiptTotalTypeOwn,
  txFieldErrorMessage,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { applyTidy, draftErrors, similarWindow, toDraft, toFormValues, type ScanDraft, type TidyField } from './draft';
import type { ParsedReceipt } from './parse';
import { useReceiptStore } from './store';

const FIELD_FILL = '#151516';
const FIELD_BORDER = '#272728';

type SheetName = 'account' | 'category' | 'date' | null;

export interface ReceiptReviewProps {
  parsed: ParsedReceipt;
  imageUri: string | null; // the cached picture, for the thumbnail
  data: TxFormData;
  lastAccountId: number | null;
  today: string;
  onBack: () => void;
  // "Rapikan dengan AI": the recognized lines (kept in memory only for this), whether the AI is set up
  // and switched on, how to ask the model, and where to go when it is not set up.
  lines: readonly string[];
  aiConfigured: boolean;
  tidy: (lines: readonly string[], ctx: TidyContext) => Promise<TidyResult>;
  onOpenAiSetup: () => void;
}

export function ReceiptReview({ parsed, imageUri, data, lastAccountId, today, onBack, lines, aiConfigured, tidy, onOpenAiSetup }: ReceiptReviewProps) {
  const insets = useSafeAreaInsets();
  const db = useDb();
  const hidden = useHideAmounts(s => s.hidden);
  const submit = useAddSubmit(data, 'scan');

  const [draft, setDraft] = useState<ScanDraft>(() => toDraft(parsed, { accounts: data.accounts, categories: data.categories, lastAccountId }));
  const [typing, setTyping] = useState(false); // the total is being typed, not picked
  const [sheet, setSheet] = useState<SheetName>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // "Rapikan dengan AI": the consent dialog, the request, its outcome, and which fields the person
  // changed themselves (the AI never overwrites those).
  const [consent, setConsent] = useState(false);
  const [tidying, setTidying] = useState(false);
  const [tidyError, setTidyError] = useState<AiErrorCode | null>(null);
  const [tidyAdjusted, setTidyAdjusted] = useState(false);
  const [tidyNothing, setTidyNothing] = useState(false);
  const [aiCategory, setAiCategory] = useState(false);
  const [edited, setEdited] = useState<ReadonlySet<TidyField>>(new Set());
  const markEdited = (field: TidyField) => setEdited(s => (s.has(field) ? s : new Set(s).add(field)));

  const patch = (change: Partial<ScanDraft>) => {
    setDraft(d => ({ ...d, ...change }));
    setServerError(null);
  };

  const rpFormat = (n: number) => shown(rp(n), hidden);
  const account = data.accounts.find(a => a.id === draft.accountId);
  const category = data.categories.find(c => c.id === draft.categoryId);
  const expenseCategories = useMemo(() => data.categories.filter(c => c.kind === 'expense'), [data.categories]);

  const errors = useMemo(() => draftErrors(draft, { today, accounts: data.accounts, categories: data.categories }), [draft, today, data.accounts, data.categories]);
  const visible = useMemo(() => visibleErrors(errors, new Set<TxFieldKey>(), submitted), [errors, submitted]);
  const errorView = (field: TxFieldKey): ErrorView | undefined => {
    const error: TxFieldError | undefined = visible.find(e => e.field === field);
    if (!error) return undefined;
    return { text: txFieldErrorMessage({ ...error, type: 'expense' }, rpFormat, formatShortDate).text };
  };
  const hasVisibleErrors = visible.length > 0;

  // A similar expense (same account and amount, within a day), as a hint only.
  const window = similarWindow(draft.date);
  const similar = useQuery({
    queryKey: [...queryKeys.transactions, 'similar', draft.accountId, draft.amount, draft.date],
    queryFn: () => findSimilarExpense(db, { accountId: draft.accountId as number, amount: draft.amount, date: draft.date, ...window }),
    enabled: draft.accountId != null && draft.amount > 0,
    staleTime: 0,
  });

  const onSave = async () => {
    if (errors.length > 0) {
      setSubmitted(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setServerError(null);
    const result = await submit(toFormValues(draft));
    setSaving(false);
    if (result.ok) useReceiptStore.getState().clear();
    else setServerError(result.message);
  };

  const runTidy = async () => {
    setConsent(false);
    setTidying(true);
    setTidyError(null);
    setTidyNothing(false);
    const reply = await tidy(lines, { today, accounts: data.accounts, categories: data.categories });
    setTidying(false);
    if (!reply.ok) {
      setTidyError(reply.code);
      return;
    }
    const applied = applyTidy(draft, reply, { accounts: data.accounts, categories: data.categories }, edited);
    setDraft(applied.draft);
    setAiCategory(applied.aiCategory);
    setTidyAdjusted(true);
    setTidyNothing(!applied.changed && !applied.aiCategory);
    setServerError(null);
  };
  const tidyErrorText = tidyError ? errorMessage(tidyError).text : '';

  const after = balanceAfter(account, draft.amount, 'out');
  const amountError = errorView('amount');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={receiptBackLabel()} onPress={onBack} testID="review-back">
          <Icon name="chevron-left" size={24} color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {receiptReviewTitle()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.privacy}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" accessible={false} accessibilityIgnoresInvertColors testID="review-thumb" />
          ) : (
            <View style={styles.privacyIcon}>
              <Icon name="receipt" size={20} color={MonoColors.accent} />
            </View>
          )}
          <View style={styles.privacyText}>
            <Text style={styles.privacyTitle}>{receiptOnDeviceTitle()}</Text>
            <Text style={styles.caption}>{receiptOnDeviceNote()}</Text>
          </View>
        </View>

        <View style={styles.draft} testID="review-draft">
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{receiptDraftTag()}</Text>
            </View>
            <Text style={styles.caption}>{receiptNotSavedLabel()}</Text>
          </View>

          <TextInput
            value={draft.description}
            onChangeText={description => {
              markEdited('shop');
              patch({ description });
            }}
            placeholder={receiptShopLabel()}
            placeholderTextColor={MonoColors.textDisabled}
            selectionColor={MonoColors.text}
            accessibilityLabel={receiptShopLabel()}
            style={styles.name}
            testID="review-name"
          />
          <Text style={styles.caption} testID="review-date-line">
            {(tidyAdjusted ? `${receiptAiAdjusted()} · ` : '') + receiptDateLine(formatShortDate(draft.date), draft.dateFromReceipt)}
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>{receiptTotalPick()}</Text>
            <View style={styles.chips}>
              {draft.totals.map(total => {
                const selected = !typing && draft.amount === total;
                return (
                  <Chip
                    key={total}
                    label={shown(rp(total), hidden)}
                    selected={selected}
                    onPress={() => {
                      setTyping(false);
                      patch({ amount: total });
                    }}
                    style={styles.totalChip}
                    testID={`review-total-${total}`}
                  />
                );
              })}
              <Chip label={receiptTotalTypeOwn()} selected={typing} onPress={() => setTyping(true)} style={styles.totalChip} testID="review-total-own" />
            </View>
            {typing && (
              <View style={styles.ownRow}>
                <Text style={styles.rp}>Rp</Text>
                <TextInput
                  value={draft.amount ? String(draft.amount) : ''}
                  onChangeText={text => patch({ amount: parseDigits(text) })}
                  keyboardType="number-pad"
                  autoFocus
                  placeholder="0"
                  placeholderTextColor={MonoColors.textDisabled}
                  selectionColor={MonoColors.text}
                  accessibilityLabel={receiptTotalOwnLabel()}
                  style={styles.ownInput}
                  testID="review-total-input"
                />
              </View>
            )}
            {amountError && <ErrorLine error={amountError} testID="review-amount-error" />}
          </View>

          <View style={styles.rows}>
            <ReviewRow label={receiptCategoryLabel()} onPress={() => setSheet('category')} flagged={!!errorView('category')} testID="review-category">
              <Text style={[styles.value, !category && styles.placeholder]}>{category ? (aiCategory ? receiptCategoryByAi(category.name) : category.name) : receiptChooseCategory()}</Text>
            </ReviewRow>
            {errorView('category') && <ErrorLine error={errorView('category') as ErrorView} testID="review-category-error" />}

            <ReviewRow label={receiptAccountLabel()} onPress={() => setSheet('account')} flagged={!!errorView('account')} testID="review-account">
              <Text style={styles.value}>{account?.name ?? ''}</Text>
              {after != null && draft.amount > 0 && <Text style={styles.caption}>{receiptBalanceAfter(shown(rp(after), hidden))}</Text>}
            </ReviewRow>
            {errorView('account') && <ErrorLine error={errorView('account') as ErrorView} testID="review-account-error" />}

            <ReviewRow label={receiptDateLabel()} onPress={() => setSheet('date')} flagged={!!errorView('date')} testID="review-date">
              <Text style={styles.value}>{formatShortDate(draft.date)}</Text>
            </ReviewRow>
            {errorView('date') && <ErrorLine error={errorView('date') as ErrorView} testID="review-date-error" />}
          </View>
        </View>

        {similar.data && (
          <View style={styles.notice} testID="review-similar">
            <Icon name="info" size={20} color={MonoColors.textSecond} />
            <Text style={styles.noticeText}>{receiptSimilarNotice(formatShortDate(similar.data.occurred_on), rpFormat(similar.data.amount), similar.data.description)}</Text>
          </View>
        )}

        {tidyNothing && (
          <View style={styles.notice} testID="review-ai-nothing">
            <Icon name="info" size={20} color={MonoColors.textSecond} />
            <Text style={styles.noticeText}>{receiptAiNothingChanged()}</Text>
          </View>
        )}

        <Button
          label={tidying ? receiptAiBusy() : receiptAiButton()}
          icon="spark"
          variant="secondary"
          disabled={tidying}
          onPress={() => (aiConfigured ? setConsent(true) : onOpenAiSetup())}
          testID="review-ai"
        />
        {!!tidyErrorText && <ErrorLine error={{ text: tidyErrorText }} testID="review-ai-error" />}
        <Text style={[styles.caption, styles.center]}>{receiptAiNote()}</Text>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {hasVisibleErrors && <ErrorLine error={{ text: errors.length > 0 ? txFieldErrorMessage({ ...errors[0], type: 'expense' }, rpFormat, formatShortDate).text : '' }} testID="review-error-summary" />}
        {!!serverError && <ErrorLine error={{ text: serverError }} testID="review-server-error" />}
        <View style={styles.barRow}>
          <Button label={receiptCancelLabel()} variant="secondary" onPress={onBack} style={styles.cancel} testID="review-cancel" />
          <Button
            label={saving ? receiptSavingLabel() : receiptSaveLabel()}
            onPress={() => void onSave()}
            disabled={hasVisibleErrors || saving}
            style={styles.save}
            testID="review-save"
          />
        </View>
      </View>

      <ConfirmDialog
        visible={consent}
        icon="spark"
        iconColor={MonoColors.accent}
        title={receiptConsentTitle()}
        message={[{ text: receiptConsentLead() }, { text: receiptConsentStrong(), strong: true }, { text: receiptConsentRest() }]}
        cancelLabel={receiptConsentCancel()}
        confirmLabel={receiptConsentConfirm()}
        onCancel={() => setConsent(false)}
        onConfirm={() => void runTidy()}
        testID="review-ai-consent"
      />

      <AccountSheet
        visible={sheet === 'account'}
        role="account"
        accounts={data.accounts}
        selectedId={draft.accountId}
        onSelect={id => {
          markEdited('account');
          patch({ accountId: id });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <CategorySheet
        visible={sheet === 'category'}
        kind="expense"
        categories={expenseCategories}
        selectedId={draft.categoryId}
        onSelect={id => {
          markEdited('category');
          setAiCategory(false);
          patch({ categoryId: id });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'date'}
        selected={draft.date}
        today={today}
        onSelect={date => {
          patch({ date, dateFromReceipt: date === parsed.date && parsed.dateFromReceipt });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, onPress, flagged, children, testID }: { label: string; onPress: () => void; flagged: boolean; children: ReactNode; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={undefined}
      style={({ pressed }) => [styles.row, flagged && styles.rowFlagged, pressed && styles.rowPressed]}
      testID={testID}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
      <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 },

  privacy: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  // The same 36 icon disc as everywhere else (the board's .ic): radius 14, #1D1D1E, border #2A2A2B.
  privacyIcon: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  // The photo that was scanned, small (the board's 56 x 72, radius 6).
  thumb: { width: 56, height: 72, borderRadius: 6, backgroundColor: MonoColors.card },
  privacyText: { flex: 1 },
  privacyTitle: { ...MonoText.h2, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  center: { textAlign: 'center' },

  draft: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: MonoColors.textDisabled, backgroundColor: '#101011', borderRadius: 16, padding: 14, gap: 4 },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { minHeight: 24, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: MonoColors.textDisabled, borderRadius: 12 },
  tagText: { ...MonoText.label, color: MonoColors.text },
  name: { ...MonoText.titleM, color: MonoColors.text, paddingVertical: 8, marginTop: 6 },

  section: { marginTop: 12, gap: 8 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalChip: { height: undefined, minHeight: 40, paddingVertical: 8, borderRadius: 14 },
  ownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
  rp: { ...MonoText.figureS, color: MonoColors.textSecond },
  ownInput: { ...MonoText.figureS, color: MonoColors.text, flex: 1, padding: 0 },

  rows: { marginTop: 12, borderTopWidth: 1, borderTopColor: FIELD_BORDER },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: FIELD_BORDER },
  rowFlagged: { borderBottomColor: MonoColors.negative },
  rowPressed: { opacity: 0.85 },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textMeta, width: 78 },
  rowValue: { flex: 1, alignItems: 'flex-end' },
  value: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text, textAlign: 'right' },
  placeholder: { color: MonoColors.textDisabled },

  notice: { flexDirection: 'row', gap: 10, padding: 12, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, borderRadius: 14, alignItems: 'flex-start' },
  noticeText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: FIELD_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 8 },
  cancel: { width: 104 },
  save: { flex: 1 },
});
