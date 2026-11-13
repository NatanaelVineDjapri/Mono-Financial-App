import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

/**
 * Shared list-screen title row. Its 16px inset is the same guide used by the
 * screen content, so outlined actions end exactly on the content edge.
 */
export function HeaderRow({ title, right, style, testID, withTopInset = true }: {
  title: string;
  right?: ReactNode;
  style?: ViewStyle;
  testID?: string;
  withTopInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.row, withTopInset && { paddingTop: insets.top + 12 }, style]}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {right != null && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { ...MonoText.titleL, color: MonoColors.text, flexShrink: 1 },
  right: { flexShrink: 0 },
});
