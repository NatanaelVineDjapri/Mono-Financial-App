// Shared screen header (DESIGN.md section 8 "app bars"): a title, padded for the top
// safe-area inset, with an optional right-side slot (e.g. a button or toggle).
//
// CLAUDE.md rule 6 allows at most one serif moment per screen. A screen with its own
// hero balance (Accounts now, Overview in a later phase) spends that moment on the
// balance (displayS/displayL) and sets `serif={false}` here, falling back to titleLSans
// (Plex Sans 600, same 32/36 size as the serif titleL). Every other screen keeps the
// default serif titleL title.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ScreenHeaderProps {
  title: string;
  serif?: boolean;
  right?: ReactNode;
  testID?: string;
}

export function ScreenHeader({ title, serif = true, right, testID }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Text style={serif ? styles.titleSerif : styles.titlePlain}>{title}</Text>
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
  titleSerif: { ...MonoText.titleL, color: MonoColors.text },
  titlePlain: { ...MonoText.titleLSans, color: MonoColors.text },
});
