// Hero (DESIGN.md "A. Overview"): relative, overflow hidden, the wave behind its top
// right. Serif greeting (the screen's one serif moment), "Net worth" with the hide/reveal
// button, the balance in sans 700 40/46, and the gold change chip with "vs <date>".
// Hidden-amounts mode masks the balance, the chip's amount and its percentage.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import {
  hideAmountsLabel,
  netWorthChangeLabel,
  netWorthIncompleteNote,
  netWorthLabel,
  showAmountsLabel,
  welcomeGreeting,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { HeroWave } from './HeroWave';
import { CHIP_FILL } from './palette';
import { Triangle } from './parts';

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
  return (
    <View
      style={styles.changeRow}
      accessible
      accessibilityLabel={netWorthChangeLabel(amountText, pctText ?? '', vs).replace(' ()', '')}
      testID="hero-change"
    >
      <View style={styles.chip}>
        <Triangle up={change.amount >= 0} color={MonoColors.accent} />
        <Text style={styles.chipText}>{text}</Text>
      </View>
      <Text style={styles.vs}>{`vs ${vs}`}</Text>
    </View>
  );
}

export function HeroSection({ nickname, netWorth, incomplete = false, change, note }: HeroSectionProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const toggle = useHideAmounts(s => s.toggle);
  return (
    <View style={styles.hero} testID="overview-hero">
      <HeroWave />
      <Text style={styles.greeting} accessibilityRole="header">
        {welcomeGreeting(nickname)}
      </Text>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{netWorthLabel()}</Text>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={hidden ? showAmountsLabel() : hideAmountsLabel()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
          testID="overview-hide-toggle"
        >
          <Icon name={hidden ? 'eye-off' : 'eye'} size={16} color={MonoColors.textSecond} />
          <Text style={styles.hideText}>{hidden ? showAmountsLabel() : hideAmountsLabel()}</Text>
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
  hero: { overflow: 'hidden', paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8, gap: 4 },
  greeting: { ...MonoText.heroGreeting, color: MonoColors.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  hideButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  pressed: { opacity: 0.7 },
  hideText: { ...MonoText.bodyS, color: MonoColors.textSecond },
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
    backgroundColor: CHIP_FILL,
  },
  chipText: { ...MonoText.chip, color: MonoColors.accent },
  vs: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
