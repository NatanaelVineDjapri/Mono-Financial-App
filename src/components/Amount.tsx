// The one door every currency figure passes through (CLAUDE.md rule 12). Formats via
// rp()/money(), then shown() — hidden-amounts mode never leaks a real number. Colour
// comes from amountColor('income' | 'expense' | 'transfer'): positive, negative, or
// textSecond for transfer/no kind (DESIGN.md section 3: transfers are never coloured).
// Sign follows the value/sign props, independent of kind — the caller decides whether an
// expense is passed as a negative number, matching rp()'s own convention.
import { Text, type TextProps, type TextStyle } from 'react-native';

import { money, rp, shown } from '@/core/money';
import { useHideAmounts } from './hide-amounts-store';
import { MonoColors, amountColor, type AmountKind } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface AmountProps extends Omit<TextProps, 'children' | 'style'> {
  // Minor units: whole rupiah for IDR (the default), or the pocket's own minor unit
  // when `currency` is given (e.g. USD cents).
  value: number;
  currency?: string; // omit, or 'IDR', for a rupiah amount
  minorFactor?: number; // required with a non-IDR currency (see `currencies.minor_factor`)
  sign?: boolean; // leading "+" on a positive value (rp()/money()'s own `sign` param)
  kind?: AmountKind; // drives colour only; omit (or 'transfer') for the neutral textSecond
  variant?: keyof typeof MonoText; // a src/theme/typography.ts token; default figureRow
  style?: TextStyle;
}

export function Amount({
  value,
  currency = 'IDR',
  minorFactor = 100,
  sign = false,
  kind,
  variant = 'figureRow',
  style,
  ...rest
}: AmountProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const formatted = currency === 'IDR' ? rp(value, sign) : money(value, currency, minorFactor, sign);
  const display = shown(formatted, hidden);
  const color = kind ? amountColor(kind) : MonoColors.text;

  return (
    <Text
      {...rest}
      accessibilityLabel={rest.accessibilityLabel ?? display}
      style={[MonoText[variant], { color }, style]}
    >
      {display}
    </Text>
  );
}
