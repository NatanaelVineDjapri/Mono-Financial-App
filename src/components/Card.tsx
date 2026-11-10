// The Overview's surface (DESIGN.md "A. Overview"): `card` fill, radius 16, padding 16.
// `outlined` adds the 1.5 gold frame the Fixed expenses card wears — a frame, never text.
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { MonoColors, radius } from '@/theme/tokens';

export interface CardProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  outlined?: boolean;
  style?: ViewStyle;
}

export function Card({ children, outlined = false, style, ...rest }: CardProps) {
  return (
    <View {...rest} style={[styles.base, outlined && styles.outlined, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: MonoColors.card, borderRadius: radius.lg, padding: 16 },
  // Border sits inside the radius; the 1.5 is the design's own value.
  outlined: { borderWidth: 1.5, borderColor: MonoColors.accent },
});
