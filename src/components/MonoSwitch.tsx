// DESIGN.md section 5/16: `MonoSwitch` (Pressable, role switch). Track height 28 so its
// radius (height / 2) reproduces section 5's "switch 14" as a pill, rather than hard-
// coding 14 and 28 as two numbers that could drift apart. Strictly monochrome (section 1:
// colour never the only signal) — on/off is carried by track fill, thumb position AND
// accessibilityState together, never colour alone. hitSlop brings the touch target up to
// the 44dp floor (same rule IconButton's comment cites) despite the visually smaller track.
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MonoColors } from '@/theme/tokens';

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 24;
const INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - INSET * 2;
const DURATION = 150;

export interface MonoSwitchProps extends Omit<PressableProps, 'style' | 'children' | 'disabled' | 'onPress'> {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string; // accessibilityLabel — required, there is no visible text to fall back on
  disabled?: boolean;
  testID?: string;
}

export function MonoSwitch({ value, onValueChange, label, disabled = false, testID, ...rest }: MonoSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);
  progress.value = withTiming(value ? 1 : 0, { duration: DURATION });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [MonoColors.surface, MonoColors.text]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: INSET + progress.value * TRAVEL }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [MonoColors.textSecond, MonoColors.bg]),
  }));

  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : () => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={disabled && styles.disabled}
      testID={testID}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: MonoColors.border,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  disabled: { opacity: 0.4 },
});
