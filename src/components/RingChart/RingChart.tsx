// Transactions tab, Fase 4.3c: the statistics area's ring chart. Size 220, stroke 16,
// round caps, starts at 12 o'clock and runs clockwise — a dark (`raised`) full track
// behind, then one coloured arc per segment. With a limit, each arc's length is its own
// share of the limit (over limit: falls back to a full-360 share split, same as no
// limit, plus a thin `negative` ring outside marking it over — never only colour: the
// centre text and the category list beneath both say "over" in words too). Without a
// limit, the full circle is always divided by share. A selected segment's siblings dim
// to 0.35 (CLAUDE.md rule 5: colour is never the only signal — the category list's own
// selected-row mark is the real indicator; this is just the matching visual).
//
// No react-native-skia onLayout (unsupported on the new architecture per the library's
// own warning, confirmed already in ProgressBar.tsx) — the canvas is a fixed 220x220,
// so hit-testing uses the wrapping Pressable's own locationX/Y instead of a Skia
// measurement, and needs no measurement step at all.
import { Canvas, Path } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const RING_SIZE = 220;
const STROKE_WIDTH = 16;
const GAP_PX = 5;
const MIN_SWEEP_DEG = 1.5; // keeps a very small share visibly drawn instead of a degenerate sliver
const START_DEG = -90; // Skia's own 0deg = 3 o'clock; this is 12 o'clock
const FILL_DURATION_MS = 400;
const HIT_PADDING = 12; // generous extra px of hit band around the stroke itself
const OVER_RING_GAP = 4;
const OVER_RING_WIDTH = 3;

export interface RingSegment {
  id: number;
  label: string;
  valueIdr: number;
  color: string;
}

export interface RingChartProps {
  segments: RingSegment[];
  limitIdr?: number;
  centerLabel: string;
  centerValue: string; // pre-formatted (rp() then shown()) — this component formats no money
  centerSub?: string;
  selectedId?: number;
  onSegmentPress?: (id: number) => void;
  accessibilityLabel: string;
  // The Transactions ring is 220 / stroke 16; the Overview's "Top categories" is 140 / 16.
  size?: number;
  strokeWidth?: number;
  // Fixed font size for the centre figure (the compact ring has no room for the adaptive
  // 15-36 scale, whose largest steps would not fit inside a 140 ring).
  centerValueSize?: number;
  testID?: string;
}

function useFillProgress(durationMs: number, reducedMotion: boolean): number {
  // The initial state already accounts for reduce-motion, so the effect below only
  // ever needs to *schedule* frames (even the first one), never set state synchronously
  // in its own body (react-hooks/set-state-in-effect).
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let cancelled = false;
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const t = Math.min(1, (Date.now() - start) / durationMs);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [durationMs, reducedMotion]);
  return progress;
}

export interface Arc {
  id: number;
  color: string;
  startDeg: number; // the segment's own un-trimmed start, 0 = 12 o'clock, clockwise
  sweepDeg: number; // un-trimmed
}

export function layoutArcs(segments: RingSegment[], limitIdr: number | undefined): { arcs: Arc[]; isOverLimit: boolean } {
  const total = segments.reduce((sum, s) => sum + s.valueIdr, 0);
  const useLimit = limitIdr != null && limitIdr > 0 && total <= limitIdr;
  const isOverLimit = limitIdr != null && limitIdr > 0 && total > limitIdr;
  const denominator = useLimit ? limitIdr : total;

  let cursor = 0;
  const arcs: Arc[] = [];
  for (const segment of segments) {
    const sweepDeg = denominator > 0 ? (segment.valueIdr / denominator) * 360 : 0;
    arcs.push({ id: segment.id, color: segment.color, startDeg: cursor, sweepDeg });
    cursor += sweepDeg;
  }
  return { arcs, isOverLimit };
}

// An SVG arc path string — react-native-skia's <Path> accepts `path` as a plain string
// (PathDef = string | SkPath) just as readily as a built SkPath object, which sidesteps
// needing the imperative Skia.PathBuilder API (unavailable outside a real native/JSI
// runtime — including in Jest, where only the <Canvas>/<Path> *components* are mocked).
// startDeg/sweepDeg use this file's own 12-o'clock-relative, clockwise convention.
function arcPathD(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [startX, startY] = toXY(startDeg);
  const [endX, endY] = toXY(startDeg + sweepDeg);
  const largeArcFlag = sweepDeg > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

export function hitTestSegment(arcs: Arc[], locationX: number, locationY: number, size = RING_SIZE, strokeWidth = STROKE_WIDTH): number | undefined {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const dx = locationX - center;
  const dy = locationY - center;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const inner = radius - strokeWidth / 2 - HIT_PADDING;
  const outer = radius + strokeWidth / 2 + HIT_PADDING;
  if (distance < inner || distance > outer) return undefined;

  const rawDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rel = ((rawDeg - START_DEG + 360) % 360);
  for (const arc of arcs) {
    if (arc.sweepDeg <= 0) continue;
    if (rel >= arc.startDeg && rel < arc.startDeg + arc.sweepDeg) return arc.id;
  }
  return undefined;
}

export function RingChart({
  segments,
  limitIdr,
  centerLabel,
  centerValue,
  centerSub,
  selectedId,
  onSegmentPress,
  accessibilityLabel,
  size = RING_SIZE,
  strokeWidth = STROKE_WIDTH,
  centerValueSize,
  testID,
}: RingChartProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const gapDeg = (GAP_PX / (2 * Math.PI * radius)) * 360;
  const reducedMotion = useReducedMotion();
  const progress = useFillProgress(FILL_DURATION_MS, reducedMotion);
  const { arcs, isOverLimit } = layoutArcs(segments, limitIdr);

  const trackPath = arcPathD(center, center, radius, 0, 359.9);

  const overRadius = radius + strokeWidth / 2 + OVER_RING_GAP + OVER_RING_WIDTH / 2;
  const overPath = arcPathD(center, center, overRadius, 0, 359.9);

  const segmentPaths = arcs.map(arc => {
    const trimmedSweep = Math.max(0, arc.sweepDeg - gapDeg);
    const drawnSweep = arc.sweepDeg > 0 ? Math.max(MIN_SWEEP_DEG, trimmedSweep) * progress : 0;
    const path = drawnSweep > 0 ? arcPathD(center, center, radius, arc.startDeg + gapDeg / 2, drawnSweep) : null;
    return { ...arc, path };
  });

  const canvasBody =
    Platform.OS === 'web' ? (
      // react-native-skia needs an explicit CanvasKit/WASM bootstrap on web (LoadSkiaWeb)
      // this Android-only app never sets up — same fallback reasoning as ProgressBar.tsx.
      <View style={[styles.webFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: MonoColors.raised }]} />
    ) : (
      <Canvas style={{ width: size, height: size }}>
        <Path path={trackPath} color={MonoColors.raised} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
        {segmentPaths.map(
          segment =>
            segment.path && (
              <Path
                key={segment.id}
                path={segment.path}
                color={segment.color}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
                opacity={selectedId != null && selectedId !== segment.id ? 0.35 : 1}
              />
            ),
        )}
        {isOverLimit && <Path path={overPath} color={MonoColors.negative} style="stroke" strokeWidth={OVER_RING_WIDTH} strokeCap="round" />}
      </Canvas>
    );

  return (
    <Pressable
      testID={testID}
      style={[styles.wrap, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onPress={
        onSegmentPress &&
        (event => {
          const { locationX, locationY } = event.nativeEvent;
          const hit = hitTestSegment(arcs, locationX, locationY, size, strokeWidth);
          if (hit != null) onSegmentPress(hit);
        })
      }
    >
      {canvasBody}
      <View style={styles.centerWrap} pointerEvents="none">
        <CenterText label={centerLabel} value={centerValue} sub={centerSub} valueSize={centerValueSize} compact={size < RING_SIZE} />
      </View>
    </Pressable>
  );
}

// Split out since this exact stack — small label, big figure, small sub-line — is only
// used here. The big figure's font size adapts to the string length so longer numbers
// (e.g. 100+ million) scale down instead of overflowing the 220px-wide ring.
function CenterText({ label, value, sub, valueSize, compact }: { label: string; value: string; sub?: string; valueSize?: number; compact: boolean }) {
  // Responsive font sizing: scale down aggressively when digits increase.
  // Thresholds based on typical IDR formatting with dots (Rp8.700.000 = 11 chars).
  const getFontSize = (text: string): number => {
    const len = text.length;
    if (len <= 8) return 36;  // ratusan ribu (Rp999.999 or less)
    if (len <= 10) return 28; // jutaan bawah (Rp1.000.000 - Rp9.999.999)
    if (len <= 12) return 24; // jutaan atas (Rp10.000.000 - Rp99.999.999) ← Rp8.700.000 masuk sini
    if (len <= 14) return 20; // ratusan juta (Rp100.000.000 - Rp999.999.999)
    if (len <= 16) return 18; // miliaran (Rp1.000.000.000 - Rp9.999.999.999)
    return 15; // 10 miliar+
  };

  const fontSize = valueSize ?? getFontSize(value);

  return (
    <>
      <Text style={[MonoText.caption, { color: MonoColors.textMeta, textTransform: 'uppercase' }]} numberOfLines={compact ? 1 : undefined}>{label}</Text>
      <Text style={[MonoText.figureL, { color: MonoColors.text, fontSize }]}>{value}</Text>
      {!!sub && <Text style={[MonoText.bodyS, { color: MonoColors.textSecond }]}>{sub}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  webFallback: {},
  centerWrap: { position: 'absolute', alignItems: 'center', gap: 2, paddingHorizontal: 24 },
});
