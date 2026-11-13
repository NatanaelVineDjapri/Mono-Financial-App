// The Valas pieces of the transaction form (boards Tx-Add-Valas and Tx-Exchange): the pocket chips,
// the amount card in a pocket's own currency, the live "≈ Rp… · Rp… per S$1" line, the budget note and
// the exchange summary card. Pure presentation: values in, callbacks out. Every currency figure passes
// shown() or <Amount> (hidden-amounts mode, CLAUDE.md rule 12); a missing rate is never shown as 0.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { currencySymbol, money, pct, rateRp, rp, shown } from '@/core/money';
import type { FormPocket } from '@/core/tx/validate';
import { ErrorLine, FIELD_BORDER, FIELD_FILL, type ErrorView } from '@/features/transactions/form/formParts';
import {
  currencyName,
  ratesRowPer,
  valasAmountAccessibility,
  valasBalanceAfter,
  valasBudgetNote,
  valasCrossRate,
  valasDifferenceText,
  valasEnterBoth,
  valasExchangeDifference,
  valasExchangeNoLatest,
  valasExchangeNote,
  valasExchangeRateLatest,
  valasExchangeRateYours,
  valasLiveValue,
  valasPocketChipLabel,
  valasPocketFieldLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { currencyInputText, parseCurrencyText } from './amountText';
import type { ExchangeSummary, RateText } from './rates';

// ---------------------------------------------------------------- pocket chips

export interface PocketChipsProps {
  pockets: readonly FormPocket[]; // of the chosen Valas account
  selected: string | undefined;
  onSelect: (currency: string) => void;
  label?: string;
  error?: ErrorView;
  testID?: string;
}

export function PocketChips({ pockets, selected, onSelect, label, error, testID = 'tx-pocket-chips' }: PocketChipsProps) {
  const hidden = useHideAmounts(s => s.hidden);
  return (
    <View testID={testID}>
      <Text style={styles.fieldLabel}>{label ?? valasPocketFieldLabel()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="radiogroup">
        {pockets.map(pocket => (
          <Chip
            key={pocket.currency}
            label={pocket.currency}
            selected={pocket.currency === selected}
            onPress={() => onSelect(pocket.currency)}
            accessibilityHint={valasPocketChipLabel(pocket.currency, currencyName(pocket.currency), shown(money(pocket.balance, pocket.currency, pocket.minorFactor), hidden))}
            testID={`${testID}-${pocket.currency}`}
          />
        ))}
      </ScrollView>
      {!!error && <ErrorLine error={error} testID={`${testID}-error`} />}
    </View>
  );
}

// ---------------------------------------------------------------- amount in a currency

const MAX_FONT = 44;

function fontSizeFor(text: string): number {
  if (text.length <= 9) return MAX_FONT;
  if (text.length <= 11) return 38;
  if (text.length <= 13) return 32;
  return 28;
}

export interface CurrencyAmountCardProps {
  currency: string;
  minorFactor: number;
  value: number; // minor units
  onChange: (value: number) => void;
  onBlur?: () => void;
  title: string;
  error?: ErrorView;
  testID?: string;
  autoFocus?: boolean;
  children?: React.ReactNode; // the live lines under the input
}

export function CurrencyAmountCard({ currency, minorFactor, value, onChange, onBlur, title, error, testID = 'tx-amount', autoFocus, children }: CurrencyAmountCardProps) {
  const [text, setText] = useState(value === 0 ? '' : currencyInputText(value, minorFactor));
  const [focused, setFocused] = useState(false);

  // The value can change from outside (switching pocket, a swap): the text follows it, unless it already means the same number.
  // Derived while rendering, React's recipe for adjusting state when a prop changes.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if ((parseCurrencyText(text, minorFactor) ?? 0) !== value) setText(value === 0 ? '' : currencyInputText(value, minorFactor));
  }

  const size = fontSizeFor(text);
  return (
    <View>
      <View style={[styles.card, focused && styles.cardFocused, !!error && styles.cardError]} testID={`${testID}-card`}>
        <Text style={styles.cardLabel}>{title}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.symbol}>{currencySymbol(currency).trim()}</Text>
          <TextInput
            value={text}
            onChangeText={raw => {
              const clean = raw.replace(/[^0-9.,]/g, '').slice(0, 20);
              setText(clean);
              onChange(parseCurrencyText(clean, minorFactor) ?? 0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            placeholder={minorFactor === 1 ? '0' : '0,00'}
            placeholderTextColor={MonoColors.textDisabled}
            keyboardType="decimal-pad"
            selectionColor={MonoColors.text}
            autoFocus={autoFocus}
            accessibilityLabel={valasAmountAccessibility(currency)}
            accessibilityHint={error?.text}
            style={[styles.amountInput, { fontSize: size, lineHeight: Math.round(size * (52 / 44)) }]}
            testID={`${testID}-input`}
          />
        </View>
        {children}
      </View>
      {!!error && <ErrorLine error={error} testID={`${testID}-error`} />}
    </View>
  );
}

// ---------------------------------------------------------------- live lines

// "≈ Rp250.000 · Rp12.500 per S$1": what the typed amount is worth at the latest rate. A currency with
// no rate shows nothing here (the form's error says to set the rate): never "≈ Rp0".
export function LiveValueLine({ currency, valueIdr, rateE4 }: { currency: string; valueIdr: number | null; rateE4: number | null }) {
  const hidden = useHideAmounts(s => s.hidden);
  if (valueIdr == null || rateE4 == null) return null;
  return (
    <Text style={styles.live} testID="tx-live-value">
      {valasLiveValue(shown(rp(valueIdr), hidden), ratesRowPer(rateRp(rateE4), currencySymbol(currency)))}
    </Text>
  );
}

export function BalanceAfterLine({ balance, currency, minorFactor }: { balance: number | null; currency: string; minorFactor: number }) {
  const hidden = useHideAmounts(s => s.hidden);
  if (balance == null) return null;
  return (
    <Text style={styles.balance} testID="tx-pocket-balance-after">
      {valasBalanceAfter(shown(money(balance, currency, minorFactor), hidden))}
    </Text>
  );
}

// An expense on the Valas account counts toward its category's budget as the rupiah value of the day.
export function BudgetNote({ category, valueIdr }: { category: string; valueIdr: number | null }) {
  const hidden = useHideAmounts(s => s.hidden);
  if (valueIdr == null || valueIdr <= 0) return null;
  return (
    <View style={styles.noteRow} testID="tx-budget-note">
      <Icon name="info" size={16} color={MonoColors.textMeta} />
      <Text style={styles.noteText}>{valasBudgetNote(category, shown(rp(valueIdr), hidden))}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- exchange summary

// 13000 -> "1,30"; 12345 -> "1,2345": four decimals at most, trailing zeros trimmed down to two.
export function formatE4(n: number): string {
  const whole = Math.floor(n / 10000);
  let frac = String(n % 10000).padStart(4, '0');
  while (frac.length > 2 && frac.endsWith('0')) frac = frac.slice(0, -1);
  const digits = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${digits},${frac}`;
}

function rateTextOf(rate: RateText): string {
  if (rate.kind === 'idr') return ratesRowPer(rateRp(rate.rateE4), currencySymbol(rate.currency));
  return valasCrossRate(rate.from, formatE4(rate.perUnitE4), rate.to);
}

export function ExchangeSummaryCard({ summary }: { summary: ExchangeSummary }) {
  const hidden = useHideAmounts(s => s.hidden);
  const diff =
    summary.differenceBp != null && summary.differenceIdr != null
      ? valasDifferenceText(pct(summary.differenceBp), shown(rp(summary.differenceIdr, true), hidden))
      : null;
  return (
    <View style={styles.summary} testID="tx-exchange-summary">
      {summary.yours ? (
        <>
          <SummaryRow label={valasExchangeRateYours()} value={rateTextOf(summary.yours)} testID="tx-exchange-yours" />
          <SummaryRow label={valasExchangeRateLatest()} value={summary.latest ? rateTextOf(summary.latest) : '—'} testID="tx-exchange-latest" />
          <SummaryRow label={valasExchangeDifference()} value={diff ?? '—'} testID="tx-exchange-difference" />
          {!summary.latest && <Text style={styles.noteText}>{valasExchangeNoLatest()}</Text>}
        </>
      ) : (
        <Text style={styles.noteText}>{valasEnterBoth()}</Text>
      )}
      <View style={styles.noteRow}>
        <Icon name="info" size={16} color={MonoColors.textMeta} />
        <Text style={styles.noteText}>{valasExchangeNote()}</Text>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.summaryRow} testID={testID}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase', marginBottom: 8 },
  chipRow: { gap: 8, paddingRight: 16 },

  card: { backgroundColor: FIELD_FILL, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 20, padding: 16, gap: 6 },
  cardFocused: { borderColor: MonoColors.text },
  cardError: { borderColor: MonoColors.negative, borderWidth: 1.5 },
  cardLabel: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol: { ...MonoText.titleM, color: MonoColors.textSecond },
  amountInput: { flex: 1, color: MonoColors.text, fontFamily: MonoText.displayS.fontFamily, paddingVertical: 4 },
  live: { ...MonoText.bodyS, color: MonoColors.textSecond },
  balance: { ...MonoText.caption, color: MonoColors.textMeta },

  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 17 },

  summary: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 16, padding: 16, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  summaryLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  summaryValue: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right', flexShrink: 1 },
});
