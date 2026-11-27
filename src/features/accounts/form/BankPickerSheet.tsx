// The bank picker of the account form: first the countries (their flags), then the banks or e-wallets of the one
// chosen. "No bank icon" sits above the countries. Flags and logos keep their own colours (CLAUDE.md rule 5).
import { useEffect, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BankTile } from '@/components/BankCard/BankTile';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import type { PlainAccountType } from '@/core/account/validate';
import { bankCountryName, bankPickerBack, bankPickerBankSubtitle, bankPickerCountrySubtitle, bankPickerCountryTitle, closeLabel, noBankIconLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { BankCountryId } from '../countries';
import { brandsForType, countriesForType } from './brands';

export interface BankPickerSheetProps {
  visible: boolean;
  type: PlainAccountType;
  selected: string | null;
  onSelect: (slug: string | null) => void;
  onClose: () => void;
}

export function BankPickerSheet({ visible, type, selected, onSelect, onClose }: BankPickerSheetProps) {
  const [country, setCountry] = useState<BankCountryId | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  const { height } = useWindowDimensions();

  // Every opening starts at the countries.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setCountry(null);
  }

  // Android back: from the banks to the countries, from the countries out of the sheet.
  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (country) setCountry(null);
      else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, country, onClose]);

  const listHeight = Math.round(height * 0.55);

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="bank-picker">
      <SheetHeader
        visible={visible}
        icon="wallet"
        title={country ? bankCountryName(country) : bankPickerCountryTitle()}
        subtitle={country ? bankPickerBankSubtitle() : bankPickerCountrySubtitle()}
        onClose={onClose}
        closeTestID="bank-picker-close"
        action={
          country ? (
            <Pressable onPress={() => setCountry(null)} accessibilityRole="button" accessibilityLabel={bankPickerBack()} style={styles.back} testID="bank-picker-back">
              <Icon name="chevron-left" size={20} color={MonoColors.text} />
            </Pressable>
          ) : undefined
        }
      />

      {country ? (
        <FlatList
          data={brandsForType(type, country)}
          keyExtractor={brand => brand.slug}
          style={{ maxHeight: listHeight }}
          initialNumToRender={12}
          testID="bank-picker-banks"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.slug)}
              accessibilityRole="radio"
              accessibilityLabel={item.name}
              accessibilityState={{ selected: selected === item.slug }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`account-icon-${item.slug}`}
            >
              <BankTile icon={item.slug} type={type} size={40} />
              <Text style={styles.name}>{item.name}</Text>
              {selected === item.slug && <Icon name="check" size={20} color={MonoColors.text} />}
            </Pressable>
          )}
        />
      ) : (
        <ScrollView style={{ maxHeight: listHeight }} testID="bank-picker-countries">
          <Pressable
            onPress={() => onSelect(null)}
            accessibilityRole="radio"
            accessibilityLabel={noBankIconLabel()}
            accessibilityState={{ selected: selected == null }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID="account-icon-none"
          >
            <BankTile icon={null} type={type} size={40} />
            <Text style={styles.name}>{noBankIconLabel()}</Text>
            {selected == null && <Icon name="check" size={20} color={MonoColors.text} />}
          </Pressable>
          <View style={styles.grid}>
            {countriesForType(type).map(({ id, Flag }) => (
              <Pressable
                key={id}
                onPress={() => setCountry(id)}
                accessibilityRole="button"
                accessibilityLabel={bankCountryName(id)}
                style={({ pressed }) => [styles.country, pressed && styles.pressed]}
                testID={`bank-country-${id}`}
              >
                <View style={styles.flag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Flag width={44} height={44} />
                </View>
                <Text style={styles.countryName}>{bankCountryName(id)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4 },
  name: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  // three countries to a line; the names wrap at large text sizes instead of being cut
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8 },
  country: { width: '33.33%', minHeight: 96, alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm },
  flag: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: MonoColors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  countryName: { ...MonoText.caption, color: MonoColors.text, textAlign: 'center' },
  pressed: { backgroundColor: MonoColors.card },
});
