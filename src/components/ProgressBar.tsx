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
// Canvas sizing is a guessed judgment call: react-native-skia's `onLayout`/`onSize`
// need a real native measurement (unavailable in this phase, and unsupported at all on
// the new architecture per the library's own warning), so the stripe pattern is drawn
// across a generous fixed virtual width and left to the Canvas's own clip — whatever
// the flex layout actually gives it crops the rest automatically, with no measurement
// needed.
import { Canvas, Line } from '@shopify/react-native-skia';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { pct, rp, shown } from '@/core/money';
import { overBy, progressAccessibilityLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const HEIGHT = 8;
const MAX_DRAWN_OVER_BP = 5000;
const STRIPE_GAP = 6; // guessed: dense enough to read as a pattern at 8px tall
const STRIPE_WIDTH = 2; // guessed stroke width
const VIRTUAL_WIDTH = 600; // guessed: wider than any phone screen, so the canvas always clips rather than running out of stripes

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

export function ProgressBar({ valueBp, label, overAmount, accessibilityLabel: labelOverride, style, testID }: ProgressBarProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const bp = Math.max(0, valueBp);
  const overBp = Math.max(0, bp - 10000);
  const isOver = overBp > 0;
  const drawnOverBp = Math.min(overBp, MAX_DRAWN_OVER_BP);
  const scaleBp = 10000 + drawnOverBp; // the track's full drawn width always represents this many bp
  const fillFraction = Math.min(bp, 10000) / scaleBp;
  const overFraction = drawnOverBp / scaleBp;

  const usedPct = pct(bp);
  const showOverRow = isOver && overAmount != null;
  const overNominalText = showOverRow ? shown(rp(overAmount!, false), hidden) : undefined;
  const accessibilityLabel = labelOverride ?? progressAccessibilityLabel(label, usedPct, showOverRow ? overNominalText : undefined);

  return (
    <View style={style} testID={testID}>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(bp / 100) }}
      >
        <View style={[styles.fill, { width: `${fillFraction * 100}%` }]} />
        {overFraction > 0 && (
          <View style={[styles.overflow, { width: `${overFraction * 100}%` }]}>
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
  fill: { backgroundColor: MonoColors.accent },
  overflow: { overflow: 'hidden' },
  overflowFallback: { ...StyleSheet.absoluteFill, backgroundColor: MonoColors.negative },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  overText: { ...MonoText.bodyS, color: MonoColors.negative },
});
