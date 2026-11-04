// DESIGN.md section 7: one line-icon set, 24 grid, 1.5 stroke, round caps/joins.
// Sizes 16 (inline), 20 (default), 26 (empty states). Colour always comes in via the
// `color` prop (a token from the caller) — never a literal hex in this file.
import { Path, Svg } from 'react-native-svg';

export type IconName =
  | 'check'
  | 'alert'
  | 'alert-circle'
  | 'close'
  | 'plus'
  | 'minus'
  | 'chevron-down'
  | 'chevron-right'
  | 'eye'
  | 'eye-off';

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 26;
  color: string;
  // When the icon is the only signal (no adjacent label), pass a label and it is exposed
  // to screen readers. Omitted = decorative: hidden, since the icon sits next to text that
  // already says the same thing.
  label?: string;
  testID?: string;
}

const PATHS: Record<IconName, string> = {
  check: 'M5 13 L10 18 L19 6',
  alert: 'M12 3 L22 20 L2 20 Z M12 9 L12 14 M12 17.5 L12 17.5',
  'alert-circle': 'M12 3 a9 9 0 1 0 0.001 0 Z M12 8 L12 13 M12 16.5 L12 16.5',
  close: 'M6 6 L18 18 M18 6 L6 18',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  minus: 'M5 12 L19 12',
  'chevron-down': 'M6 9 L12 15 L18 9',
  'chevron-right': 'M9 6 L15 12 L9 18',
  eye: 'M1 12 C4 5 20 5 23 12 C20 19 4 19 1 12 Z M12 9 a3 3 0 1 0 0.001 0 Z',
  'eye-off': 'M1 12 C4 5 20 5 23 12 C20 19 4 19 1 12 Z M12 9 a3 3 0 1 0 0.001 0 Z M3 3 L21 21',
};

export function Icon({ name, size = 20, color, label, testID }: IconProps) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no'}
    >
      <Path d={PATHS[name]} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
