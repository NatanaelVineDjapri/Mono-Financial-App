// A balance-over-time line in the style of the Overview's net cash flow chart: a dark panel, a dotted grid, a thick silver
// line with a deep fade beneath it, a haloed point at the end, and a touch scrub with a tooltip. Drawn by hand with
// react-native-svg (no chart library), so the curve, the gradient and the halo look the same on every screen that uses it.
//
// The curve is a Catmull-Rom spline whose control points are clamped between the two points they join, so a steep
// step can never swing past its neighbours (the line never dips below, or rises above, a balance it did not have).
// Presentation only: the values come from the caller (views), the axis from src/core/chartScale.
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path } from 'react-native-svg';

import { AreaGradient, CHART_LINE_WIDTH, DottedGrid } from '@/components/chartParts';

import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const CHART_H = 132; // the plot's own height (the axis' low to high)
const TOP_PAD = 10; // room for the last point's halo above the highest gridline
const X_LABEL_H = 24;
const Y_LABEL_W = 44; // the gutter for the y axis labels
const RIGHT_PAD = 12;
const END_LABEL_RISE = 26; // how far above the last point its label starts
const TOOLTIP_W = 156;
const TOOLTIP_H = 62;
const INNER_H = TOP_PAD + CHART_H + X_LABEL_H;

interface PlotPoint {
  x: number;
  y: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function linePath(points: PlotPoint[]): string {
  if (points.length === 0) return '';
  let d = `M ${round2(points[0].x)} ${round2(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];
    const low = Math.min(p1.y, p2.y);
    const high = Math.max(p1.y, p2.y);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, low, high);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, low, high);
    d += ` C ${round2(c1x)} ${round2(c1y)} ${round2(c2x)} ${round2(c2y)} ${round2(p2.x)} ${round2(p2.y)}`;
  }
  return d;
}

// The line, then down to the axis' floor and back, so the gradient fills the area beneath it.
function areaPath(points: PlotPoint[], baseline: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${round2(last.x)} ${round2(baseline)} L ${round2(first.x)} ${round2(baseline)} Z`;
}

export interface LineAreaChartProps {
  values: number[]; // one balance per point, oldest first
  axis: { low: number; high: number; ticks: number[] }; // the y axis (src/core/chartScale niceRange)
  yLabel: (tick: number) => string;
  xLabelIndexes: number[]; // which points carry a label under the axis
  xLabel: (index: number) => string;
  hideYLabels?: boolean; // Hide amounts: the amounts on the axis go, the line stays
  renderTooltip: (index: number) => ReactNode; // what the box says for the point under the finger
  accessibilityLabel: string;
  testID?: string;
  // Sits inside the same panel, under the plot (the range pill of the account detail), so the chart and its controls are one card.
  footer?: ReactNode;
  // The plot is shown at half strength while newer data is on its way (the footer's buttons stay as they are).
  dimmed?: boolean;
  // A dashed horizontal line at this value (the goal on net worth history). The caller's axis must include it.
  referenceValue?: number;
  // A short figure written beside the last point. The caller masks it when amounts are hidden.
  endLabel?: string;
  // The tighter panel of the Overview's net cash flow chart, for a chart that sits inside a card.
  compact?: boolean;
  // Wider than usual when the y labels are long ("100 jt"), so they stay on one line.
  yGutter?: number;
}

export function LineAreaChart({ values, axis, yLabel, xLabelIndexes, xLabel, hideYLabels = false, renderTooltip, accessibilityLabel, testID, footer, dimmed = false, referenceValue, endLabel, compact = false, yGutter = Y_LABEL_W }: LineAreaChartProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const count = values.length;
  const plotLeft = hideYLabels ? 6 : yGutter;
  const plotRight = Math.max(plotLeft + 40, width - RIGHT_PAD);
  const plotW = plotRight - plotLeft;
  const stepX = count > 1 ? plotW / (count - 1) : 0;
  const xAt = (index: number) => (count > 1 ? plotLeft + index * stepX : plotLeft + plotW / 2);
  const span = axis.high - axis.low || 1;
  const yAt = (value: number) => TOP_PAD + ((axis.high - value) / span) * CHART_H;
  const points = values.map((value, index) => ({ x: xAt(index), y: yAt(value) }));
  const last = points[points.length - 1];
  const line = linePath(points);
  const area = areaPath(points, TOP_PAD + CHART_H);

  const pick = (locationX: number) => {
    if (count === 0 || stepX === 0) return;
    setActive(clamp(Math.round((locationX - plotLeft) / stepX), 0, count - 1));
  };

  return (
    <View style={[styles.panel, compact && styles.panelCompact]} testID={testID}>
      <View
        style={[styles.body, dimmed && styles.dimmed]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLayout={e => setWidth(Math.round(e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        testID={testID ? `${testID}-plot` : undefined}
      >
        {width > 0 && (
          <>
            <Svg width={width} height={INNER_H} style={StyleSheet.absoluteFill}>
              <Defs>
                <AreaGradient id="lineAreaFill" />
              </Defs>
              <DottedGrid xs={xLabelIndexes.map(xAt)} ys={axis.ticks.map(yAt)} left={plotLeft} right={plotRight} top={TOP_PAD} bottom={TOP_PAD + CHART_H} />
              <Path d={area} fill="url(#lineAreaFill)" />
              {referenceValue != null && (
                <Line x1={plotLeft} x2={plotRight} y1={yAt(referenceValue)} y2={yAt(referenceValue)} stroke={MonoColors.textSecond} strokeWidth={1.5} strokeDasharray={[6, 5]} />
              )}
              <Path d={line} fill="none" stroke={MonoColors.accent} strokeWidth={CHART_LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
              {last && <Circle cx={last.x} cy={last.y} r={9} fill={MonoColors.accent} fillOpacity={0.16} />}
              {last && <Circle cx={last.x} cy={last.y} r={4} fill={MonoColors.accent} />}
              {active !== null && points[active] && (
                <>
                  <Line x1={points[active].x} x2={points[active].x} y1={TOP_PAD} y2={TOP_PAD + CHART_H} stroke={MonoColors.textMeta} strokeWidth={1} strokeDasharray={[4, 4]} />
                  <Circle cx={points[active].x} cy={points[active].y} r={4.5} fill={MonoColors.accent} />
                </>
              )}
            </Svg>

            {!hideYLabels &&
              axis.ticks.map(tick => (
                <Text key={`y-${tick}`} style={[styles.yLabel, { top: yAt(tick) - 8, width: yGutter - 8 }]} accessibilityElementsHidden importantForAccessibility="no">
                  {yLabel(tick)}
                </Text>
              ))}

            {xLabelIndexes.map(index => (
              <Text
                key={`x-${index}`}
                style={[styles.xLabel, { left: clamp(xAt(index) - 30, 0, Math.max(0, width - 60)), top: TOP_PAD + CHART_H + 8 }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {xLabel(index)}
              </Text>
            ))}

            {endLabel != null && last && (
              // Above the point, or under it when the point is too near the top.
              <Text
                style={[styles.endLabel, { right: Math.max(0, width - last.x - 4), top: last.y >= END_LABEL_RISE ? last.y - END_LABEL_RISE : last.y + 10 }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {endLabel}
              </Text>
            )}

            {active !== null && points[active] && (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  {
                    left: clamp(points[active].x - TOOLTIP_W / 2, 0, Math.max(0, width - TOOLTIP_W)),
                    top: clamp(points[active].y - TOOLTIP_H - 10, 0, Math.max(0, INNER_H - TOOLTIP_H)),
                  },
                ]}
                testID={testID ? `${testID}-tooltip` : undefined}
              >
                {renderTooltip(active)}
              </View>
            )}
          </>
        )}
      </View>
      {footer != null && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Room between the card's edge and everything in it: the axis labels, the plot and the range pill.
  panel: { backgroundColor: MonoColors.surface, borderRadius: radius.lg, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  panelCompact: { borderRadius: radius.md, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  body: { height: INNER_H },
  footer: { marginTop: 16 },
  dimmed: { opacity: 0.5 },
  yLabel: { ...MonoText.caption, position: 'absolute', left: 0, color: MonoColors.textMeta },
  xLabel: { ...MonoText.caption, position: 'absolute', width: 60, textAlign: 'center', color: MonoColors.textMeta },
  endLabel: { ...MonoText.caption, position: 'absolute', fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_W,
    backgroundColor: MonoColors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MonoColors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 3,
  },
});
