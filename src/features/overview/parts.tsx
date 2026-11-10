// Small drawn pieces shared by the Overview's cards.
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';

import { GOLD, GOLD_LIGHT } from './palette';

// A filled triangle: up for a rise, down for a fall. The direction is the signal; the
// colour only reinforces it.
export function Triangle({ up, color, size = 8 }: { up: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={up ? 'M4 1 L7.5 7 L0.5 7 Z' : 'M4 7 L0.5 1 L7.5 1 Z'} fill={color} />
    </Svg>
  );
}

// 40 gold gradient disc with a dark arrow (the Expenses / Income cards).
export function GoldDisc({ icon }: { icon: IconName }) {
  return (
    <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={40} height={40} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="goldDisc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_LIGHT} />
            <Stop offset="1" stopColor={GOLD} />
          </LinearGradient>
        </Defs>
        <Path d="M20 0 a20 20 0 1 0 0.001 0 Z" fill="url(#goldDisc)" />
      </Svg>
      <Icon name={icon} size={20} color={MonoColors.bg} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
