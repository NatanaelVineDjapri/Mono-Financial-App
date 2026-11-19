// The round profile picture: the chosen fox pose, cropped to a circle around the face, or the default avatar (the
// fox's head from the welcome picture) when nothing is chosen. Decorative: the words next to it carry the meaning,
// so it is hidden from screen readers.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { MascotAvatar } from '@/features/ai_chat/ui/MascotAvatar';
import { MonoColors } from '@/theme/tokens';

import { poseById, type AvatarPoseId } from './avatarPoses';

export function ProfileAvatar({ poseId, size = 40, testID }: { poseId: AvatarPoseId | null; size?: number; testID?: string }) {
  const pose = poseById(poseId);
  if (!pose) return <MascotAvatar size={size} testID={testID} />;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      testID={testID}
    >
      {/* the pictures are wider than tall and the face sits a little right of centre: cover, anchored there */}
      <Image source={pose.source} contentFit="cover" contentPosition={{ left: '58%', top: '40%' }} style={StyleSheet.absoluteFill} testID={testID ? `${testID}-image` : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { overflow: 'hidden', backgroundColor: MonoColors.bg },
});
