// Header action button (DESIGN.md section 8): the one style every screen header's right-
// side actions share — Transactions' Filters, Budgets' month chip and edit button.
// 48 high, radius 10, fill `card`, 1px `border`. Icon-only it is a 48×48 square; with
// `text` it becomes a chip (padding 14, text 14/400, icon 8 after the text) that grows
// with the text and never truncates it (CLAUDE.md rule 7: at 200% the chip widens, the
// screen title is what wraps). Pressed = raised fill, no ripple (section 16).
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const HEADER_BUTTON_SIZE = 48;

export interface HeaderButtonProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  label: string; // accessibilityLabel — required, an icon-only button has no visible text
  icon: IconName;
  text?: string; // visible text before the icon (month chip)
  badge?: string; // small count badge on the top-right corner (Filters)
  disabled?: boolean;
  testID?: string;
}

export function HeaderButton({ label, icon, text, badge, disabled = false, onPress, testID, ...rest }: HeaderButtonProps) {
  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      android_ripple={undefined}
      style={({ pressed }) => [styles.base, text ? styles.chip : styles.square, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      testID={testID}
    >
      {!!text && <Text style={styles.text}>{text}</Text>}
      <Icon name={icon} size={20} color={MonoColors.text} testID={testID ? `${testID}-icon` : undefined} />
      {!!badge && (
        <View accessible={false} style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE },
  chip: { minHeight: HEADER_BUTTON_SIZE, paddingHorizontal: 14, flexDirection: 'row', gap: 8 },
  pressed: { backgroundColor: MonoColors.raised },
  disabled: { opacity: 0.4 },
  // 14/400: body's regular family and tabular figures at the chip's own size.
  text: { ...MonoText.body, fontSize: 14, lineHeight: 20, color: MonoColors.text },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: MonoColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...MonoText.caption, color: MonoColors.bg, fontSize: 10, lineHeight: 12 },
});
