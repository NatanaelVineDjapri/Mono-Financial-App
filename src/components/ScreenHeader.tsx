// Shared screen header (DESIGN.md section 8 "app bars"): a title, padded for the top
// safe-area inset, with an optional right-side slot (e.g. a button or toggle).
//
// CLAUDE.md rule 6: every screen's title uses the serif titleL. Accounts and Overview
// are the one exception to the "at most one serif moment per screen" rule — their own
// hero balance (displayS/displayL) is also serif, per the design board.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ScreenHeaderProps {
  title: string;
  right?: ReactNode;
  testID?: string;
}

export function ScreenHeader({ title, right, testID }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>{title}</Text>
      {right}
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
  title: { ...MonoText.titleL, color: MonoColors.text },
});
