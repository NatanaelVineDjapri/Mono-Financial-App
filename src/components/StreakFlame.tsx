// The streak's flame (the owner's call): red for a plain streak, then a new colour and shape at 10, 30, 60 and 100
// days, each bigger than the last, ending purple. Colours of its own, an exception to rule 5, like the badge art.
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { streakTier } from '@/domain/achievements';

interface FlameStyle {
  color: string; // top of the flame, and the number beside it
  shade: string; // bottom
  inner: string;
  outline: string;
  core: string;
}

const FLAMES: readonly FlameStyle[] = [
  {
    color: '#EF4444', shade: '#B91C1C', inner: '#FCA5A5',
    outline: 'M32 6 C35 18 50 24 50 41 C50 52 42 60 32 60 C22 60 14 52 14 41 C14 32 21 28 23 21 C27 24 29 28 29 32 C34 26 34 16 32 6 Z',
    core: 'M32 36 C35 41 41 44 41 50 C41 55 37 58 32 58 C27 58 23 55 23 50 C23 46 27 43 28 40 C29 42 30 44 31 45 C33 43 33 39 32 36 Z',
  },
  {
    color: '#F97316', shade: '#C2410C', inner: '#FDBA74',
    outline: 'M29 3 C33 13 46 18 44 28 C48 26 50 22 49 17 C55 25 57 33 56 42 C54 54 44 61 32 61 C19 61 9 53 9 41 C9 31 16 25 17 15 C23 19 25 24 25 29 C31 23 32 13 29 3 Z',
    core: 'M31 33 C35 39 43 42 43 50 C43 56 38 59 32 59 C26 59 21 56 21 50 C21 45 25 42 27 38 C28 41 29 43 31 44 C33 41 33 37 31 33 Z',
  },
  {
    color: '#EC4899', shade: '#BE185D', inner: '#F9A8D4',
    outline: 'M32 2 C37 12 45 17 43 27 C48 25 50 20 49 14 C58 23 61 33 59 43 C56 55 45 62 32 62 C19 62 8 55 5 43 C3 33 7 24 14 17 C14 23 16 28 21 30 C18 20 26 14 28 7 C30 11 31 16 30 20 C34 15 34 8 32 2 Z',
    core: 'M32 30 C34 37 45 41 45 49 C45 56 39 60 32 60 C25 60 19 56 19 49 C19 44 23 40 25 36 C26 40 28 42 30 43 C33 40 34 35 32 30 Z',
  },
  {
    color: '#A855F7', shade: '#7E22CE', inner: '#E9D5FF',
    outline: 'M32 1 C38 9 47 15 45 26 C51 24 53 18 52 11 C60 19 64 31 62 42 C60 55 47 63 32 63 C17 63 4 55 2 42 C0 31 4 19 12 11 C11 18 13 24 19 26 C17 15 26 9 32 1 Z',
    core: 'M32 24 C34 33 47 38 47 49 C47 56 40 61 32 61 C24 61 17 56 17 49 C17 43 21 39 22 33 C25 37 27 39 29 40 C33 36 34 30 32 24 Z',
  },
  {
    color: '#8B5CF6', shade: '#4C1D95', inner: '#DDD6FE',
    outline: 'M32 0 C36 8 42 10 41 19 C45 17 47 13 46 8 C51 12 54 18 53 25 C57 23 60 19 60 14 C64 24 64 33 62 43 C59 56 47 64 32 64 C17 64 5 56 2 43 C0 33 0 24 4 14 C4 19 7 23 11 25 C10 18 13 12 18 8 C17 13 19 17 23 19 C22 10 28 8 32 0 Z',
    // a star in the heart of the last one
    core: 'M32 22 L36 34 L48 34 L39 43 L43 56 L32 48 L21 56 L25 43 L16 34 L28 34 Z',
  },
];

const SPARKS = ['M6 2 L7.5 6.5 L12 8 L7.5 9.5 L6 14 L4.5 9.5 L0 8 L4.5 6.5 Z', 'M58 0 L59.2 3.8 L63 5 L59.2 6.2 L58 10 L56.8 6.2 L53 5 L56.8 3.8 Z'];

// The colour of the flame for a streak of `days`.
export const flameColor = (days: number): string => FLAMES[streakTier(days)].color;

// A flame of `base` size for the first tier, a sixth bigger each tier after it.
export const flameSize = (days: number, base: number): number => Math.round(base * (1 + streakTier(days) / 6));

export function StreakFlame({ days, size, dim = false, testID }: { days: number; size: number; dim?: boolean; testID?: string }) {
  const tier = streakTier(days);
  const flame = FLAMES[tier];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" opacity={dim ? 0.4 : 1} testID={testID ?? `flame-tier-${tier}`}>
      <Defs>
        <LinearGradient id={`flame-${tier}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={flame.color} />
          <Stop offset="1" stopColor={flame.shade} />
        </LinearGradient>
      </Defs>
      <Path d={flame.outline} fill={`url(#flame-${tier})`} />
      <Path d={flame.core} fill={flame.inner} />
      {tier === FLAMES.length - 1 && SPARKS.map(d => <Path key={d} d={d} fill={flame.inner} />)}
    </Svg>
  );
}
