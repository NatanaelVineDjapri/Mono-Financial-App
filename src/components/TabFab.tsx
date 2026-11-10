// The centre "+" of the floating tab bar (DESIGN.md "Bottom navigation"): a 64 gold circle
// raised 32 above the bar, with a 7 outer ring in the screen colour that visually cuts it
// out of the bar. It opens the AI chat — it is the only FAB-like control in the app.
//
// Gold is used inline here (and in TabBar) until a theme token exists. The ring is a
// zero-blur box-shadow spread, so it paints outside the 64 box without taking any layout
// space or touch area. No gradient anywhere on the control.
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';

export const TAB_FAB_SIZE = 64;
// How far the circle's top edge sits above the bar's top edge.
export const TAB_FAB_RAISE = 32;
export const TAB_FAB_RING = 7;

const FILL = '#E3C27A';
const ICON_COLOR = '#0A0A0A';
const PRESSED_SCALE = 0.96;
const PRESS_MS = 90;

export interface TabFabProps {
  label: string;
  onPress: () => void;
  testID?: string;
}

export function TabFab({ label, onPress, testID }: TabFabProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const setPressed = (pressed: boolean) => {
    const target = pressed ? PRESSED_SCALE : 1;
    // Reduce-motion: jump straight to the end value, no tween.
    scale.set(reducedMotion ? target : withTiming(target, { duration: PRESS_MS }));
  };

  return (
    <Animated.View style={[styles.circle, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={undefined}
        style={styles.press}
        testID={testID}
      >
        <Icon name="plus" size={28} strokeWidth={2} color={ICON_COLOR} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: TAB_FAB_SIZE,
    height: TAB_FAB_SIZE,
    borderRadius: TAB_FAB_SIZE / 2,
    backgroundColor: FILL,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: TAB_FAB_RING, color: MonoColors.bg },
      { offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(227,194,122,0.28)' },
    ],
  },
  press: {
    width: TAB_FAB_SIZE,
    height: TAB_FAB_SIZE,
    borderRadius: TAB_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
