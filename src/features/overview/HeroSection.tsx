// Hero (the Overview's top). Net worth card with luxury wave backdrop, balance,
// hide/reveal toggle, delta chip, quick-action pills, and a sparkle button with sheen animation.
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Defs, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate } from '@/core/date';
import { pct, rp, shown, shownPct } from '@/core/money';
import {
  heroActionRecord,
  heroActionScan,
  heroActionTransfer,
  hideAmountsLabel,
  hideAmountsShortLabel,
  netWorthChangeLabel,
  netWorthIncompleteNote,
  netWorthLabel,
  showAmountsLabel,
  showAmountsShortLabel,
  summaryOpen,
  type GreetingKind,
} from '@/i18n';
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
  greeting: GreetingKind | null; // null until it is known: the line is left empty, never drawn twice
  netWorth: number;
  incomplete?: boolean;
  change?: HeroChange | null;
  note?: string; // empty state: the one-line explanation under the balance
  onAddTransaction?: () => void;
  onTransfer?: () => void;
  onScan?: () => void;
  onOpenSummary?: () => void; // the balance, and the link under it, open the Summary page
}

// The net worth change: a chip in the tone of its sign, then "vs <last month end>".
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

export function HeroSection({
  nickname,
  greeting,
  netWorth,
  incomplete = false,
  change,
  note,
  onAddTransaction,
  onTransfer,
  onScan,
  onOpenSummary,
}: HeroSectionProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const toggle = useHideAmounts(s => s.toggle);
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_WIDTH;
  const fullLabel = hidden ? showAmountsLabel() : hideAmountsLabel();
  const buttonText = narrow ? (hidden ? showAmountsShortLabel() : hideAmountsShortLabel()) : fullLabel;

  const shimmer = useSharedValue(-1);
  const reducedMotion = useReducedMotion();

  const onShine = useCallback(() => {
    if (reducedMotion) return;
    shimmer.set(-1);
    shimmer.set(withTiming(1.6, {
      duration: 1000,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }));
  }, [reducedMotion, shimmer]);

  const sheenStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [-1, 1.6], [-160, width + 60]);
    const opacity = interpolate(shimmer.value, [-1, -0.2, 0.4, 1.2, 1.6], [0, 0.85, 1, 0.85, 0]);
    return {
      opacity,
      transform: [{ translateX }, { skewX: '-24deg' }],
    };
  });

  return (
    <View style={styles.hero} testID="overview-hero">
      <View style={styles.card} testID="overview-net-worth-card">
        {/* Luxury dark metallic card backdrop with ambient gold light and fluid curves */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" viewBox="0 0 350 210" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1C1C1F" />
              <Stop offset="55%" stopColor="#121214" />
              <Stop offset="100%" stopColor="#0B0B0D" />
            </LinearGradient>
            <LinearGradient id="hero-ambient" x1="100%" y1="0%" x2="30%" y2="80%">
              <Stop offset="0%" stopColor="#C7CDD6" stopOpacity="0.18" />
              <Stop offset="50%" stopColor="#C7CDD6" stopOpacity="0.04" />
              <Stop offset="100%" stopColor="#C7CDD6" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="hero-gold-stroke-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#C7CDD6" stopOpacity="0.08" />
              <Stop offset="50%" stopColor="#C7CDD6" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#C7CDD6" stopOpacity="0.15" />
            </LinearGradient>
            <LinearGradient id="hero-gold-stroke-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.03" />
              <Stop offset="45%" stopColor="#EEF1F6" stopOpacity="0.32" />
              <Stop offset="100%" stopColor="#C7CDD6" stopOpacity="0.08" />
            </LinearGradient>
            <LinearGradient id="hero-wave-fill" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#C7CDD6" stopOpacity="0.08" />
              <Stop offset="60%" stopColor="#C7CDD6" stopOpacity="0.02" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="350" height="210" fill="url(#hero-bg)" />
          <Rect width="350" height="210" fill="url(#hero-ambient)" />
          <Path d="M 80 -10 C 180 50, 240 120, 360 80 L 360 -10 Z" fill="url(#hero-wave-fill)" />
          <Path d="M 60 -15 C 160 45, 230 115, 360 75" stroke="url(#hero-gold-stroke-1)" strokeWidth="1.75" fill="none" />
          <Path d="M 90 -20 C 190 55, 260 135, 370 110" stroke="url(#hero-gold-stroke-2)" strokeWidth="1.25" fill="none" />
          <Path d="M 130 -20 C 220 70, 280 160, 390 145" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
          <Path d="M 170 -15 C 255 85, 305 185, 410 180" stroke="rgba(199,205,214,0.22)" strokeWidth="1" strokeDasharray="3 4" fill="none" />
          <Path d="M 215 -10 C 290 100, 335 205, 430 205" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" fill="none" />
          <Path d="M 0 0 L 350 0" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        </Svg>

        {/* Shimmer / gleam animated specular beam */}
        <Animated.View pointerEvents="none" style={[styles.sheenWrap, sheenStyle]}>
          <Svg width="120" height="320" viewBox="0 0 120 320">
            <Defs>
              <LinearGradient id="hero-sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="25%" stopColor="#EEF1F6" stopOpacity="0.2" />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
                <Stop offset="75%" stopColor="#C7CDD6" stopOpacity="0.28" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="120" height="320" fill="url(#hero-sheen)" />
          </Svg>
        </Animated.View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>{netWorthLabel()}</Text>
          <View style={styles.topRightControls}>
            <Pressable
              onPress={onShine}
              accessibilityRole="button"
              accessibilityLabel="Kilaukan kartu"
              hitSlop={8}
              style={({ pressed }) => [styles.sparkleButton, pressed && styles.pressed]}
              testID="hero-card-shimmer"
            >
              <Icon name="spark" size={16} color={MonoColors.accent} />
            </Pressable>
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
        </View>

        {/* the whole block opens the Summary on touch; for a screen reader the link below does, so the balance is still read */}
        <Pressable style={styles.balanceBlock} onPress={onOpenSummary} disabled={!onOpenSummary} accessible={false} android_ripple={undefined} testID="hero-open-summary">
          <Amount value={netWorth} variant="heroBalance" testID="hero-balance" />
          {!!note && <Text style={styles.note}>{note}</Text>}
          {incomplete && <Text style={styles.note}>{netWorthIncompleteNote()}</Text>}
          {change && <ChangeChip change={change} hidden={hidden} />}
        </Pressable>

        {(onAddTransaction || onTransfer || onScan || onOpenSummary) && (
          <View style={styles.actionRow}>
            {onAddTransaction && (
              <Pressable
                onPress={onAddTransaction}
                accessibilityRole="button"
                accessibilityLabel={heroActionRecord()}
                android_ripple={undefined}
                style={({ pressed }) => [styles.primaryPill, pressed && styles.pressed]}
                testID="hero-action-record"
              >
                <Icon name="plus" size={16} color="#0A0A0A" />
                <Text style={styles.primaryPillText}>{heroActionRecord()}</Text>
              </Pressable>
            )}

            {onTransfer && (
              <Pressable
                onPress={onTransfer}
                accessibilityRole="button"
                accessibilityLabel={heroActionTransfer()}
                android_ripple={undefined}
                style={({ pressed }) => [styles.secondaryPill, pressed && styles.pressed]}
                testID="hero-action-transfer"
              >
                <Icon name="transfer" size={16} color={MonoColors.text} />
                <Text style={styles.secondaryPillText}>{heroActionTransfer()}</Text>
              </Pressable>
            )}

            {onScan && (
              <Pressable
                onPress={onScan}
                accessibilityRole="button"
                accessibilityLabel={heroActionScan()}
                android_ripple={undefined}
                style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
                testID="hero-action-scan"
              >
                <Icon name="scan" size={18} color={MonoColors.text} />
              </Pressable>
            )}

            {onOpenSummary && (
              <Pressable
                onPress={onOpenSummary}
                accessibilityRole="button"
                accessibilityLabel={summaryOpen()}
                hitSlop={4}
                android_ripple={undefined}
                style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
                testID="hero-summary-link"
              >
                <Icon name="trend" size={18} color={MonoColors.text} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0 },
  card: {
    backgroundColor: MonoColors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MonoColors.border,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sparkleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(199,205,214,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(199,205,214,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheenWrap: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 120,
    zIndex: 10,
  },
  hideButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginVertical: -8 },
  pressed: { opacity: 0.7 },
  hideText: { ...MonoText.bodyS, fontFamily: MonoText.figureRow.fontFamily, color: MonoColors.textMeta },
  balanceBlock: { gap: 8, marginTop: -2 },
  note: { ...MonoText.body, color: MonoColors.textSecond },
  changeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 6 },
  chip: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { ...MonoText.chip },
  vs: { ...MonoText.bodyS, color: MonoColors.textSecond },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  primaryPill: {
    flex: 1,
    minWidth: 88,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: MonoColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  primaryPillText: {
    ...MonoText.bodyStrong,
    fontSize: 13,
    color: '#0A0A0A',
  },
  secondaryPill: {
    flex: 1,
    minWidth: 88,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: MonoColors.raised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  secondaryPillText: {
    ...MonoText.bodyStrong,
    fontSize: 13,
    color: MonoColors.text,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MonoColors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
