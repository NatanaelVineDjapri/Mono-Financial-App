// 56, radius 16 — Transactions only (DESIGN.md section 8/16). Where it opens the AI chat
// is a screen-level decision (SCREENS.md); this component is just the button.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { MonoColors, radius } from '@/theme/tokens';

const SIZE = 56;

export interface FabProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  label: string;
  disabled?: boolean;
  children: ReactNode; // the icon
  style?: ViewStyle;
}

export function Fab({ label, disabled = false, onPress, children, style, ...rest }: FabProps) {
  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={undefined}
      style={({ pressed }) => [styles.base, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.lg,
    backgroundColor: MonoColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 }, // a filled circle, same reasoning as Button's primary variant
  disabled: { opacity: 0.4 },
});
