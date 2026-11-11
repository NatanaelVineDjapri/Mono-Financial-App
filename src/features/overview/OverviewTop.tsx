// The top of the Overview: a diagonal amber-to-dark gradient behind the header and hero,
// matching the same visual language as the BankCard total card in Accounts
// (top-left #0A0A0A → bottom-right #E3C27A with a fade to bg at the bottom edge).
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

const FADE_HEIGHT = 80;

export function OverviewTop({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  // Generous height so the gradient fills the header + hero area.
  const bgHeight = 280;

  return (
    <View style={styles.top} testID="overview-top">
      {/* Diagonal gradient: dark top-left → amber bottom-right */}
      <View
        style={[styles.gradient, { width, height: bgHeight }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="overview-backdrop"
      >
        <Svg width={width} height={bgHeight}>
          <Defs>
            <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0A0A0A" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#2A1F0A" stopOpacity="1" />
              <Stop offset="1" stopColor={MonoColors.accent} stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={bgHeight} fill="url(#heroBg)" />
        </Svg>
      </View>
      {/* Bottom fade into screen bg so the gradient melts into the content below */}
      <View
        style={[styles.fade, { top: bgHeight - FADE_HEIGHT, width }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={width} height={FADE_HEIGHT}>
          <Defs>
            <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={MonoColors.bg} stopOpacity="0" />
              <Stop offset="1" stopColor={MonoColors.bg} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={FADE_HEIGHT} fill="url(#bottomFade)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'relative', overflow: 'hidden' },
  gradient: { position: 'absolute', top: 0, left: 0 },
  fade: { position: 'absolute', left: 0 },
});
