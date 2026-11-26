// The drawing the two line charts share (the account balance chart and the Overview's net cash flow): a dotted grid in
// both directions, a solid floor, and a deep fade under the line. Pieces of one <Svg>; the caller places them.
import { LinearGradient, Line, Stop } from 'react-native-svg';

import { MonoColors } from '@/theme/tokens';

export const CHART_LINE_WIDTH = 3.5;
// A dash of almost no length with round caps draws a round dot.
const DOTS = [0.1, 8];

// The fade under a line: strong right below it, gone at the floor. Goes inside <Defs>.
export function AreaGradient({ id }: { id: string }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={MonoColors.accent} stopOpacity={0.44} />
      <Stop offset="0.6" stopColor={MonoColors.accent} stopOpacity={0.16} />
      <Stop offset="1" stopColor={MonoColors.accent} stopOpacity={0.02} />
    </LinearGradient>
  );
}

export function DottedGrid({ xs, ys, left, right, top, bottom }: { xs: number[]; ys: number[]; left: number; right: number; top: number; bottom: number }) {
  return (
    <>
      {ys.map(y => (
        <Line key={`grid-y-${y}`} x1={left} x2={right} y1={y} y2={y} stroke={MonoColors.textDisabled} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" strokeDasharray={DOTS} />
      ))}
      {xs.map(x => (
        <Line key={`grid-x-${x}`} x1={x} x2={x} y1={top} y2={bottom} stroke={MonoColors.textDisabled} strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" strokeDasharray={DOTS} />
      ))}
      <Line x1={left} x2={right} y1={bottom} y2={bottom} stroke={MonoColors.accent} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}
