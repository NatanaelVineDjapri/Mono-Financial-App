// DESIGN.md section 4/8/16: amount entry uses Figure L (32/40 tabular), number-pad,
// strips non-digits, stores a whole-rupiah int. Reuses Field's chrome (ring, box,
// label, helper/error) via inputStyle, so focus/error/disabled stay pixel-identical to
// the text field — only the typography and the digits-only parsing differ. Formatting
// the live text (via `rp`) means the cursor always lands at the end while typing, same
// tradeoff every thousands-separated amount input has; acceptable since amounts are
// entered start-to-end, not edited mid-string.
import { Field, type FieldProps } from '@/components/Field';
import { rp } from '@/core/money';
import { MonoText } from '@/theme/typography';

export interface AmountFieldProps extends Pick<FieldProps, 'label' | 'helperText' | 'error' | 'disabled' | 'autoFocus' | 'style' | 'testID'> {
  value: number; // whole rupiah, caller-controlled
  onChangeValue: (value: number) => void;
}

function digitsOnly(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function AmountField({ value, onChangeValue, ...rest }: AmountFieldProps) {
  return (
    <Field
      {...rest}
      keyboardType="number-pad"
      value={rp(value)}
      onChangeText={text => onChangeValue(digitsOnly(text))}
      inputStyle={MonoText.figureL}
    />
  );
}
