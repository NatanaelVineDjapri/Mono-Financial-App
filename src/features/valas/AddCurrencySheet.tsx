// Add-currency sheet (board Valas-Add-Currency): the 12 currencies a Valas pocket can hold, searchable
// by code or name. Ones the account already has are marked and cannot be picked again. It only
// reports the pick; the screen that opened it decides what to do (the create form adds a row, the
// detail adds a pocket).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CurrencyFlag } from '@/components/CurrencyFlag';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import {
  closeLabel,
  currencyName,
  valasAddSheetSubtitle,
  valasAddSheetTitle,
  valasCurrencyRowLabel,
  valasNeedRateNote,
  valasSearchEmpty,
  valasSearchPlaceholder,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SUPPORTED_FOREX_CURRENCIES } from './currencies';

export interface AddCurrencySheetProps {
  visible: boolean;
  onClose: () => void;
  added: readonly string[]; // codes the account already has
  onPick: (code: string) => void;
}

// The currencies that match a search, in the sheet's own order: by code or by name, ignoring case.
export function matchCurrencies(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SUPPORTED_FOREX_CURRENCIES];
  return SUPPORTED_FOREX_CURRENCIES.filter(code => code.toLowerCase().includes(q) || currencyName(code).toLowerCase().includes(q));
}

export function AddCurrencySheet({ visible, onClose, added, onPick }: AddCurrencySheetProps) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => matchCurrencies(query), [query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} closeLabel={closeLabel()} testID="add-currency-sheet">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="banknote" title={valasAddSheetTitle()} subtitle={valasAddSheetSubtitle()} onClose={close} closeTestID="add-currency-close" />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={valasSearchPlaceholder()}
          placeholderTextColor={MonoColors.textDisabled}
          accessibilityLabel={valasSearchPlaceholder()}
          autoCapitalize="none"
          autoCorrect={false}
          testID="add-currency-search"
        />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" testID="add-currency-list">
          {matches.length === 0 && <Text style={styles.empty}>{valasSearchEmpty()}</Text>}
          {matches.map(code => {
            const isAdded = added.includes(code);
            const name = currencyName(code);
            return (
              <Pressable
                key={code}
                onPress={() => {
                  if (isAdded) return;
                  setQuery('');
                  onPick(code);
                }}
                disabled={isAdded}
                accessibilityRole="button"
                accessibilityLabel={valasCurrencyRowLabel(code, name, isAdded)}
                accessibilityState={{ disabled: isAdded }}
                android_ripple={undefined}
                style={({ pressed }) => [styles.row, pressed && !isAdded && styles.pressed]}
                testID={`add-currency-${code}`}
              >
                <CurrencyFlag code={code} />
                <View style={styles.flex}>
                  <Text style={[styles.name, isAdded && styles.muted]}>{name}</Text>
                  <Text style={styles.code}>{code}</Text>
                </View>
                {isAdded && (
                  <View style={styles.added}>
                    <Icon name="check" size={16} color={MonoColors.textSecond} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.note}>
          <Icon name="info" size={16} color={MonoColors.textMeta} />
          <Text style={styles.noteText}>{valasNeedRateNote()}</Text>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 16, paddingBottom: 0, maxHeight: '88%' }, // the sheet panel already pads the bottom
  list: { marginTop: 8, maxHeight: 476 }, // seven rows (68 each) show at once
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  pressed: { opacity: 0.85 },
  flex: { flex: 1 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  muted: { color: MonoColors.textSecond },
  code: { ...MonoText.caption, color: MonoColors.textMeta },
  added: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addedText: { ...MonoText.caption, color: MonoColors.textSecond },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingVertical: 12 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 6, marginBottom: -56 }, // pulls it down into the panel's bottom padding
  noteText: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 17 },
});
