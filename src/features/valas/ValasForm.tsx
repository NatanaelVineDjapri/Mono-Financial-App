// The Valas account form (board Valas-Edit), for creating the account and for changing it.
//
//   create: the type tile "Valas · mata uang asing", the name, the list of currencies each with its
//           opening balance and a remove button, "Tambah mata uang", the opening date, and "Buat akun"
//           (off until there is a currency). The account itself has no opening balance: the money
//           lives in the pockets.
//   edit:   the name, the existing pockets (read only, each with "Arsipkan" that works only at a
//           balance of exactly 0) and "Tambah mata uang".
//
// It owns the form state; the rules are formValidate.ts (pure, tested) and saving is the caller's.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Amount } from '@/components/Amount';
import { CurrencyFlag } from '@/components/CurrencyFlag';
import { formatShortDate } from '@/core/date';
import { currencySymbol } from '@/core/money';
import { ErrorLine } from '@/features/transactions/form/formParts';
import { DateSheet } from '@/features/transactions/form/formSheets';
import {
  cancelLabel,
  closeLabel,
  currencyName,
  fieldsNeedAttention,
  valasAddCurrency,
  valasArchiveHelp,
  valasCreateButton,
  valasCurrenciesLabel,
  valasCurrencyNone,
  valasFieldError,
  valasFormTitleEdit,
  valasFormTitleNew,
  valasNameLabel,
  valasNamePlaceholder,
  valasOpeningDateLabel,
  valasOpeningHelp,
  valasOpeningLabel,
  valasPocketsEditHeader,
  valasPocketArchive,
  valasPocketArchiveBlocked,
  valasRemoveCurrency,
  valasSaveButton,
  valasSavingLabel,
  valasTypeTile,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AddCurrencySheet } from './AddCurrencySheet';
import { MINOR_FACTORS } from './currencies';
import { validateValasForm, type ValasFormRow, type ValasFormValues } from './formValidate';

const FIELD_FILL = '#151516';
const FIELD_BORDER = '#272728';

export interface ValasFormPocket {
  currency: string;
  balance: number;
  minorFactor: number;
}

export type ValasFormResult = { ok: true } | { ok: false; message: string };

export interface ValasFormProps {
  mode: 'add' | 'edit';
  initial: ValasFormValues;
  today: string;
  otherNames: readonly string[];
  // edit only
  pockets?: readonly ValasFormPocket[];
  onAddPocket?: (currency: string) => Promise<ValasFormResult>;
  onArchivePocket?: (currency: string) => Promise<ValasFormResult>;
  onCancel: () => void;
  onSubmit: (values: ValasFormValues) => Promise<ValasFormResult>;
}

export function ValasForm({ mode, initial, today, otherNames, pockets = [], onAddPocket, onArchivePocket, onCancel, onSubmit }: ValasFormProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial.name);
  const [rows, setRows] = useState<readonly ValasFormRow[]>(initial.rows);
  const [openingDate, setOpeningDate] = useState(initial.openingDate);
  const [submitted, setSubmitted] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  // Android back closes an open sheet before it leaves the screen.
  useEffect(() => {
    if (!dateOpen && !sheetOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDateOpen(false);
      setSheetOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [dateOpen, sheetOpen]);

  const values = useMemo<ValasFormValues>(() => ({ name, rows, openingDate }), [name, rows, openingDate]);
  const errors = useMemo(() => validateValasForm(values, { today, otherNames, minorFactors: MINOR_FACTORS, requirePockets: mode === 'add' }), [values, today, otherNames, mode]);

  const nameError = errors.find(e => e.field === 'name');
  const dateError = errors.find(e => e.field === 'openingDate');
  const rowError = (currency: string) => errors.find(e => e.field === 'row' && e.currency === currency);
  const rowsError = errors.find(e => e.field === 'rows');
  const showName = !!nameError && (touchedName || submitted);
  const showRows = !!rowsError && submitted;
  const visibleCount = (showName ? 1 : 0) + (showRows ? 1 : 0) + errors.filter(e => e.field === 'row' || e.field === 'openingDate').length;

  const clear = useCallback(() => setServerError(null), []);

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

  const addedCodes = mode === 'add' ? rows.map(r => r.currency) : pockets.map(p => p.currency);

  const onPickCurrency = async (code: string) => {
    setSheetOpen(false);
    if (mode === 'add') {
      setRows(r => [...r, { currency: code, text: '' }]);
      clear();
      return;
    }
    const result = await onAddPocket?.(code);
    if (result && !result.ok) setServerError(result.message);
  };

  const onArchive = async (currency: string) => {
    const result = await onArchivePocket?.(currency);
    if (result && !result.ok) setServerError(result.message);
    else clear();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <IconButton label={closeLabel()} onPress={onCancel} testID="valas-form-close">
            <Icon name="close" color={MonoColors.text} />
          </IconButton>
          <Text style={styles.title} accessibilityRole="header">
            {mode === 'edit' ? valasFormTitleEdit() : valasFormTitleNew()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="valas-form-scroll">
        {mode === 'add' && (
          <View style={styles.typeTile} accessibilityRole="radio" accessibilityState={{ selected: true }} accessibilityLabel={valasTypeTile()} testID="valas-type-tile">
            <Icon name="banknote" size={20} color={MonoColors.bg} />
            <Text style={styles.typeText}>{valasTypeTile()}</Text>
          </View>
        )}

        <View>
          <Text style={styles.label}>{valasNameLabel()}</Text>
          <TextInput
            value={name}
            onChangeText={value => {
              setName(value);
              clear();
            }}
            onFocus={() => setNameFocused(true)}
            onBlur={() => {
              setNameFocused(false);
              setTouchedName(true);
            }}
            placeholder={valasNamePlaceholder()}
            placeholderTextColor={MonoColors.textDisabled}
            selectionColor={MonoColors.text}
            accessibilityLabel={valasNameLabel()}
            style={[styles.nameInput, nameFocused && styles.focused, showName && styles.errorBorder]}
            testID="valas-name"
          />
          {showName && nameError && <ErrorLine error={{ text: valasFieldError(nameError.code) }} testID="valas-name-error" />}
        </View>

        {mode === 'add' ? (
          <View>
            <Text style={styles.label}>{valasCurrenciesLabel()}</Text>
            {rows.length === 0 ? (
              <Text style={[styles.help, showRows && styles.helpError]} testID="valas-no-currency">
                {valasCurrencyNone()}
              </Text>
            ) : (
              <View style={styles.rows} testID="valas-rows">
                {rows.map(row => {
                  const err = rowError(row.currency);
                  const factor = MINOR_FACTORS[row.currency] ?? 100;
                  return (
                    <View key={row.currency} style={styles.rowWrap}>
                      <View style={styles.row}>
                        <CurrencyFlag code={row.currency} />
                        <View style={styles.flex}>
                          <Text style={styles.rowName}>{currencyName(row.currency)}</Text>
                          <Text style={styles.rowCode}>{row.currency}</Text>
                        </View>
                        <View style={[styles.amountBox, !!err && styles.errorBorder]}>
                          <Text style={styles.amountSymbol}>{currencySymbol(row.currency).trim()}</Text>
                          <TextInput
                            value={row.text}
                            onChangeText={text => {
                              setRows(rs => rs.map(r => (r.currency === row.currency ? { ...r, text } : r)));
                              clear();
                            }}
                            keyboardType="decimal-pad"
                            placeholder={factor === 1 ? '0' : '0,00'}
                            placeholderTextColor={MonoColors.textDisabled}
                            selectionColor={MonoColors.text}
                            accessibilityLabel={valasOpeningLabel(row.currency)}
                            style={styles.amountInput}
                            testID={`valas-amount-${row.currency}`}
                          />
                        </View>
                        <IconButton
                          label={valasRemoveCurrency(row.currency)}
                          onPress={() => {
                            setRows(rs => rs.filter(r => r.currency !== row.currency));
                            clear();
                          }}
                          testID={`valas-remove-${row.currency}`}
                        >
                          <Icon name="close" size={20} color={MonoColors.textSecond} />
                        </IconButton>
                      </View>
                      {!!err && <ErrorLine error={{ text: valasFieldError(err.code) }} testID={`valas-amount-error-${row.currency}`} />}
                    </View>
                  );
                })}
              </View>
            )}
            {showRows && rowsError && <ErrorLine error={{ text: valasFieldError(rowsError.code) }} testID="valas-rows-error" />}
            <Button label={valasAddCurrency()} icon="plus" variant="secondary" onPress={() => setSheetOpen(true)} style={styles.addButton} testID="valas-add-currency-button" />
          </View>
        ) : (
          <View>
            <Text style={styles.label}>{valasPocketsEditHeader()}</Text>
            <View style={styles.rows} testID="valas-pocket-rows">
              {pockets.map(pocket => {
                const empty = pocket.balance === 0;
                return (
                  <View key={pocket.currency} style={styles.rowWrap}>
                    <View style={styles.row}>
                      <CurrencyFlag code={pocket.currency} />
                      <View style={styles.flex}>
                        <Text style={styles.rowName}>{currencyName(pocket.currency)}</Text>
                        <Amount value={pocket.balance} currency={pocket.currency} minorFactor={pocket.minorFactor} variant="caption" style={{ color: MonoColors.textMeta }} />
                      </View>
                      <Pressable
                        onPress={() => void onArchive(pocket.currency)}
                        disabled={!empty}
                        accessibilityRole="button"
                        accessibilityLabel={empty ? valasPocketArchive(pocket.currency) : valasPocketArchiveBlocked(pocket.currency)}
                        accessibilityState={{ disabled: !empty }}
                        style={[styles.archive, !empty && styles.archiveOff]}
                        testID={`valas-archive-${pocket.currency}`}
                      >
                        <Text style={[styles.archiveText, !empty && styles.archiveTextOff]}>{valasPocketArchive(pocket.currency)}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.help}>{valasArchiveHelp()}</Text>
            <Button label={valasAddCurrency()} icon="plus" variant="secondary" onPress={() => setSheetOpen(true)} style={styles.addButton} testID="valas-add-currency-button" />
          </View>
        )}

        {mode === 'add' && (
          <View>
            <Pressable
              onPress={() => setDateOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={valasOpeningDateLabel(formatShortDate(openingDate))}
              android_ripple={undefined}
              style={({ pressed }) => [styles.dateField, !!dateError && styles.errorBorder, pressed && styles.pressed]}
              testID="valas-date-button"
            >
              <Icon name="calendar" size={20} color={MonoColors.textSecond} />
              <Text style={styles.dateText}>{valasOpeningDateLabel(formatShortDate(openingDate))}</Text>
            </Pressable>
            {!!dateError && <ErrorLine error={{ text: valasFieldError(dateError.code) }} testID="valas-date-error" />}
            <Text style={styles.help}>{valasOpeningHelp()}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        {submitted && visibleCount > 0 && <ErrorLine error={{ text: fieldsNeedAttention(visibleCount) }} testID="valas-error-summary" />}
        {!!serverError && <ErrorLine error={{ text: serverError }} testID="valas-server-error" />}
        <View style={styles.barRow}>
          <Button label={cancelLabel()} variant="secondary" onPress={onCancel} style={styles.cancelButton} testID="valas-cancel" />
          <Button
            label={saving ? valasSavingLabel() : mode === 'edit' ? valasSaveButton() : valasCreateButton()}
            onPress={() => void onSavePress()}
            disabled={saving || (mode === 'add' && rows.length === 0)}
            style={styles.saveButton}
            testID="valas-save"
          />
        </View>
      </View>

      <AddCurrencySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} added={addedCodes} onPick={code => void onPickCurrency(code)} />
      <DateSheet
        visible={dateOpen}
        selected={openingDate}
        today={today}
        onSelect={date => {
          setOpeningDate(date);
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
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },

  typeTile: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.text, backgroundColor: MonoColors.text },
  typeText: { ...MonoText.bodyStrong, color: MonoColors.bg },

  nameInput: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, paddingHorizontal: 14, paddingVertical: 12, ...MonoText.body, color: MonoColors.text },
  focused: { borderColor: MonoColors.text },
  errorBorder: { borderColor: MonoColors.negative, borderWidth: 1.5 },

  rows: { gap: 10 },
  rowWrap: { gap: 6 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 4, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL },
  rowName: { ...MonoText.bodyStrong, color: MonoColors.text },
  rowCode: { ...MonoText.caption, color: MonoColors.textMeta },
  amountBox: { width: 132, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: FIELD_BORDER },
  amountSymbol: { ...MonoText.bodyS, color: MonoColors.textSecond },
  amountInput: { ...MonoText.figureRow, color: MonoColors.text, flex: 1, textAlign: 'right', paddingVertical: 8 },
  addButton: { marginTop: 12 },
  archive: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  archiveOff: { opacity: 0.6 },
  archiveText: { ...MonoText.chip, color: MonoColors.text, textDecorationLine: 'underline' },
  archiveTextOff: { color: MonoColors.textSecond, textDecorationLine: 'none' },

  dateField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL },
  dateText: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  help: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 10 },
  helpError: { color: MonoColors.negative },

  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: FIELD_BORDER, backgroundColor: MonoColors.bg },
  barRow: { flexDirection: 'row', gap: 12 },
  cancelButton: { width: 104 },
  saveButton: { flex: 1 },
});
