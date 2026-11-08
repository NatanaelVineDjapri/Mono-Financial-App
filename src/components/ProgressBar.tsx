// DESIGN.md section 6/8/16, CLAUDE.md rules 1/5/7/12: an 8px, fully-rounded progress
// bar. `valueBp` is basis points (10000 = 100%), an integer — never a float (rule 1).
//
// Over 10000bp: the fill stops at the limit, then a diagonal-striped `negative` segment
// (drawn with Skia) represents the overage, sized proportionally to it. The drawn
// overage is capped at MAX_DRAWN_OVER_BP (5000bp = 50 percentage points) regardless of
// the real amount, so an extreme over-limit (say 300% used) never stretches the
// over-segment past half the bar's own length — the bar only indicates; the exact
// percentage and amount are always in the accessibility label and `overAmount`'s text,
// never only in the bar's length. The bar's own rendered width never changes: fill and
// overflow are both fractions of one fixed-width track (scaled to 10000 + the drawn
// overage), so a normal (non-over) bar still maps 0..10000bp to the full width 0..100%.
//
// Over-limit is never colour alone (CLAUDE.md rule 5): it always comes with the alert
// icon and the "Lebih …" text below the bar, and the overflow segment is `negative`,
// never a second amber/white series paired with the fill.
//
// `wavy` (opt-in, Budgets only): the filled part is a 4px `accent` line that waves and
// drifts toward the end of the bar, over a flat `border` rail for the unfilled part. It
// is decoration only: length still maps bp to width exactly like the flat fill, and the
// accessibility label and value are unchanged. The wave's path is an SVG string rebuilt
// on the UI thread each frame from one shared phase value (no React re-render per frame).
// Under the system's reduce-motion setting the wave holds still. Web has no Skia (see
// below), so there it stays flat.
//
// Canvas sizing is a guessed judgment call: react-native-skia's `onLayout`/`onSize`
// need a real native measurement (unavailable in this phase, and unsupported at all on
// the new architecture per the library's own warning), so the stripe pattern is drawn
// across a generous fixed virtual width and left to the Canvas's own clip — whatever
// the flex layout actually gives it crops the rest automatically, with no measurement
// needed. The wave is the one exception: its round end caps need the fill's real width,
// which comes from the fill View's own React Native onLayout, not Skia's.
import { Canvas, Line, Path } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Easing, cancelAnimation, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { pct, rp, shown } from '@/core/money';
import { overBy, progressAccessibilityLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const HEIGHT = 8;
const MAX_DRAWN_OVER_BP = 5000;
const STRIPE_GAP = 6; // guessed: dense enough to read as a pattern at 8px tall
const STRIPE_WIDTH = 5; // guessed stroke width
const VIRTUAL_WIDTH = 600; // guessed: wider than any phone screen, so the canvas always clips rather than running out of stripes

// Wavy mode, kept gentle: a low, long wave. Peak-to-peak extent = 2 * amplitude + stroke
// = 7, inside the same 8 tall track as the flat bar, so a wavy bar takes no more room.
// To make it livelier, raise WAVE_AMPLITUDE (the track must stay >= 2 * amplitude +
// stroke) or shorten WAVE_LENGTH; to slow it down, raise WAVE_PERIOD_MS.
const WAVE_HEIGHT = HEIGHT;
const WAVE_STROKE = 3.5;
const WAVE_AMPLITUDE = 0;
const WAVE_LENGTH = 36; // px per full wave
const WAVE_PERIOD_MS = 1800; // time for the wave to drift one full length
const WAVE_STEP = 2; // px between sampled points: smooth at this stroke, cheap to rebuild every frame

export interface ProgressBarProps {
  valueBp: number; // basis points, 10000 = 100%; can exceed it
  label: string; // the subject, e.g. "Belanja" — folded into the full accessibility label
  // Whole rupiah over the limit. Render this (icon + "Lebih …" text) whenever valueBp >
  // 10000 — required in spirit by DESIGN.md's accessibility rule, but left optional at
  // the type level since TS can't make a prop conditionally required on another prop's
  // runtime value; omitting it while over limit just skips the row silently.
  overAmount?: number;
  // Replaces the generated label when a screen has more exact figures to say (e.g.
  // Budgets: spent, limit and what is left). The caller passes every nominal through
  // shown() itself.
  accessibilityLabel?: string;
  // Draw the fill as a moving wave instead of a flat bar. See the header comment.
  wavy?: boolean;
  style?: ViewStyle;
  testID?: string;
}

function stripes(width: number, height: number) {
  const lines = [];
  for (let x = -height; x < width; x += STRIPE_GAP) {
    lines.push(
      <Line key={x} p1={{ x, y: height }} p2={{ x: x + height, y: 0 }} color={MonoColors.negative} strokeWidth={STRIPE_WIDTH} />,
    );
  }
  return lines;
}

// The wave from `from` to `to` as an SVG path string, sampled every WAVE_STEP px. `x` is
// absolute (not relative to `from`), so every bar on screen shares one wave pattern, and
// a growing `phase` moves it toward +x.
function wavePath(from: number, to: number, phase: number): string {
  'worklet';
  const centreY = WAVE_HEIGHT / 2;
  const k = (2 * Math.PI) / WAVE_LENGTH;
  const shift = 2 * Math.PI * phase;
  let d = `M${from.toFixed(1)} ${(centreY + WAVE_AMPLITUDE * Math.sin(k * from - shift)).toFixed(1)}`;
  for (let x = from + WAVE_STEP; x < to; x += WAVE_STEP) {
    d += `L${x.toFixed(1)} ${(centreY + WAVE_AMPLITUDE * Math.sin(k * x - shift)).toFixed(1)}`;
  }
  return `${d}L${to.toFixed(1)} ${(centreY + WAVE_AMPLITUDE * Math.sin(k * to - shift)).toFixed(1)}`;
}

// The waving fill, drawn into a canvas exactly as wide as the fill View (`width`, from
// its onLayout). The line starts and ends half a stroke inside, so the round caps end
// exactly at the fill's edges. A fill narrower than a stroke collapses to a dot.
function WaveFill({ width }: { width: number }) {
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);

  // Writing a shared value's `.value` belongs in an effect, not render.
  useEffect(() => {
    if (reducedMotion) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(withTiming(1, { duration: WAVE_PERIOD_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [phase, reducedMotion]);

  // No dependency array: on native Reanimated tracks the closure itself (`width`), and
  // warns that an array is ignored there.
  const d = useDerivedValue(() => {
    const from = WAVE_STROKE / 2;
    return wavePath(from, Math.max(width - WAVE_STROKE / 2, from), phase.value);
  });

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Path path={d} style="stroke" strokeWidth={WAVE_STROKE} strokeCap="round" strokeJoin="round" color={MonoColors.accent} />
    </Canvas>
  );
}

export function ProgressBar({ valueBp, label, overAmount, accessibilityLabel: labelOverride, wavy = false, style, testID }: ProgressBarProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const [fillWidth, setFillWidth] = useState(0);
  const bp = Math.max(0, valueBp);
  const overBp = Math.max(0, bp - 10000);
  const isOver = overBp > 0;
  const drawnOverBp = Math.min(overBp, MAX_DRAWN_OVER_BP);
  const scaleBp = 10000 + drawnOverBp; // the track's full drawn width always represents this many bp
  const fillFraction = Math.min(bp, 10000) / scaleBp;
  const overFraction = drawnOverBp / scaleBp;
  const isWavy = wavy && Platform.OS !== 'web';

  const usedPct = pct(bp);
  const showOverRow = isOver && overAmount != null;
  const overNominalText = showOverRow ? shown(rp(overAmount!, false), hidden) : undefined;
  const accessibilityLabel = labelOverride ?? progressAccessibilityLabel(label, usedPct, showOverRow ? overNominalText : undefined);

  return (
    <View style={style} testID={testID}>
      <View
        style={isWavy ? styles.waveTrack : styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(bp / 100) }}
      >
        {isWavy ? (
          <>
            <View style={styles.waveRail} />
            <View
              style={{ width: `${fillFraction * 100}%` }}
              onLayout={event => setFillWidth(event.nativeEvent.layout.width)}
              testID={testID ? `${testID}-fill` : undefined}
            >
              {fillWidth > 0 && <WaveFill width={fillWidth} />}
            </View>
          </>
        ) : (
          <View style={[styles.fill, { width: `${fillFraction * 100}%` }]} testID={testID ? `${testID}-fill` : undefined} />
        )}
        {overFraction > 0 && (
          <View style={[styles.overflow, isWavy && styles.overflowWavy, { width: `${overFraction * 100}%` }]} testID={testID ? `${testID}-overflow` : undefined}>
            {Platform.OS === 'web' ? (
              // react-native-skia needs an explicit CanvasKit/WASM bootstrap on web
              // (LoadSkiaWeb) that this app — Android-only per CLAUDE.md — never sets
              // up, so <Canvas> throws "CanvasKit is not defined" there. Degrade to a
              // flat fill instead of crashing the screen; native keeps the real stripes.
              <View style={styles.overflowFallback} />
            ) : (
              <Canvas style={StyleSheet.absoluteFill}>{stripes(VIRTUAL_WIDTH, HEIGHT)}</Canvas>
            )}
          </View>
        )}
      </View>
      {showOverRow && (
        <View style={styles.overRow}>
          <Icon name="alert" size={16} color={MonoColors.negative} />
          <Text style={styles.overText}>{overBy(overNominalText!)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    backgroundColor: MonoColors.surface,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // No background or clip: the wave swings a little above and below the rail's centre line.
  waveTrack: { height: WAVE_HEIGHT, flexDirection: 'row' },
  waveRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (WAVE_HEIGHT - WAVE_STROKE) / 2,
    height: WAVE_STROKE,
    borderRadius: WAVE_STROKE / 2,
    backgroundColor: MonoColors.border,
  },
  fill: { backgroundColor: MonoColors.accent },
  overflow: { overflow: 'hidden' },
  // The wavy track has no clip of its own, so the striped segment rounds itself.
  overflowWavy: { borderRadius: HEIGHT / 2 },
  overflowFallback: { ...StyleSheet.absoluteFill, backgroundColor: MonoColors.negative },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  overText: { ...MonoText.bodyS, color: MonoColors.negative },
});
