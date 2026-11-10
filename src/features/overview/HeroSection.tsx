// Hero (DESIGN.md "A. Overview"): no background of its own. The artwork behind it (and the
// header above it) is OverviewTop's. Serif greeting (the screen's one serif moment), "Net worth" with the hide/reveal
// button, the balance in sans 700 40/46, and the green (red when falling) change chip with "vs <date>".
// Hidden-amounts mode masks the balance, the chip's amount and its percentage.
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import {
  hideAmountsLabel,
  hideAmountsShortLabel,
  netWorthChangeLabel,
  netWorthIncompleteNote,
  netWorthLabel,
  showAmountsLabel,
  showAmountsShortLabel,
  welcomeGreeting,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { CHIP_FILL_NEGATIVE, CHIP_FILL_POSITIVE } from './palette';
import { Triangle } from './parts';

// Under this width the button reads "Hide" / "Show" instead of "Hide amounts".
const NARROW_WIDTH = 360;

export interface HeroChange {
  amount: number; // whole rupiah, signed
  bp: number | null; // basis points vs the previous month end; null when undefined
  vsDate: string; // 'YYYY-MM-DD'
}

export interface HeroSectionProps {
  nickname: string;
  netWorth: number;
  incomplete?: boolean;
  change?: HeroChange | null;
  note?: string; // empty state: the one-line explanation under the balance
}

export function ChangeChip({ change, hidden }: { change: HeroChange; hidden: boolean }) {
  const amountText = shown(rp(change.amount, true), hidden);
  const pctText = change.bp == null ? null : shownPct(pct(change.bp, true), hidden);
  const text = pctText ? `${amountText} (${pctText})` : amountText;
  const vs = formatShortDate(change.vsDate);
  const rising = change.amount >= 0;
  const tone = rising ? MonoColors.positive : MonoColors.negative;
  return (
    <View
      style={styles.changeRow}
      accessible
      accessibilityLabel={netWorthChangeLabel(amountText, pctText ?? '', vs).replace(' ()', '')}
      testID="hero-change"
    >
      <View style={[styles.chip, { backgroundColor: rising ? CHIP_FILL_POSITIVE : CHIP_FILL_NEGATIVE }]}>
        <Triangle up={rising} color={tone} />
        <Text style={[styles.chipText, { color: tone }]}>{text}</Text>
      </View>
      <Text style={styles.vs}>{`vs ${vs}`}</Text>
    </View>
  );
}

export function HeroSection({ nickname, netWorth, incomplete = false, change, note }: HeroSectionProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const toggle = useHideAmounts(s => s.toggle);
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_WIDTH;
  const fullLabel = hidden ? showAmountsLabel() : hideAmountsLabel();
  const buttonText = narrow ? (hidden ? showAmountsShortLabel() : hideAmountsShortLabel()) : fullLabel;
  return (
    <View style={styles.hero} testID="overview-hero">
      <Text style={styles.greeting} accessibilityRole="header">
        {welcomeGreeting(nickname)}
      </Text>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{netWorthLabel()}</Text>
        {/* Plain text button in the same grey as "NET WORTH": no fill, no border. 44 high touch area, right-aligned. */}
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={fullLabel}
          android_ripple={undefined}
          style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
          testID="overview-hide-toggle"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size={18} color={MonoColors.textMeta} />
          <Text style={styles.hideText}>{buttonText}</Text>
        </Pressable>
      </View>
      <Amount value={netWorth} variant="heroBalance" testID="hero-balance" />
      {!!note && <Text style={styles.note}>{note}</Text>}
      {incomplete && <Text style={styles.note}>{netWorthIncompleteNote()}</Text>}
      {change && <ChangeChip change={change} hidden={hidden} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8, gap: 4 },
  greeting: { ...MonoText.heroGreeting, color: MonoColors.text },
  labelRow: { zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  hideButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  pressed: { opacity: 0.7 },
  hideText: { ...MonoText.bodyS, fontFamily: MonoText.figureRow.fontFamily, color: MonoColors.textMeta }, // 13/18, weight 500; same grey as "NET WORTH"
  note: { ...MonoText.body, color: MonoColors.textSecond },
  changeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 6, marginTop: 8 },
  chip: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { ...MonoText.chip },
  vs: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
