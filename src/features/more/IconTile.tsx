// The 40 × 40 tile behind an icon on More (radius 14, raised fill, 1 px border). The rows of the
// groups and the Backup status card share it, so the lock looks like the target and the tag.
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';

export function IconTile({ icon, testID }: { icon: IconName; testID?: string }) {
  return (
    <View style={styles.tile} testID={testID}>
      <Icon name={icon} size={20} color={MonoColors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 40, height: 40, borderRadius: 14, backgroundColor: MonoColors.raised, borderWidth: 1, borderColor: MonoColors.border, alignItems: 'center', justifyContent: 'center' },
});
