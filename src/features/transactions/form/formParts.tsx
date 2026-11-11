// The pieces of the transaction form (Tx-Add, Tx-Add-Errors, Tx-Add-Transfer): the amount card,
// the category row, the account field, the From / To card, the date row and the text boxes.
// Pure presentation: values in, callbacks out. The rules are validate.ts's; every currency
// figure passes shown() (hidden-amounts mode, CLAUDE.md rule 12).
//
// An error is a 1.5 px #FF6B6B border on the field, a warning icon (18) and a sentence (13/18)
// below it, announced politely. Colour is never the only signal: the icon and the sentence are
// always there, and the field says so to screen readers through its hint.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BankTile } from '@/components/BankCard';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import type { FormAccount, FormCategory } from '@/core/tx/validate';
import {
  amountAccessibilityLabel,
  amountFieldLabel,
  amountToMoveLabel,
  balanceAfterColonLabel,
  categoryLabel,
  chooseDateAccessibilityLabel,
  formAccountLabel,
  formDateLabel,
  fromLabel,
  moreCategoriesLabel,
  quickAddAccessibilityLabel,
  quickAddLabel,
  swapAccountsLabel,
  todayLabel,
  toLabel,
  transferInfoBanner,
  yesterdayLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const FIELD_FILL = '#151516';
export const FIELD_BORDER = '#272728';
const ERROR_BORDER = 1.5;

export interface ErrorView {
  text: string;
  linkText?: string;
  onLinkPress?: () => void;
}

// ---------------------------------------------------------------- error line

export function ErrorLine({ error, testID }: { error: ErrorView; testID?: string }) {
  const { text, linkText, onLinkPress } = error;
  const at = linkText ? text.indexOf(linkText) : -1;
  return (
    <View style={styles.errorRow} testID={testID}>
      <Icon name="alert" size={16} color={MonoColors.negative} />
      <Text style={styles.errorText} accessibilityLiveRegion="polite">
        {at >= 0 && linkText ? (
          <>
            {text.slice(0, at)}
            <Text style={styles.errorLink} onPress={onLinkPress} accessibilityRole="link" accessibilityLabel={linkText}>
              {linkText}
            </Text>
            {text.slice(at + linkText.length)}
          </>
        ) : (
          text
        )}
      </Text>
    </View>
  );
}

function FieldLabel({ children, flagged }: { children: string; flagged?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {flagged && <Icon name="alert" size={16} color={MonoColors.negative} />}
    </View>
  );
}

// ---------------------------------------------------------------- amount

const MAX_FONT = 44;

// A long amount steps the size down so every digit stays visible (numbers never truncate).
function amountFontSize(digits: string): number {
  if (digits.length <= 9) return MAX_FONT;
  if (digits.length <= 11) return 38;
  if (digits.length <= 13) return 32;
  return 28;
}

export interface AmountCardProps {
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  label: 'amount' | 'amountToMove';
  // Overrides `label` with another title (the account form's "Opening balance").
  title?: string;
  quickAdds: number[];
  error?: ErrorView;
  autoFocus?: boolean;
}

export function AmountCard({ value, onChange, onBlur, label, title, quickAdds, error, autoFocus }: AmountCardProps) {
  const text = value === 0 ? '' : rp(value).slice(2); // "125.000", no "Rp"
  const size = amountFontSize(text);
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View style={[styles.card, focused && styles.cardFocused, !!error && styles.cardError]} testID="tx-amount-card">
        <Text style={styles.cardLabel}>{title ?? (label === 'amount' ? amountFieldLabel() : amountToMoveLabel())}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rp}>Rp</Text>
          <TextInput
            value={text}
            onChangeText={raw => onChange(parseDigits(raw))}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            placeholder="0"
            placeholderTextColor={MonoColors.textDisabled}
            keyboardType="number-pad"
            maxLength={15} // 12 digits plus up to 3 dots
            selectionColor={MonoColors.text}
            autoFocus={autoFocus}
            accessibilityLabel={amountAccessibilityLabel()}
            accessibilityHint={error?.text}
            style={[styles.amountInput, { fontSize: size, lineHeight: Math.round(size * (52 / 44)) }]}
            testID="tx-amount-input"
          />
        </View>
        {quickAdds.length > 0 && (
        <View style={styles.quickRow}>
          {quickAdds.map(add => (
            <Chip
              key={add}
              label={quickAddLabel(rp(add).slice(2))}
              selected={false}
              onPress={() => onChange(Math.min(value + add, MAX_AMOUNT_VALUE))}
              accessibilityHint={quickAddAccessibilityLabel(rp(add))}
              style={styles.quickChip}
              testID={`tx-quick-${add}`}
            />
          ))}
        </View>
        )}
      </View>
      {!!error && <ErrorLine error={error} testID="tx-amount-error" />}
    </View>
  );
}

const MAX_AMOUNT_VALUE = 999_999_999_999;

export function parseDigits(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 12);
  return digits ? parseInt(digits, 10) : 0;
}

// ---------------------------------------------------------------- category

export interface CategoryRowProps {
  categories: FormCategory[]; // of the chosen kind
  selectedId: number | null;
  onSelect: (id: number) => void;
  onMore: () => void;
  error?: ErrorView;
}

const CHIPS_BEFORE_MORE = 8;

export function CategoryRow({ categories, selectedId, onSelect, onMore, error }: CategoryRowProps) {
  // The chosen one is always visible, even when it is past the first few.
  const visible = categories.slice(0, CHIPS_BEFORE_MORE);
  const chosen = categories.find(c => c.id === selectedId);
  const shownCategories = chosen && !visible.includes(chosen) ? [...visible.slice(0, CHIPS_BEFORE_MORE - 1), chosen] : visible;
  return (
    <View testID="tx-category-row">
      <FieldLabel flagged={!!error}>{categoryLabel()}</FieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="radiogroup">
        {shownCategories.map(category => (
          <Chip
            key={category.id}
            label={category.name}
            selected={category.id === selectedId}
            onPress={() => onSelect(category.id)}
            testID={`tx-category-${category.id}`}
          />
        ))}
        {categories.length > CHIPS_BEFORE_MORE && <Chip label={moreCategoriesLabel()} selected={false} onPress={onMore} testID="tx-category-more" />}
      </ScrollView>
      {!!error && <ErrorLine error={error} testID="tx-category-error" />}
    </View>
  );
}

// ---------------------------------------------------------------- accounts

function BalanceLine({ account, balanceAfter }: { account: FormAccount; balanceAfter: number | null }) {
  const hidden = useHideAmounts(s => s.hidden);
  if (balanceAfter == null) return null;
  return <Text style={styles.balanceLine}>{balanceAfterColonLabel(shown(rp(balanceAfter), hidden))}</Text>;
}

export interface AccountFieldProps {
  account?: FormAccount;
  balanceAfter: number | null;
  onPress: () => void;
  error?: ErrorView;
  placeholder: string;
}

export function AccountField({ account, balanceAfter, onPress, error, placeholder }: AccountFieldProps) {
  return (
    <View testID="tx-account-field">
      <FieldLabel flagged={!!error}>{formAccountLabel()}</FieldLabel>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={account ? `${formAccountLabel()}, ${account.name}` : `${formAccountLabel()}, ${placeholder}`}
        accessibilityHint={error?.text}
        android_ripple={undefined}
        style={({ pressed }) => [styles.pickRow, !!error && styles.boxError, pressed && styles.pressed]}
        testID="tx-account-button"
      >
        {account ? <BankTile icon={account.icon} type={account.type} size={36} /> : <View style={styles.tilePlaceholder} />}
        <View style={styles.pickText}>
          <Text style={styles.pickName}>{account ? account.name : placeholder}</Text>
          {account && <BalanceLine account={account} balanceAfter={balanceAfter} />}
        </View>
        <Icon name="chevron-down" size={20} color={MonoColors.textSecond} />
      </Pressable>
      {!!error && <ErrorLine error={error} testID="tx-account-error" />}
    </View>
  );
}

export interface TransferAccountsProps {
  from?: FormAccount;
  to?: FormAccount;
  fromAfter: number | null;
  toAfter: number | null;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
  fromError?: ErrorView;
  toError?: ErrorView;
  placeholder: string;
}

function TransferSide({ label, account, after, onPress, placeholder, testID }: { label: string; account?: FormAccount; after: number | null; onPress: () => void; placeholder: string; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={account ? `${label}, ${account.name}` : `${label}, ${placeholder}`}
      android_ripple={undefined}
      style={({ pressed }) => [styles.sideRow, pressed && styles.pressed]}
      testID={testID}
    >
      {account ? <BankTile icon={account.icon} type={account.type} size={36} /> : <View style={styles.tilePlaceholder} />}
      <View style={styles.pickText}>
        <Text style={styles.sideLabel}>{label}</Text>
        <Text style={styles.pickName}>{account ? account.name : placeholder}</Text>
        {account && <BalanceLine account={account} balanceAfter={after} />}
      </View>
      <Icon name="chevron-down" size={20} color={MonoColors.textSecond} />
    </Pressable>
  );
}

export function TransferAccounts({ from, to, fromAfter, toAfter, onPressFrom, onPressTo, onSwap, fromError, toError, placeholder }: TransferAccountsProps) {
  const error = fromError ?? toError;
  return (
    <View testID="tx-transfer-accounts">
      <View style={[styles.transferCard, !!error && styles.boxError]}>
        <TransferSide label={fromLabel()} account={from} after={fromAfter} onPress={onPressFrom} placeholder={placeholder} testID="tx-from-button" />
        <View style={styles.transferDivider} />
        <TransferSide label={toLabel()} account={to} after={toAfter} onPress={onPressTo} placeholder={placeholder} testID="tx-to-button" />
        <Pressable
          onPress={onSwap}
          accessibilityRole="button"
          accessibilityLabel={swapAccountsLabel()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.swap, pressed && styles.pressed]}
          testID="tx-swap"
        >
          <Icon name="transfer" size={20} color={MonoColors.text} />
        </Pressable>
      </View>
      {!!fromError && <ErrorLine error={fromError} testID="tx-account-error" />}
      {!!toError && <ErrorLine error={toError} testID="tx-to-error" />}
      <View style={styles.banner}>
        <Icon name="info" size={18} color={MonoColors.textSecond} />
        <Text style={styles.bannerText}>{transferInfoBanner()}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- date

export interface DateRowProps {
  dateText: string; // "28 Oct 2026"
  chosen: 'today' | 'yesterday' | null;
  onPressField: () => void;
  onToday: () => void;
  onYesterday: () => void;
  error?: ErrorView;
}

export function DateRow({ dateText, chosen, onPressField, onToday, onYesterday, error }: DateRowProps) {
  return (
    <View testID="tx-date-row">
      <FieldLabel flagged={!!error}>{formDateLabel()}</FieldLabel>
      <View style={styles.dateRow}>
        <Pressable
          onPress={onPressField}
          accessibilityRole="button"
          accessibilityLabel={chooseDateAccessibilityLabel(dateText)}
          accessibilityHint={error?.text}
          android_ripple={undefined}
          style={({ pressed }) => [styles.dateField, !!error && styles.boxError, pressed && styles.pressed]}
          testID="tx-date-button"
        >
          <Icon name="calendar" size={20} color={MonoColors.textSecond} />
          <Text style={styles.dateText}>{dateText}</Text>
        </Pressable>
        <Chip label={todayLabel()} selected={chosen === 'today'} onPress={onToday} style={styles.dateChip} testID="tx-today" />
        <Chip label={yesterdayLabel()} selected={chosen === 'yesterday'} onPress={onYesterday} style={styles.dateChip} testID="tx-yesterday" />
      </View>
      {!!error && <ErrorLine error={error} testID="tx-date-error" />}
    </View>
  );
}

// ---------------------------------------------------------------- text boxes

export interface TextBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  testID: string;
}

export function TextBox({ label, value, onChange, placeholder, multiline = false, testID }: TextBoxProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={MonoColors.textDisabled}
        selectionColor={MonoColors.text}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.textBox, multiline && styles.textBoxMulti, focused && styles.textBoxFocused]}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { ...MonoText.bodyS, color: MonoColors.negative, flex: 1 },
  errorLink: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.negative, textDecorationLine: 'underline' },

  card: { backgroundColor: FIELD_FILL, borderColor: FIELD_BORDER, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardFocused: { borderColor: MonoColors.text },
  cardError: { borderColor: MonoColors.negative, borderWidth: ERROR_BORDER },
  cardLabel: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rp: { fontFamily: MonoText.figureM.fontFamily, fontSize: 22, lineHeight: 28, color: MonoColors.textSecond },
  amountInput: { flex: 1, ...MonoText.figureXL, color: MonoColors.text, padding: 0 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  quickChip: { borderRadius: 14 },

  chipRow: { gap: 8, paddingRight: 16 },

  pickRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: FIELD_FILL, borderColor: FIELD_BORDER, borderWidth: 1, borderRadius: 16 },
  boxError: { borderColor: MonoColors.negative, borderWidth: ERROR_BORDER },
  pressed: { opacity: 0.85 },
  tilePlaceholder: { width: 36, height: 36, borderRadius: 11, backgroundColor: MonoColors.raised },
  pickText: { flex: 1 },
  pickName: { ...MonoText.bodyStrong, color: MonoColors.text },
  balanceLine: { ...MonoText.caption, color: MonoColors.textMeta },
  sideLabel: { ...MonoText.label, color: MonoColors.textMeta },

  transferCard: { backgroundColor: FIELD_FILL, borderColor: FIELD_BORDER, borderWidth: 1, borderRadius: 16 },
  sideRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 68, paddingVertical: 10 },
  transferDivider: { height: 1, backgroundColor: FIELD_BORDER, marginLeft: 60 },
  swap: { position: 'absolute', right: 12, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: MonoColors.raised, borderWidth: 1, borderColor: FIELD_BORDER, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: MonoColors.surface },
  bannerText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateField: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: FIELD_FILL, borderColor: FIELD_BORDER, borderWidth: 1, borderRadius: 14 },
  dateText: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  dateChip: { minHeight: 52, height: undefined, borderRadius: 14, paddingHorizontal: 14 },

  textBox: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, paddingHorizontal: 14, paddingVertical: 12, ...MonoText.body, color: MonoColors.text },
  textBoxMulti: { textAlignVertical: 'top' },
  textBoxFocused: { borderColor: MonoColors.text },
});
