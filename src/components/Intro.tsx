// The pieces of the entrances (src/core/intro): Reveal lifts a block of the first screen into place and useCountUp
// counts a number up; a TabEntrance holds its tab's pieces back until the tab is first shown, then Rise lifts a block and
// useDropIn slides a card into the stack, one after another. All do nothing outside an entrance or when the phone asks
// for less motion. Whether a piece animates is decided when it is first drawn, so nothing is remounted afterwards.
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type WithTimingConfig } from 'react-native-reanimated';

import { Amount, type AmountProps } from '@/components/Amount';
import { useAppReady } from '@/core/appReady';
import { markTabEntered, tabHasEntered, useIntro } from '@/core/intro';

// unhurried on purpose (the owner asked)
const STEP_MS = 150; // between one block and the next
const RISE_MS = 700;
const RISE = 26; // how far a block comes up
const COUNT_MS = 1400;
const CARD_STEP_MS = 280; // between one card and the next going into the wallet
const CARD_MS = 800;
const CARD_FROM = 170; // how high above its place a card starts
const WINDOW_MS = 2500; // what first appears later than this after a tab is shown does not animate

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

// ---------------------------------------------------------------- a tab's entrance

interface Entrance {
  entering: boolean; // this tab has not been shown since the app was opened
  go: boolean; // it is on screen now
  open: () => boolean; // pieces first drawn now still take part
}

const EntranceContext = createContext<Entrance | null>(null);

function OnFirstFocus({ onFocus }: { onFocus: () => void }) {
  useFocusEffect(useCallback(() => onFocus(), [onFocus]));
  return null;
}

export function TabEntrance({ id, children }: { id: string; children: ReactNode }) {
  const launched = useIntro(s => s.launched);
  const reduced = useReducedMotion();
  const [entering] = useState(() => launched && !reduced && !tabHasEntered(id));
  const [go, setGo] = useState(false);
  const stillOpen = useRef(true);
  const open = useCallback(() => stillOpen.current, []);
  // the tab may be made ready in the background: the entrance waits until it is looked at
  const start = useCallback(() => {
    markTabEntered(id);
    setGo(true);
    setTimeout(() => {
      stillOpen.current = false;
    }, WINDOW_MS);
  }, [id]);
  return (
    <EntranceContext.Provider value={{ entering, go, open }}>
      {entering && !go && <OnFirstFocus onFocus={start} />}
      {children}
    </EntranceContext.Provider>
  );
}

// 0 to 1 once the tab is shown, `order` steps after it; stays 1 for what does not take part.
function useEntranceProgress(order: number, step: number, duration: number, easing: WithTimingConfig['easing']) {
  const entrance = useContext(EntranceContext);
  const [animate] = useState(() => !!entrance?.entering && entrance.open());
  const go = entrance?.go ?? false;
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate && go) progress.set(withDelay(order * step, withTiming(1, { duration, easing })));
  }, [animate, go, order, step, duration, easing, progress]);
  return { animate, progress };
}

const SOFT = Easing.out(Easing.cubic);
const SETTLE = Easing.bezier(0.22, 0.9, 0.24, 1.06); // slides in and sinks a touch past its place, then rests

export function Rise({ order, children }: { order: number; children: ReactNode }) {
  const { animate, progress } = useEntranceProgress(order, STEP_MS, RISE_MS, SOFT);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * RISE }] }));
  if (!animate) return <>{children}</>;
  return <Animated.View style={style}>{children}</Animated.View>;
}

// The style of a card being put into the wallet: from above, tilted, into its slot. For a view that is already animated.
export function useDropIn(order: number) {
  const { animate, progress } = useEntranceProgress(order, CARD_STEP_MS, CARD_MS, SETTLE);
  return useAnimatedStyle(() => {
    if (!animate) return {};
    const left = 1 - progress.value;
    return { opacity: Math.min(1, progress.value * 2.5), transform: [{ translateY: -CARD_FROM * left }, { scale: 1 + 0.05 * left }, { rotate: `${-4 * left}deg` }] };
  });
}

