// Periksa (board N4, screen 27): one detected transaction, to check before it becomes a real one. Kind, amount,
// merchant, category, account and date can all be changed; Simpan goes through the domain (the same checks as the
// manual form), Tolak drops it. "Ingat kategori" keeps the category for this merchant on this phone, so the next
// notification from it arrives with the category filled in. Nothing is a transaction until Simpan.
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { Segmented } from '@/components/Segmented';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatDateTime, formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import { suggestFromDescription } from '@/core/tx/suggest';
import { balanceAfter } from '@/core/tx/validate';
import type { QueueKind, QueueRowWithNames } from '@/data/repo/importQueue';
import type { TxFormData } from '@/domain/txForm';
import { merchantKey } from '@/features/import/categorize';
import { ErrorLine, parseDigits, SubcategoryRow } from '@/features/transactions/form/formParts';
import { AccountSheet, CategorySheet, DateSheet } from '@/features/transactions/form/formSheets';
import {
  importAccountLabel,
  importAmountLabel,
  importBackLabel,
  importBadgeCheck,
  importBadgeGuessed,
  importCategoryLabel,
  importDateLabel,
  importDraftTag,
  importEditTitle,
  importFromApp,
  importKindLabel,
  importMerchantLabel,
  importMerchantPlaceholder,
  importNotSaved,
  importPickCategory,
  importPickKind,
  importReject,
  importRememberSwitch,
  importSave,
  importSaving,
  receiptBalanceAfter,
  txKindLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const FIELD_FILL = '#151516';
const FIELD_BORDER = '#272728';

export interface ImportEditChange {
  kind: QueueKind | null;
  amountIdr: number;
  merchant: string;
  categoryId: number | null;
  accountId: number;
  date: string;
  subcategoryId: number | null;
}

export interface ImportEditViewProps {
  item: QueueRowWithNames;
  data: TxFormData;
  today: string;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  // Save the changes first, then Simpan (the domain saves from the stored row).
  onSave: (change: ImportEditChange, remember: boolean) => void;
  onReject: () => void;
}

type SheetName = 'account' | 'category' | 'date' | null;

export function ImportEditView({ item, data, today, saving, error, onBack, onSave, onReject }: ImportEditViewProps) {
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(s => s.hidden);

  const [kind, setKind] = useState<QueueKind | null>(item.kind);
  const [amount, setAmount] = useState(item.amount_idr);
  const [merchant, setMerchant] = useState(item.merchant);
  // What the same merchant was filed under before; it fills only what the notification import left empty.
  const [found] = useState(() => (item.kind ? suggestFromDescription(item.merchant, item.kind, data) : null));
  const [categoryId, setCategoryId] = useState<number | null>(item.category_id ?? found?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(found && found.categoryId === (item.category_id ?? found.categoryId) ? found.subcategoryId : null);
  const [accountId, setAccountId] = useState(item.account_id);
  const [date, setDate] = useState(item.occurred_at.slice(0, 10));
  const [remember, setRemember] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);

  const accounts = useMemo(() => data.accounts.filter(a => a.type !== 'forex'), [data.accounts]);
  const account = accounts.find(a => a.id === accountId);
  const categories = useMemo(() => (kind ? data.categories.filter(c => c.kind === kind) : []), [data.categories, kind]);
  const category = categories.find(c => c.id === categoryId);
  const subcategories = category ? (data.subcategories ?? []).filter(s => s.categoryId === category.id) : [];
  const after = kind === 'expense' || kind === 'income' ? balanceAfter(account, amount, kind === 'expense' ? 'out' : 'in') : null;
  const canRemember = !!merchantKey(merchant) && categoryId !== null;
  const canSave = kind !== null && categoryId !== null && amount > 0 && !saving;

  const changeKind = (next: string) => {
    const value = next as QueueKind;
    setKind(value);
    // A category of the other kind no longer fits.
    if (category && category.kind !== value) {
      setCategoryId(null);
      setSubcategoryId(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" testID="import-edit">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={importBackLabel()} onPress={onBack} testID="import-edit-back">
          <Icon name="chevron-left" size={24} color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {importEditTitle()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.draft}>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{importDraftTag()}</Text>
            </View>
            <Text style={styles.caption}>{importNotSaved()}</Text>
          </View>
          <View style={styles.badges}>
            {item.kind === null && kind === null && (
              <View style={styles.badge}>
                <Icon name="alert" size={16} color={MonoColors.text} />
                <Text style={styles.badgeText}>{importBadgeCheck()}</Text>
              </View>
            )}
            {item.guessed === 1 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{importBadgeGuessed()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.caption} testID="import-edit-source">
            {importFromApp(item.app_name, formatDateTime(item.occurred_at))}
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>{importKindLabel()}</Text>
            <Segmented
              options={[
                { value: 'expense', label: txKindLabel('expense') },
                { value: 'income', label: txKindLabel('income') },
              ]}
              value={kind ?? ''}
              onChange={changeKind}
              testID="import-edit-kind"
            />
            {kind === null && <Text style={styles.caption}>{importPickKind()}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{importAmountLabel()}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.rp}>Rp</Text>
              <TextInput
                value={amount ? String(amount) : ''}
                onChangeText={text => setAmount(parseDigits(text))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={MonoColors.textDisabled}
                selectionColor={MonoColors.text}
                accessibilityLabel={importAmountLabel()}
                style={styles.amountInput}
                testID="import-edit-amount"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{importMerchantLabel()}</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={importMerchantPlaceholder()}
              placeholderTextColor={MonoColors.textDisabled}
              selectionColor={MonoColors.text}
              accessibilityLabel={importMerchantLabel()}
              maxLength={80}
              style={styles.input}
              testID="import-edit-merchant"
            />
          </View>

          <View style={styles.rows}>
            <EditRow label={importCategoryLabel()} onPress={() => setSheet('category')} disabled={kind === null} testID="import-edit-category">
              <Text style={[styles.value, !category && styles.placeholder]}>{category ? category.name : importPickCategory()}</Text>
            </EditRow>
            <EditRow label={importAccountLabel()} onPress={() => setSheet('account')} testID="import-edit-account">
              <Text style={styles.value}>{account?.name ?? ''}</Text>
              {after != null && amount > 0 && <Text style={styles.caption}>{receiptBalanceAfter(shown(rp(after), hidden))}</Text>}
            </EditRow>
            <EditRow label={importDateLabel()} onPress={() => setSheet('date')} testID="import-edit-date">
              <Text style={styles.value}>{formatShortDate(date)}</Text>
            </EditRow>
          </View>

          {subcategories.length > 0 && (
            <View style={styles.section}>
              <SubcategoryRow subcategories={subcategories} selectedId={subcategoryId} onSelect={setSubcategoryId} />
            </View>
          )}

          {canRemember && (
            <View style={styles.rememberRow}>
              <Text style={styles.rememberText}>{importRememberSwitch()}</Text>
              <MonoSwitch value={remember} onValueChange={setRemember} label={importRememberSwitch()} testID="import-edit-remember" />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {!!error && <ErrorLine error={{ text: error }} testID="import-edit-error" />}
        <View style={styles.barRow}>
          <Button label={importReject()} variant="secondary" onPress={onReject} disabled={saving} style={styles.reject} testID="import-edit-reject" />
          <Button
            label={saving ? importSaving() : importSave()}
            onPress={() => onSave({ kind, amountIdr: amount, merchant: merchant.trim(), categoryId, accountId, date, subcategoryId: subcategories.some(s => s.id === subcategoryId) ? subcategoryId : null }, remember)}
            disabled={!canSave}
            style={styles.save}
            testID="import-edit-save"
          />
        </View>
      </View>

      <AccountSheet
        visible={sheet === 'account'}
        role="account"
        accounts={accounts}
        selectedId={accountId}
        onSelect={id => {
          setAccountId(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <CategorySheet
        visible={sheet === 'category'}
        kind={kind ?? 'expense'}
        categories={categories}
        selectedId={categoryId}
        onSelect={id => {
          if (id !== categoryId) setSubcategoryId(null);
          setCategoryId(id);
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
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

function EditRow({ label, onPress, disabled, children, testID }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode; testID: string }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={undefined}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
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
  caption: { ...MonoText.caption, color: MonoColors.textMeta },

  draft: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: MonoColors.textDisabled, backgroundColor: '#101011', borderRadius: 16, padding: 14, gap: 8 },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { minHeight: 24, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: MonoColors.textDisabled, borderRadius: 12 },
  tagText: { ...MonoText.label, color: MonoColors.text },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { minHeight: 26, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2A2A2B', borderRadius: 13 },
  badgeText: { ...MonoText.caption, color: MonoColors.text },

  section: { marginTop: 8, gap: 8 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
  rp: { ...MonoText.figureS, color: MonoColors.textSecond },
  amountInput: { ...MonoText.figureS, color: MonoColors.text, flex: 1, padding: 0 },
  input: { ...MonoText.body, color: MonoColors.text, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },

  rows: { marginTop: 8, borderTopWidth: 1, borderTopColor: FIELD_BORDER },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: FIELD_BORDER },
  rowPressed: { opacity: 0.85 },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textMeta, width: 78 },
  rowValue: { flex: 1, alignItems: 'flex-end' },
  value: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text, textAlign: 'right' },
  placeholder: { color: MonoColors.textDisabled },

  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, minHeight: 48 },
  rememberText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: FIELD_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 8 },
  reject: { width: 104 },
  save: { flex: 1 },
});
