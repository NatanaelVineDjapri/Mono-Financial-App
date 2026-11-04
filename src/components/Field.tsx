// DESIGN.md section 5/8/16: text field, default/focus/error/disabled. Error = 1.5px
// light border (section 5's "emphasis 1.5px text", not red — red is reserved for the
// alert icon and helper text, so colour is never the only signal) + icon + helper text.
// Focus is a separate 2px light outline, 2px offset (section 5), drawn as an outer ring
// so it never fights the box's own border.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface FieldProps extends Omit<TextInputProps, 'style' | 'testID' | 'editable'> {
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  // Escape hatch for a variant with the same chrome but different type (AmountField's
  // Figure L), not for ad-hoc per-screen tweaks.
  inputStyle?: TextStyle;
  testID?: string;
}

export function Field({ label, helperText, error, disabled = false, style, inputStyle, testID, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={style} testID={testID}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.ring, focused && !disabled && styles.ringFocused]}>
        <View style={[styles.box, !!error && styles.boxError, disabled && styles.boxDisabled]}>
          <TextInput
            {...rest}
            testID={testID ? `${testID}-input` : undefined}
            editable={!disabled}
            placeholderTextColor={MonoColors.textDisabled}
            selectionColor={MonoColors.text}
            style={[styles.input, inputStyle]}
            onFocus={e => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              onBlur?.(e);
            }}
          />
          {!!error && <Icon name="alert" size={16} color={MonoColors.negative} />}
        </View>
      </View>
      {!!(error ?? helperText) && (
        <Text style={error ? styles.errorText : styles.helperText} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {error ?? helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...MonoText.label, color: MonoColors.textSecond, textTransform: 'uppercase', marginBottom: 8 },
  ring: { borderRadius: radius.md + 2, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  ringFocused: { borderColor: MonoColors.text },
  box: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  boxError: { borderWidth: 1.5, borderColor: MonoColors.text },
  boxDisabled: { opacity: 0.4 },
  input: { flex: 1, paddingVertical: 12, ...MonoText.body, color: MonoColors.text },
  helperText: { ...MonoText.bodyS, color: MonoColors.textMeta, marginTop: 4 },
  errorText: { ...MonoText.bodyS, color: MonoColors.negative, marginTop: 4 },
});
