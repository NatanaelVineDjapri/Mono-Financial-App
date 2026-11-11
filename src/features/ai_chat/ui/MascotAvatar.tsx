// The fox, as a round avatar: the head of the welcome picture (assets/mascot/welcome-poster.jpg)
// cropped into a circle. Decorative: the words next to it carry the meaning, so it is hidden
// from screen readers.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';

// Where the head sits in the 768 × 768 picture, as fractions, and how much of the picture's width
// the head takes up.
const HEAD_CENTER_X = 0.5;
const HEAD_CENTER_Y = 0.29;
const HEAD_WIDTH = 0.5;

export function MascotAvatar({ size = 32, testID }: { size?: number; testID?: string }) {
  const imageSize = (size * 0.96) / HEAD_WIDTH;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      testID={testID}
    >
      <Image
        source={require('@/assets/mascot/welcome-poster.jpg')}
        contentFit="cover"
        style={{
          position: 'absolute',
          width: imageSize,
          height: imageSize,
          left: size / 2 - HEAD_CENTER_X * imageSize,
          top: size / 2 - HEAD_CENTER_Y * imageSize,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { overflow: 'hidden', backgroundColor: MonoColors.bg },
});
