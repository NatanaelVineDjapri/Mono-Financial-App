// The category tile on Transaction detail's hero card: 48 square, radius 16, the card fill
// with a 1px border and the category's icon drawn in gold (24). Gold is the one accent and
// icon tiles are one of its jobs (CLAUDE.md rule 5). Decorative: the title beside it says the
// same, so it is hidden from screen readers.
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';

export interface CategoryTileProps {
  icon: IconName;
  size?: number;
  radius?: number;
  iconSize?: 20 | 24;
  testID?: string;
}

export function CategoryTile({ icon, size = 48, radius = 16, iconSize = 24, testID }: CategoryTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: MonoColors.card,
        borderWidth: 1,
        borderColor: MonoColors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Icon name={icon} size={iconSize} color={MonoColors.accent} />
    </View>
  );
}
