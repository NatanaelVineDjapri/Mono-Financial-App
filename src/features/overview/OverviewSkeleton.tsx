// What the Overview shows while its figures are still being read: the same blocks in the same places (the balance card, the
// account card, the quick record card), as plain dark shapes with no text and no figures. The screen is never empty, and when the
// real content arrives it takes the place of these without anything jumping. Static on purpose: it exists for a moment, and a
// moving placeholder would cost more than it gives.
import { StyleSheet, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';

// Roughly the height of the balance card (label row, balance, change chip, three actions) with its padding.
const HERO_HEIGHT = 222;

export function HeroSkeleton() {
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="overview-hero-skeleton">
      <View style={[styles.block, { height: HERO_HEIGHT, borderRadius: 20 }]}>
        <View style={[styles.bar, { width: 96, height: 12 }]} />
        <View style={[styles.bar, { width: 220, height: 36, marginTop: 14 }]} />
        <View style={[styles.bar, { width: 150, height: 24, borderRadius: 12, marginTop: 14 }]} />
      </View>
    </View>
  );
}

export function BelowHeroSkeleton() {
  return (
    <View style={styles.below} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="overview-below-skeleton">
      <View style={[styles.bar, { width: 140, height: 18, marginLeft: 16 }]} />
      <View style={[styles.block, styles.accountCard]} />
      <View style={[styles.bar, { width: 120, height: 18, marginLeft: 16 }]} />
      <View style={[styles.block, styles.quickCard]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 8 },
  block: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, padding: 20 },
  bar: { backgroundColor: MonoColors.raised, borderRadius: 6 },
  below: { gap: 14, paddingTop: 4 },
  accountCard: { height: 154, width: 300, borderRadius: 16, alignSelf: 'center' },
  quickCard: { height: 112, marginHorizontal: 16, borderRadius: 16 },
});
