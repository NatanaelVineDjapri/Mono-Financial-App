// DESIGN.md section 8/16: 40 tall, radius 10. Selected = light fill + a check mark, never
// colour alone.
import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
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
      {selected && <Icon name="check" size={16} color={MonoColors.bg} testID="chip-check" />}
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
  // A real fill (not transparent): an unselected chip sitting on a sheet whose own
  // background is `raised` needs its own distinct, slightly darker box, not just an
  // outline that reads as a hole showing the sheet through it.
  unselected: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border },
  pressed: { backgroundColor: MonoColors.raised },
  disabled: { opacity: 0.4 },
  selectedText: { color: MonoColors.bg },
  unselectedText: { color: MonoColors.text },
});
