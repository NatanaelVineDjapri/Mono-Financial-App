// The gold ring of the score card: a 128 ring, 10 thick, starting at 12 o'clock and running clockwise, its length
// the score out of 100. It fills in 600 ms on first show and when the score changes; with the system's
// reduce-motion setting on it is drawn full-length at once. The figure in the middle is real text (tabular), so
// the number never depends on the drawing, and the ring is one accessible element that says the score.
import { Canvas, Path } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const RING_SIZE = 128;
const STROKE = 10;
export const FILL_MS = 600;

function arcPath(size: number, stroke: number, sweepDeg: number): string {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [c + r * Math.cos(rad), c + r * Math.sin(rad)];
  };
  const [x0, y0] = toXY(0);
  const [x1, y1] = toXY(sweepDeg);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

// 0..1 over FILL_MS from the previous value to the new one; at once when reduce motion is on.
export function useRingFill(target: number, reducedMotion: boolean): number {
  const [value, setValue] = useState(reducedMotion ? target : 0);
  const from = useRef(reducedMotion ? target : 0);
  useEffect(() => {
    if (reducedMotion) {
      from.current = target;
      let cancelled = false;
      const id = requestAnimationFrame(() => {
        if (!cancelled) setValue(target);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }
    let cancelled = false;
    let raf = 0;
    const start = Date.now();
    const origin = from.current;
    const tick = () => {
      if (cancelled) return;
      const t = Math.min(1, (Date.now() - start) / FILL_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const next = origin + (target - origin) * eased;
      from.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target, reducedMotion]);
  return value;
}

export interface ScoreRingProps {
  score: number | null; // null: an empty ring with a dash (score not ready)
  outOfLabel: string;
  accessibilityLabel: string;
  centerLabel?: string; // shown instead of the figure when there is no score
  testID?: string;
}

export function ScoreRing({ score, outOfLabel, accessibilityLabel, centerLabel, testID }: ScoreRingProps) {
  const reducedMotion = useReducedMotion();
  const fill = useRingFill(score ?? 0, reducedMotion);
  const sweep = Math.max(0, Math.min(359.9, (fill / 100) * 360));
  const track = arcPath(RING_SIZE, STROKE, 359.9);

  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} testID={testID}>
      {Platform.OS === 'web' ? null : (
        <Canvas style={styles.canvas}>
          <Path path={track} color={MonoColors.border} style="stroke" strokeWidth={STROKE} strokeCap="round" />
          {sweep > 0.5 && <Path path={arcPath(RING_SIZE, STROKE, sweep)} color={MonoColors.accent} style="stroke" strokeWidth={STROKE} strokeCap="round" />}
        </Canvas>
      )}
      <View style={styles.center} pointerEvents="none">
        {score === null ? (
          <>
            <Text style={styles.dash}>—</Text>
            {centerLabel ? <Text style={styles.of}>{centerLabel}</Text> : null}
          </>
        ) : (
          <>
            {/* the written figure is the real value, not the animated one */}
            <Text style={styles.score} testID={testID ? `${testID}-value` : undefined}>{score}</Text>
            <Text style={styles.of}>{outOfLabel}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  canvas: { width: RING_SIZE, height: RING_SIZE, position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  score: { ...MonoText.figureXL, color: MonoColors.text },
  dash: { ...MonoText.figureXL, color: MonoColors.textMeta },
  of: { ...MonoText.caption, color: MonoColors.textMeta },
});
