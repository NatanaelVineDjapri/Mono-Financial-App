// DESIGN.md section 8/16: primary (light fill), secondary (outlined #737373), disabled.
// 48 tall, radius 12. No android_ripple (section 16: never set, no coloured ripples).
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  label: string;
  icon?: IconName; // optional, leading the label (e.g. Accounts tab's Transfer/Add)
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, icon, variant = 'primary', disabled = false, loading = false, onPress, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = isDisabled
    ? variant === 'primary' ? MonoColors.text : MonoColors.textDisabled
    : variant === 'primary' ? MonoColors.bg : MonoColors.text;

  return (
    <Pressable
      {...rest}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={undefined}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        // A filled primary button is already light; "pressed = raised fill" (section 16)
        // only reads correctly on the transparent secondary variant, so primary dims
        // slightly on press instead — a judgment call, not specified down to this level.
        pressed && !isDisabled && (variant === 'primary' ? styles.primaryPressed : styles.secondaryPressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? MonoColors.bg : MonoColors.text} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={16} color={textColor} testID="button-icon" />}
          <Text style={[MonoText.bodyStrong, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: MonoColors.text },
  primaryPressed: { opacity: 0.85 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: MonoColors.textDisabled },
  secondaryPressed: { backgroundColor: MonoColors.raised },
  disabled: { opacity: 0.4 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
