// Static replacement for Expo's own animated splash (no animation, per the owner):
// bridges native splash → first JS paint with the same MONO mark and bg colour, then
// hides itself once the native splash screen is gone, instead of flashing to Db
// Provider's own blank wait screen (src/data/db/DbProvider.tsx) for one frame.
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';

const MARK_WIDTH = 120;
const MARK_ASPECT_RATIO = 219 / 222; // assets/brand/mono-mark.png's own width/height

export function SplashBrand() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <View
      style={styles.overlay}
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => setVisible(false));
      }}
    >
      <Image style={styles.mark} source={require('@/assets/brand/mono-mark.png')} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: MonoColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: {
    width: MARK_WIDTH,
    aspectRatio: MARK_ASPECT_RATIO,
  },
});
