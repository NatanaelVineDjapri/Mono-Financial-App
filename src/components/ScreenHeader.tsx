// Shared screen header (DESIGN.md section 8 "app bars"): a title, padded for the top
// safe-area inset, with an optional right-side slot (e.g. one or more HeaderButtons,
// laid out in a row 8 apart).
//
// CLAUDE.md rule 6: every screen's title uses the serif titleL. Accounts and Overview
// are the one exception to the "at most one serif moment per screen" rule — their own
// hero balance (displayS/displayL) is also serif, per the design board.
//
// At 200% text the right-side actions keep their full width (a chip's text never
// truncates); the title is what shrinks and wraps.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ScreenHeaderProps {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  // Per-screen spacing overrides (e.g. Transactions' 12 below). The default 20 at the sides
  // lines the right-hand buttons up with the cards' edge, and the default 16 below the
  // header is the gap Accounts' card sits at.
  style?: ViewStyle;
  testID?: string;
}

export function ScreenHeader({ title, left, right, style, testID }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.header, style, { paddingTop: insets.top + 12 }]}>
      {left}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {right != null && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { ...MonoText.titleL, color: MonoColors.text, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});
