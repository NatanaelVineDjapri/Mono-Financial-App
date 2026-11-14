// One category glyph from the registry (icons.ts): 22 px, 1.5 stroke, round caps. Decorative by
// default (the name beside it says the same); the icon picker passes its own label.
import { Path, Svg } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

import { CATEGORY_ICON_PATHS, resolveCategoryIcon } from './icons';

export function CategoryIcon({ iconKey, size = 22, color = MonoColors.accent, testID }: { iconKey: string | null | undefined; size?: number; color?: string; testID?: string }) {
  const key = resolveCategoryIcon(iconKey);
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={CATEGORY_ICON_PATHS[key]} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
