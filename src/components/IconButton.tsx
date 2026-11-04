// 44 (the lower end of CLAUDE.md's 44-48dp touch target rule), with hitSlop for a little
// extra margin beyond the visual box. Pressed = raised fill (section 16), no ripple.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { MonoColors, radius } from '@/theme/tokens';

const SIZE = 44;
const HIT_SLOP = 8; // not specified exactly; a modest, reasonable default

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  label: string; // accessibilityLabel — required, there is no visible text to fall back on
  disabled?: boolean;
  children: ReactNode; // the icon
  style?: ViewStyle;
}

export function IconButton({ label, disabled = false, onPress, children, style, ...rest }: IconButtonProps) {
  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={HIT_SLOP}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: MonoColors.raised },
  disabled: { opacity: 0.4 },
});
