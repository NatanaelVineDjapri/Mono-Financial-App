// The top of the Overview: one drawn backdrop behind everything from the MONO logo down to
// the net worth balance (the header and the hero are its children). No image file: a thin
// gold ribbon is drawn with react-native-svg and rises to the right, through the top-right
// corner, above the greeting and the balance. The container clips it.
//
// The ribbon is a crescent (thick in the middle, thin at both ends) filled with a horizontal
// gradient that starts invisible on the left and reaches full gold at the right edge, a pale
// sheen along its lower edge, and two faint wide strokes under it as a soft glow. All of it is
// gold at low opacity over the screen's #0A0A0A, so it never competes with the text on top.
// The backdrop is only as tall as the ribbon (about 0.7 of the screen width); below that the
// screen colour shows, so nothing has to fade out.
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

// The drawing's own coordinate space; it is scaled uniformly to the screen width.
const VIEW_W = 400;
const VIEW_H = 280;
// The ribbon's centre line, left to right, and its outline (upper edge out, lower edge back).
const CENTRE = 'M -20 168 C 120 142 270 92 420 -12';
const RIBBON = 'M -20 160 C 120 134 270 84 420 -22 L 420 -2 C 300 108 140 178 -20 176 Z';
const SHEEN = 'M -20 176 C 140 178 300 108 420 -2';
// A pale gold for the sheen: the accent lifted toward white, still the same hue.
const SHEEN_COLOR = '#F3DFAE';

export function OverviewTop({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const height = (VIEW_H * width) / VIEW_W;

  return (
    <View style={styles.top} testID="overview-top">
      <View
        style={[styles.backdrop, { height }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="overview-backdrop"
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <LinearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={MonoColors.accent} stopOpacity="0" />
              <Stop offset="0.45" stopColor={MonoColors.accent} stopOpacity="0.35" />
              <Stop offset="0.8" stopColor={MonoColors.accent} stopOpacity="0.85" />
              <Stop offset="1" stopColor={MonoColors.accent} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={SHEEN_COLOR} stopOpacity="0" />
              <Stop offset="0.6" stopColor={SHEEN_COLOR} stopOpacity="0.5" />
              <Stop offset="1" stopColor={SHEEN_COLOR} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
          {/* Glow: two wide, faint strokes along the centre line. */}
          <Path d={CENTRE} stroke={MonoColors.accent} strokeOpacity={0.05} strokeWidth={64} strokeLinecap="round" fill="none" />
          <Path d={CENTRE} stroke={MonoColors.accent} strokeOpacity={0.08} strokeWidth={34} strokeLinecap="round" fill="none" />
          <Path d={RIBBON} fill="url(#ribbon)" />
          <Path d={SHEEN} stroke="url(#sheen)" strokeWidth={1.5} fill="none" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // No fill of its own: the drawing and, past it, the screen's #0A0A0A.
  top: { position: 'relative', overflow: 'hidden' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0 },
});
