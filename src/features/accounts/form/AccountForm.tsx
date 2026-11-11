// The account form (Account-Edit, for a new account and for an existing one): the type tiles, the
// name, the opening balance with its date, an optional bank icon, and the note that no bank login
// or card number is ever needed. It owns the form's state and nothing else: the rules are
// src/core/account/validate.ts's (pure, tested) and saving is the caller's `onSubmit`.
//
// Errors appear after their field was touched or Save was tapped, never all at once on a fresh
// form; Save is off while an error shows, and tapping it on an invalid form reveals what is wrong
// instead of saving. An error is a 1.5 px red border, a warning icon and a sentence.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankTile } from '@/components/BankCard';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { rp, shown } from '@/core/money';
import {
  validateAccount,
  visibleAccountErrors,
  type AccountFieldKey,
  type AccountFormValues,
  type AccountValidationContext,
  type PlainAccountType,
} from '@/core/account/validate';
import { ErrorLine, AmountCard, type ErrorView } from '@/features/transactions/form/formParts';
import { DateSheet } from '@/features/transactions/form/formSheets';
import {
  accountFieldErrorMessage,
  accountIconSectionLabel,
  accountNameLabel,
  accountNamePlaceholder,
  accountPrivacyNote,
  accountTypeSectionLabel,
  accountTypeTileLabel,
  asOfDateLabel,
  bankIconAccessibilityLabel,
  cancelLabel,
  closeLabel,
  createAccountLabel,
  editAccountLabel,
  fieldsNeedAttention,
  newAccountTitle,
  noBankIconLabel,
  openingBalanceHelp,
  openingBalanceLabel,
  saveButtonLabel,
  savingLabel,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { brandsForType, iconFitsType } from './brands';

const FIELD_FILL = '#151516';
const FIELD_BORDER = '#272728';
const BAR_BORDER = '#272728';
const TYPES: PlainAccountType[] = ['bank', 'cash', 'ewallet', 'savings'];
const TYPE_ICONS: Record<PlainAccountType, IconName> = { bank: 'bank', cash: 'banknote', ewallet: 'phone', savings: 'savings' };

export type AccountSubmitResult = { ok: true } | { ok: false; message: string };

export interface AccountFormProps {
  mode: 'add' | 'edit';
  initial: AccountFormValues;
  context: AccountValidationContext;
  onCancel: () => void;
  onSubmit: (values: AccountFormValues) => Promise<AccountSubmitResult>;
}

export function AccountForm({ mode, initial, context, onCancel, onSubmit }: AccountFormProps) {
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(s => s.hidden);
  const [values, setValues] = useState<AccountFormValues>(initial);
  const [touched, setTouched] = useState<ReadonlySet<AccountFieldKey>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  const set = useCallback((patch: Partial<AccountFormValues>) => {
    setValues(v => ({ ...v, ...patch }));
    setServerError(null);
  }, []);
  const touch = useCallback((field: AccountFieldKey) => setTouched(t => (t.has(field) ? t : new Set(t).add(field))), []);

  // Android back closes the date sheet before it leaves the screen.
  useEffect(() => {
    if (!dateOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDateOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [dateOpen]);

  const errors = useMemo(() => validateAccount(values, context), [values, context]);
  const visible = useMemo(() => visibleAccountErrors(errors, touched, submitted), [errors, touched, submitted]);

  const rpFormat = useCallback((n: number) => shown(rp(n), hidden), [hidden]);
  const errorView = (field: AccountFieldKey): ErrorView | undefined => {
    const error = visible.find(e => e.field === field);
    return error ? { text: accountFieldErrorMessage(error, rpFormat, formatShortDate) } : undefined;
  };
  const nameError = errorView('name');
  const dateError = errorView('openingDate');

  const brands = useMemo(() => brandsForType(values.type), [values.type]);

  const changeType = (type: PlainAccountType) => {
    if (type === values.type) return;
    // A bank mark does not belong on an e-wallet (and the other way round).
    set({ type, icon: iconFitsType(values.icon, type) ? values.icon : null });
  };

  const fieldCount = new Set(visible.map(e => e.field)).size;
  const hasVisibleErrors = visible.length > 0;
  const selectedBrand = brands.find(b => b.slug === values.icon);

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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <IconButton label={closeLabel()} onPress={onCancel} testID="account-form-close">
            <Icon name="close" color={MonoColors.text} />
          </IconButton>
          <Text style={styles.title} accessibilityRole="header">
            {mode === 'edit' ? editAccountLabel() : newAccountTitle()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="account-form-scroll">
        <View>
          <Text style={styles.label}>{accountTypeSectionLabel()}</Text>
          <View style={styles.typeGrid} accessibilityRole="radiogroup">
            {TYPES.map(type => {
              const selected = values.type === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => changeType(type)}
                  accessibilityRole="radio"
                  accessibilityLabel={accountTypeTileLabel(type)}
                  accessibilityState={{ selected }}
                  android_ripple={undefined}
                  style={({ pressed }) => [styles.typeTile, selected && styles.typeTileSelected, pressed && !selected && styles.pressed]}
                  testID={`account-type-${type}`}
                >
                  <Icon name={TYPE_ICONS[type]} size={20} color={selected ? MonoColors.bg : MonoColors.textSecond} />
                  <Text style={selected ? styles.typeTextSelected : styles.typeText}>{accountTypeTileLabel(type)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{accountNameLabel()}</Text>
            {!!nameError && <Icon name="alert" size={16} color={MonoColors.negative} />}
          </View>
          <TextInput
            value={values.name}
            onChangeText={name => set({ name })}
            onFocus={() => setNameFocused(true)}
            onBlur={() => {
              setNameFocused(false);
              touch('name');
            }}
            placeholder={accountNamePlaceholder()}
            placeholderTextColor={MonoColors.textDisabled}
            selectionColor={MonoColors.text}
            accessibilityLabel={accountNameLabel()}
            accessibilityHint={nameError?.text}
            style={[styles.nameInput, nameFocused && styles.nameFocused, !!nameError && styles.nameError]}
            testID="account-name"
          />
          {!!nameError && <ErrorLine error={nameError} testID="account-name-error" />}
        </View>

        <View>
          <AmountCard
            value={values.openingBalance}
            onChange={openingBalance => set({ openingBalance })}
            onBlur={() => touch('openingBalance')}
            label="amount"
            title={openingBalanceLabel()}
            quickAdds={[]}
            error={errorView('openingBalance')}
          />
          <Pressable
            onPress={() => setDateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={asOfDateLabel(formatShortDate(values.openingDate))}
            accessibilityHint={dateError?.text}
            android_ripple={undefined}
            style={({ pressed }) => [styles.dateField, !!dateError && styles.dateFieldError, pressed && styles.pressed]}
            testID="account-date-button"
          >
            <Icon name="calendar" size={20} color={MonoColors.textSecond} />
            <Text style={styles.dateText}>{asOfDateLabel(formatShortDate(values.openingDate))}</Text>
          </Pressable>
          {!!dateError && <ErrorLine error={dateError} testID="account-date-error" />}
          <Text style={styles.help}>{openingBalanceHelp()}</Text>
        </View>

        {brands.length > 0 && (
          <View testID="account-icons">
            <Text style={styles.label}>{accountIconSectionLabel()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow} accessibilityRole="radiogroup">
              <Pressable
                onPress={() => set({ icon: null })}
                accessibilityRole="radio"
                accessibilityLabel={noBankIconLabel()}
                accessibilityState={{ selected: values.icon == null }}
                android_ripple={undefined}
                style={[styles.iconTile, values.icon == null && styles.iconTileSelected]}
                testID="account-icon-none"
              >
                <BankTile icon={null} type={values.type} size={40} />
              </Pressable>
              {brands.map(brand => (
                <Pressable
                  key={brand.slug}
                  onPress={() => set({ icon: brand.slug })}
                  accessibilityRole="radio"
                  accessibilityLabel={bankIconAccessibilityLabel(brand.name)}
                  accessibilityState={{ selected: values.icon === brand.slug }}
                  android_ripple={undefined}
                  style={[styles.iconTile, values.icon === brand.slug && styles.iconTileSelected]}
                  testID={`account-icon-${brand.slug}`}
                >
                  <BankTile icon={brand.slug} type={values.type} size={40} />
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.help}>{selectedBrand ? selectedBrand.name : noBankIconLabel()}</Text>
          </View>
        )}

        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={MonoColors.textMeta} />
          <Text style={styles.privacyText}>{accountPrivacyNote()}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {hasVisibleErrors && <ErrorLine error={{ text: fieldsNeedAttention(fieldCount) }} testID="account-error-summary" />}
        {!!serverError && <ErrorLine error={{ text: serverError }} testID="account-server-error" />}
        <View style={styles.barRow}>
          <Button label={cancelLabel()} variant="secondary" onPress={onCancel} style={styles.cancelButton} testID="account-cancel" />
          <Button
            label={saving ? savingLabel() : mode === 'edit' ? saveButtonLabel('edit') : createAccountLabel()}
            onPress={() => void onSavePress()}
            disabled={hasVisibleErrors || saving}
            style={styles.saveButton}
            testID="account-save"
          />
        </View>
      </View>

      <DateSheet
        visible={dateOpen}
        selected={values.openingDate}
        today={context.today}
        onSelect={openingDate => {
          set({ openingDate });
          touch('openingDate');
          setDateOpen(false);
        }}
        onClose={() => setDateOpen(false)}
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
  label: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase', marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.85 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeTile: { flexBasis: '48%', flexGrow: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL },
  typeTileSelected: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  typeText: { ...MonoText.bodyStrong, color: MonoColors.text },
  typeTextSelected: { ...MonoText.bodyStrong, color: MonoColors.bg },

  nameInput: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, paddingHorizontal: 14, paddingVertical: 12, ...MonoText.body, color: MonoColors.text },
  nameFocused: { borderColor: MonoColors.text },
  nameError: { borderColor: MonoColors.negative, borderWidth: 1.5 },

  dateField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL },
  dateFieldError: { borderColor: MonoColors.negative, borderWidth: 1.5 },
  dateText: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  help: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 10 },

  iconRow: { gap: 10, paddingVertical: 4, paddingRight: 16 },
  iconTile: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, alignItems: 'center', justifyContent: 'center' },
  iconTileSelected: { borderColor: MonoColors.text, borderWidth: 1.5 },

  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacyText: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },

  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: BAR_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 12 },
  cancelButton: { width: 104 },
  saveButton: { flex: 1 },
});
