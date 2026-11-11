// One row of More (DESIGN.md Components "More row"): a 40 icon tile, a title, a subtitle of up to
// two lines and a chevron, at least 64 high. At large text sizes the row grows downward and the
// chevron stays visible. The whole row is the button; its label reads title and subtitle.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { moreRowLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { IconTile } from './IconTile';

export interface MoreRowProps {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean; // no separator under the last row of a card
  testID?: string;
}

export function MoreRow({ icon, title, sub, onPress, last = false, testID }: MoreRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={moreRowLabel(title, sub)}
      android_ripple={undefined}
      style={({ pressed }) => [styles.row, !last && styles.separator, pressed && styles.pressed]}
      testID={testID}
    >
      <IconTile icon={icon} testID={testID ? `${testID}-tile` : undefined} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={MonoColors.textMeta} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  separator: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  pressed: { backgroundColor: MonoColors.raised },
  text: { flex: 1, gap: 2 },
  title: { ...MonoText.bodyStrong, lineHeight: 20, color: MonoColors.text },
  sub: { ...MonoText.bodyS, color: MonoColors.textMeta },
});
