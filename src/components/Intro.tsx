// The pieces of the entrance (src/core/intro): Reveal lifts a block into place, useCountUp counts a number up to its
// value. Both do nothing outside the entrance or when the phone asks for less motion. Whether a piece animates is
// decided when it is first drawn, so nothing is remounted when the entrance ends.
import { useEffect, useState, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Amount, type AmountProps } from '@/components/Amount';
import { useAppReady } from '@/core/appReady';
import { useIntro } from '@/core/intro';

const STEP_MS = 90; // between one block and the next
const RISE_MS = 460;
const RISE = 22; // how far a block comes up
const COUNT_MS = 900;

function useEntering(): boolean {
  const playing = useIntro(s => s.playing);
  const reduced = useReducedMotion();
  const [entering] = useState(() => playing && !reduced);
  return entering;
}

export function Reveal({ order, children }: { order: number; children: ReactNode }) {
  const entering = useEntering();
  const ready = useAppReady(s => s.ready);
  const progress = useSharedValue(entering ? 0 : 1);
  useEffect(() => {
    if (!entering || !ready) return;
    progress.set(withDelay(order * STEP_MS, withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.cubic) })));
  }, [entering, ready, order, progress]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * RISE }] }));
  if (!entering) return <>{children}</>;
  return <Animated.View style={style}>{children}</Animated.View>;
}

// The number to show now: from 0 up to `value`, easing out, then `value` itself.
export function useCountUp(value: number): number {
  const entering = useEntering();
  const ready = useAppReady(s => s.ready);
  const [step, setStep] = useState<{ shown: number; done: boolean }>({ shown: 0, done: !entering });
  useEffect(() => {
    if (!entering || !ready || step.done) return undefined;
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / COUNT_MS);
      if (t >= 1) {
        setStep({ shown: value, done: true });
        return;
      }
      setStep({ shown: Math.round(value * (1 - (1 - t) ** 3)), done: false });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [entering, ready, value, step.done]);
  return step.done ? value : step.shown;
}

// A figure that counts up on entrance. Only this text is redrawn while it counts.
export function CountUpAmount({ value, ...props }: AmountProps) {
  return <Amount value={useCountUp(value)} {...props} />;
}
