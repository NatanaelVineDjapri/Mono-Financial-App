// An icon inside a small progress ring (the category rows of the Transactions statistics): the ring's length is the
// category's share, in basis points. Decoration only: the percent and the amount are written beside it.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

export const ICON_RING_SIZE = 46;
const STROKE = 3.5;

export function IconRing({ valueBp, color, children, testID }: { valueBp: number; color: string; children: ReactNode; testID?: string }) {
  const r = (ICON_RING_SIZE - STROKE) / 2;
  const c = ICON_RING_SIZE / 2;
  const around = 2 * Math.PI * r;
  const length = (Math.max(0, Math.min(10000, valueBp)) / 10000) * around;
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <Svg width={ICON_RING_SIZE} height={ICON_RING_SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={MonoColors.border} strokeWidth={STROKE} fill={MonoColors.surface} />
        {length > 0 && (
          // starts at 12 o'clock, runs clockwise
          <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={[length, around]} transform={`rotate(-90 ${c} ${c})`} />
        )}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: ICON_RING_SIZE, height: ICON_RING_SIZE, alignItems: 'center', justifyContent: 'center' },
});
