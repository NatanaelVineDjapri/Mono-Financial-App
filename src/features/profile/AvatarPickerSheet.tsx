// "Foto profil": a sheet with the default avatar and the nine fox poses in a 3-wide grid. Tapping one chooses it and
// closes the sheet (there is nothing to confirm: it only changes a picture). The chosen one has a check mark and
// accessibilityState.selected, never colour alone. Cells are at least 96 high and grow with the text.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { cancelLabel, profileAvatarDefault, profileAvatarPose, profilePickerSubtitle, profilePickerTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AVATAR_POSES, type AvatarPoseId } from './avatarPoses';
import { ProfileAvatar } from './ProfileAvatar';

const COLUMNS = 3;
const PREVIEW = 64;

export interface AvatarPickerSheetProps {
  visible: boolean;
  selected: AvatarPoseId | null;
  onSelect: (id: AvatarPoseId | null) => void;
  onClose: () => void;
}

function Cell({ poseId, label, selected, onPress, testID }: { poseId: AvatarPoseId | null; label: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      android_ripple={undefined}
      style={({ pressed }) => [styles.cell, selected && styles.cellSelected, pressed && styles.pressed]}
      testID={testID}
    >
      <View>
        <ProfileAvatar poseId={poseId} size={PREVIEW} />
        {selected && (
          <View style={styles.check} testID={`${testID}-check`}>
            <Icon name="check" size={16} color={MonoColors.bg} />
          </View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export function AvatarPickerSheet({ visible, selected, onSelect, onClose }: AvatarPickerSheetProps) {
  const options: { id: AvatarPoseId | null; label: string }[] = [
    { id: null, label: profileAvatarDefault() },
    ...AVATAR_POSES.map(p => ({ id: p.id as AvatarPoseId | null, label: profileAvatarPose(p.id) })),
  ];
  const rows: (typeof options)[] = [];
  for (let i = 0; i < options.length; i += COLUMNS) rows.push(options.slice(i, i + COLUMNS));

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={cancelLabel()} testID="avatar-picker-sheet">
      <SheetHeader visible={visible} icon="image" title={profilePickerTitle()} subtitle={profilePickerSubtitle()} onClose={onClose} />
      <View style={styles.grid} accessibilityRole="radiogroup">
        {rows.map((row, index) => (
          <View key={index} style={styles.row}>
            {row.map(option => (
              <Cell
                key={option.id ?? 'default'}
                poseId={option.id}
                label={option.label}
                selected={option.id === selected}
                onPress={() => onSelect(option.id)}
                testID={`avatar-option-${option.id ?? 'default'}`}
              />
            ))}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, minHeight: 112, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.surface },
  cellSelected: { borderColor: MonoColors.text },
  pressed: { opacity: 0.7 },
  check: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: MonoColors.text, alignItems: 'center', justifyContent: 'center' },
  label: { ...MonoText.caption, color: MonoColors.textSecond, textAlign: 'center' },
});
