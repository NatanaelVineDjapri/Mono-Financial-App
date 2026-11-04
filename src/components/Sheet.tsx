// DESIGN.md section 5/16: a transparentModal route's content, not the route itself —
// the route (configured where a screen uses this, later phases) gives native back-
// gesture/back-button dismissal via the navigator; this component is only the scrim and
// the sliding panel. Radius 16 (section 5 "sheet top 16"), background `raised` (tokens.ts:
// "pressed, selected tiles, sheets"). Scrim 64% per the component map line that names this
// component (section 5's general rule says 62% — a doc inconsistency, flagged here).
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { MonoColors, radius } from '@/theme/tokens';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // accessibilityLabel for the scrim's dismiss tap — no good generic default, same
  // reasoning as IconButton's required `label`.
  closeLabel: string;
  testID?: string;
}

const SCRIM_OPACITY = 0.64;

export function Sheet({ visible, onClose, children, closeLabel, testID }: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const insets = useSafeAreaInsets();

  // Re-opening after a full close (mounted had reached false) needs to flip `mounted`
  // back on. Derived during render, not an effect, per React's "adjusting state when a
  // prop changes" recipe — avoids an extra cascading render.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} testID={testID} pointerEvents={visible ? 'auto' : 'none'}>
      {visible && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
          <Pressable
            testID={testID ? `${testID}-scrim` : undefined}
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
      )}
      {visible && (
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown.withCallback(finished => {
            'worklet';
            if (finished) scheduleOnRN(setMounted, false);
          })}
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}
          accessibilityViewIsModal
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: `rgba(0, 0, 0, ${SCRIM_OPACITY})` },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: MonoColors.raised,
    padding: 16,
  },
});
