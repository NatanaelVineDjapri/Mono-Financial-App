// What opens when the centre "+" is tapped (DESIGN.md "Bottom navigation"): three round
// buttons on an arc that curves around the + (concentric with it), one for each way to add a
// transaction: Scan a receipt (left), AI chat (top) and Manual (right). A dim scrim sits behind
// them, over the screen but under the tab bar, so the + (now turned into a ×) stays in view and
// a tap anywhere else closes the menu.
//
// Motion: the + turns into a × (TabFab, 180 ms) and, a beat behind it, the bubbles come out of
// it one by one from left to right: each starts hidden behind the + and travels along the
// arc's radius to its place, growing and fading in. Closing plays it backwards, right to
// left, back into the +. Under reduce-motion everything just appears and disappears.
//
// Charcoal and gold: the bubbles are quiet (card fill, 1px border, light icon); the gold is
// only the + itself. They carry no visible text: each icon is the choice, and every bubble
// has its own accessibility label, so screen-reader users still hear "Scan a receipt", "Add
// with AI chat" and "Add manually". The host must be as tall as the screen (a child cannot be
// touched outside its parent's bounds on Android); TabBar's host is.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';

export const MENU_BUBBLE = 56;

export interface TabFabMenuItem {
  key: 'scan' | 'ai' | 'manual';
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
}

export interface TabFabMenuProps {
  open: boolean;
  items: TabFabMenuItem[]; // left, middle, right
  // Distance from the bottom of the screen to the centre of the + button.
  centerFromBottom: number;
  onClose: () => void;
  closeLabel: string;
  testID?: string;
}

// The arc: a circle of this radius around the + centre, the bubbles at these angles from
// the horizontal (180° = straight left, 90° = straight up, 0° = straight right). Radius 92
// keeps every bubble clear of the + and its ring; 50° between neighbours keeps them 20+ apart.
export const ARC_RADIUS = 92;
export const ARC_ANGLES_DEG = [140, 90, 40];

export function arcOffset(angleDeg: number, radius = ARC_RADIUS): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

// Timing (ms). The first bubble waits for the + to be well into its turn; each next one follows
// a step later, so they come out left to right. Closing starts at the right and has no wait.
export const OPEN_WAIT_MS = 60;
export const STAGGER_MS = 70;
export const BUBBLE_MS = 240;
const SCRIM_MS = 200;

export function bubbleDelayMs(index: number, count: number, opening: boolean): number {
  return opening ? OPEN_WAIT_MS + index * STAGGER_MS : (count - 1 - index) * STAGGER_MS;
}

const EASE = Easing.out(Easing.back(1.15));

interface BubbleProps {
  item: TabFabMenuItem;
  index: number;
  count: number;
  open: boolean;
  reducedMotion: boolean;
  centerFromBottom: number;
  onClosed: () => void;
  testID?: string;
}

function MenuBubble({ item, index, count, open, reducedMotion, centerFromBottom, onClosed, testID }: BubbleProps) {
  const { x, y } = arcOffset(ARC_ANGLES_DEG[index] ?? 90);
  // 0 = tucked behind the +, 1 = in place on the arc.
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = open ? 1 : 0;
    // The last bubble to leave (index 0, right to left) tells the menu it can unmount.
    const lastToLeave = !open && index === 0;
    if (reducedMotion) {
      progress.set(target);
      if (lastToLeave) onClosed();
      return;
    }
    progress.set(
      withDelay(
        bubbleDelayMs(index, count, open),
        withTiming(target, { duration: BUBBLE_MS, easing: EASE }, finished => {
          'worklet';
          if (finished && lastToLeave) scheduleOnRN(onClosed);
        }),
      ),
    );
  }, [open, index, count, reducedMotion, progress, onClosed]);

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: x * progress.value },
      { translateY: -y * progress.value },
      { scale: 0.4 + 0.6 * progress.value },
    ],
  }));

  return (
    <Animated.View
      style={[styles.slot, { bottom: centerFromBottom - MENU_BUBBLE / 2 }, animated]}
      pointerEvents={open ? 'box-none' : 'none'}
    >
      <Pressable
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={item.accessibilityLabel}
        android_ripple={undefined}
        style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
        testID={testID}
      >
        <Icon name={item.icon} size={24} color={MonoColors.text} />
      </Pressable>
    </Animated.View>
  );
}

export function TabFabMenu({ open, items, centerFromBottom, onClose, closeLabel, testID }: TabFabMenuProps) {
  const reducedMotion = useReducedMotion();
  // Stays mounted while the bubbles are on their way back into the +.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const finishClosing = useCallback(() => setMounted(false), []);

  const scrim = useSharedValue(0);
  useEffect(() => {
    const target = open ? 1 : 0;
    scrim.set(reducedMotion ? target : withTiming(target, { duration: SCRIM_MS }));
  }, [open, reducedMotion, scrim]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'box-none' : 'none'} testID={testID}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID={testID ? `${testID}-scrim` : undefined}
        />
      </Animated.View>

      {items.map((item, i) => (
        <MenuBubble
          key={item.key}
          item={item}
          index={i}
          count={items.length}
          open={open}
          reducedMotion={reducedMotion}
          centerFromBottom={centerFromBottom}
          onClosed={finishClosing}
          testID={testID ? `${testID}-${item.key}` : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  // Full width and centred on the screen's vertical axis, level with the + centre: the bubble
  // starts exactly behind the +, and the transform carries it out along the arc.
  slot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bubble: {
    width: MENU_BUBBLE,
    height: MENU_BUBBLE,
    borderRadius: MENU_BUBBLE / 2,
    backgroundColor: MonoColors.card,
    borderWidth: 1,
    borderColor: MonoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 20px rgba(0,0,0,0.5)',
  },
  pressed: { backgroundColor: MonoColors.raised },
});
