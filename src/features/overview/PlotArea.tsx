// The frame both Overview charts share: horizontal gridlines with the y-axis labels in a
// left gutter, a stronger baseline at 0 (the x axis), and a footer row for the x labels
// that lines up with the plot. The bars / line are the `children`, drawn over the plot
// with `yOf` to place a value. Axis labels are amounts, so hidden mode masks them.
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { axisLabel } from '@/core/chartScale';
import { shownCompact } from '@/core/money';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const PAD_TOP = 10; // room above the top gridline for its label and a value callout
const LABEL_HEIGHT = 16;
const BASELINE = '#3A3A3A';
const CHAR_WIDTH = 7; // a generous caption-size digit advance

export interface PlotAreaProps {
  height: number; // the plot itself, excluding the footer
  ticks: number[]; // ascending, ticks[0] is 0 (the baseline)
  hidden: boolean;
  children: (plotWidth: number, yOf: (value: number) => number) => ReactNode;
  footer?: (plotWidth: number) => ReactNode;
}

export function PlotArea({ height, ticks, hidden, children, footer }: PlotAreaProps) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(300);
  const top = ticks[ticks.length - 1];
  const labels = ticks.map(t => axisLabel(t, top));
  const longest = Math.max(...labels.map(l => l.length));
  const gutter = Math.ceil(longest * CHAR_WIDTH * Math.max(1, fontScale)) + 10;
  const plotWidth = Math.max(60, width - gutter);
  const yOf = (value: number) => PAD_TOP + (1 - value / top) * (height - PAD_TOP);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height }}>
        {ticks.map(t => (
          <View key={`line-${t}`} style={[styles.line, { left: gutter, top: yOf(t) }, t === 0 && styles.baseline]} />
        ))}
        {ticks.map((t, i) => (
          <Text
            key={`label-${t}`}
            style={[styles.label, { width: gutter - 6, top: yOf(t) - LABEL_HEIGHT / 2 }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {shownCompact(labels[i], hidden)}
          </Text>
        ))}
        <View style={[styles.plot, { left: gutter }]}>{children(plotWidth, yOf)}</View>
      </View>
      {footer && <View style={{ marginLeft: gutter }}>{footer(plotWidth)}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', right: 0, height: 1, backgroundColor: MonoColors.border },
  baseline: { backgroundColor: BASELINE },
  label: { ...MonoText.caption, position: 'absolute', left: 0, height: LABEL_HEIGHT, textAlign: 'right', color: MonoColors.textMeta },
  plot: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});
