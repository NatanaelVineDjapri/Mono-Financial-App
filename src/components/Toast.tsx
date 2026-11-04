// DESIGN.md section 8/14/16: snackbar, polite live region, optional Undo. Confirmation
// toasts state the result in numbers (caller composes that string, e.g. with `rp()`) —
// this component only owns presentation, timing and the live region. No snackbar-
// specific radius/colour is given in section 5, so it reuses `raised` (the highest
// surface step already defined) and radius.md, rather than inventing a 13th token.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const DEFAULT_DURATION = 4000;

export interface ToastProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number; // ms before auto-dismiss
  style?: ViewStyle;
  testID?: string;
}

export function Toast({ visible, message, actionLabel, onAction, onDismiss, duration = DEFAULT_DURATION, style, testID }: ToastProps) {
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const insets = useSafeAreaInsets();

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!mounted) return null;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }, style]} testID={testID} pointerEvents="box-none">
      {visible && (
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown.withCallback(finished => {
            'worklet';
            if (finished) scheduleOnRN(setMounted, false);
          })}
          style={styles.toast}
        >
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
          {!!actionLabel && (
            <Pressable
              onPress={() => {
                onAction?.();
                onDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              hitSlop={8}
            >
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 16, right: 16 },
  toast: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: MonoColors.raised,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  message: { flex: 1, ...MonoText.body, color: MonoColors.text },
  action: { ...MonoText.bodyStrong, color: MonoColors.text },
});
