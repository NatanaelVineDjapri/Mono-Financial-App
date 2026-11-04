// DESIGN.md section 8/16: 40 tall, radius 10. Selected = light fill + a check mark, never
// colour alone. No icon library is in CLAUDE.md's stack list, so the check is a plain
// Text glyph (✓) rather than pulling in one for a single mark — flagged as a judgment call.
import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';

import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ChipProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  label: string;
  selected: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Chip({ label, selected, disabled = false, onPress, style, ...rest }: ChipProps) {
  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      android_ripple={undefined}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && !disabled && !selected && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {selected && <Text style={styles.check}>{'✓'}</Text>}
      <Text style={[MonoText.bodyS, selected ? styles.selectedText : styles.unselectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 40,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selected: { backgroundColor: MonoColors.text },
  unselected: { backgroundColor: 'transparent', borderWidth: 1, borderColor: MonoColors.border },
  pressed: { backgroundColor: MonoColors.raised },
  disabled: { opacity: 0.4 },
  check: { color: MonoColors.bg, fontSize: 14 },
  selectedText: { color: MonoColors.bg },
  unselectedText: { color: MonoColors.text },
});
