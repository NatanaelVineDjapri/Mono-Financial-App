// Static replacement for Expo's own animated splash (no animation, per the owner): the same MONO mark and bg colour as the native
// splash, drawn by JS so there is no flash between the two. The native splash is released as soon as this is on screen, and this
// stays up until the first screen has settled (src/core/appReady: the Overview has its data, Welcome is drawn, any other first
// route is up, or the hard timeout): the person sees the splash and then the real content, never the half-built frame in between
// (the gold ribbon and the header over an empty body).
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { startReadyTimeout, useAppReady } from '@/core/appReady';
import { armIntro } from '@/core/intro';
import { MonoColors } from '@/theme/tokens';

const MARK_WIDTH = 120;
const MARK_ASPECT_RATIO = 219 / 222; // assets/brand/mono-mark.png's own width/height

export function SplashBrand() {
  const ready = useAppReady(s => s.ready);
  const nativeReleased = useRef(false);
  // The hard maximum: whatever happens to the first screen, the splash goes.
  useEffect(() => startReadyTimeout(), []);
  // The app has just been opened: the first screen makes an entrance once the splash lifts.
  useEffect(() => armIntro(), []);

  if (ready) return null;

  return (
    <View
      style={styles.overlay}
      onLayout={() => {
        if (nativeReleased.current) return;
        nativeReleased.current = true;
        SplashScreen.hideAsync().catch(() => undefined);
      }}
      testID="splash-brand"
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
