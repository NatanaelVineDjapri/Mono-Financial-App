// The top of the Overview: one background image behind everything from the MONO logo down
// to the net worth balance (the header and the hero are its children). The image is the
// owner's portrait artwork (assets/images/mono-overview-bg.jpg, 936×1681): dark, with a thin
// gold ribbon rising to the right. It is scaled to the screen width (uniformly) and shifted
// up so the ribbon runs through the top-right corner, above the greeting and the balance;
// the container clips the rest.
//
// The artwork is opaque and only as tall as the screen is wide times 1.8, so the shifted
// image ends part-way down the hero, and its lower part is a little lighter than the screen.
// A fade into #0A0A0A is laid over the image's own bottom edge (not the container's), so the
// artwork melts into the screen colour instead of ending in a visible line. That fade is the
// only overlay.
import type { ReactNode } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

const IMAGE_WIDTH = 936;
const IMAGE_HEIGHT = 1681;
// Where the ribbon's right end sits in the artwork (its top edge at the right border).
const RIBBON_Y = 986;
// Where that point should land inside the container, in dp. Negative: the ribbon enters
// from above the top edge and only its lower sweep shows, behind the header.
const RIBBON_TARGET_Y = -40;
const FADE_HEIGHT = 150;

export function OverviewTop({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const scale = width / IMAGE_WIDTH;
  const imageHeight = IMAGE_HEIGHT * scale;
  const offsetTop = RIBBON_TARGET_Y - RIBBON_Y * scale;

  return (
    <View style={styles.top} testID="overview-top">
      <Image
        source={require('@/assets/images/mono-overview-bg.jpg')}
        style={[styles.image, { width, height: imageHeight, top: offsetTop }]}
        resizeMode="cover"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="overview-backdrop"
      />
      <View style={[styles.fade, { top: offsetTop + imageHeight - FADE_HEIGHT }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={FADE_HEIGHT}>
          <Defs>
            <LinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={MonoColors.bg} stopOpacity="0" />
              <Stop offset="1" stopColor={MonoColors.bg} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={FADE_HEIGHT} fill="url(#topFade)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // No fill of its own: the artwork and, past it, the screen's #0A0A0A.
  top: { position: 'relative', overflow: 'hidden' },
  image: { position: 'absolute', left: 0 },
  fade: { position: 'absolute', left: 0, right: 0, height: FADE_HEIGHT },
});
