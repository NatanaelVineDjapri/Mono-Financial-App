// The soft wave behind the hero's top right (390×250): a faint white swoosh and a gold
// ribbon fading to transparent. Decorative only, hidden from screen readers.
//
// The two paths are drawn to match the board's feel; the board's own path data is not in
// the repo. Swap the `d` strings for the Main board's paths when they are exported.
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { GOLD, GOLD_DEEP, GOLD_LIGHT } from './palette';

export const WAVE_WIDTH = 390;
export const WAVE_HEIGHT = 250;

const WHITE_PATH = 'M390 0 L390 160 C 330 196 262 130 204 88 C 152 50 104 44 56 0 Z';
const GOLD_PATH = 'M126 0 C 196 72 252 42 302 112 C 340 166 368 152 390 132 L390 196 C 358 222 318 224 280 166 C 240 106 188 124 88 0 Z';

export function HeroWave() {
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="hero-wave">
      <Svg width={WAVE_WIDTH} height={WAVE_HEIGHT} viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}>
        <Defs>
          <LinearGradient id="waveWhite" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.09} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="waveGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_LIGHT} stopOpacity={0.55} />
            <Stop offset="0.5" stopColor={GOLD} stopOpacity={0.32} />
            <Stop offset="1" stopColor={GOLD_DEEP} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={WHITE_PATH} fill="url(#waveWhite)" />
        <Path d={GOLD_PATH} fill="url(#waveGold)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchored to the top right; a screen narrower than 390 simply crops its left edge.
  wrap: { position: 'absolute', top: 0, right: 0, width: WAVE_WIDTH, height: WAVE_HEIGHT },
});
