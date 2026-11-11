// A centred confirm dialog (Tx-Delete): radius 24, fill #131314, 1px #2A2A2B, over a 66%
// black backdrop. Never `Alert` (CLAUDE.md rule 7). An icon and title, a message made of
// plain and bold parts (the bold ones are the nominals), then Cancel (outlined) and the
// confirming button (solid light).
//
// Focus: when it opens, screen-reader focus moves to the title; the caller moves it back to
// whatever opened the dialog when `onCancel` / `onConfirm` runs (it owns that element). The
// panel is modal for accessibility (`accessibilityViewIsModal`) and a tap on the backdrop
// cancels.
import { useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface DialogPart {
  text: string;
  strong?: boolean;
}

export interface ConfirmDialogProps {
  visible: boolean;
  icon: IconName;
  iconColor?: string;
  title: string;
  message: DialogPart[];
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  testID?: string;
}

export function ConfirmDialog({
  visible,
  icon,
  iconColor = MonoColors.negative,
  title,
  message,
  cancelLabel,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
  testID,
}: ConfirmDialogProps) {
  const titleRef = useRef<ComponentRef<typeof Text>>(null);

  useEffect(() => {
    if (!visible) return;
    const handle = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} testID={testID} accessibilityViewIsModal>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        {/* Tapping outside cancels. Not an accessibility element: the Cancel button is. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessible={false}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.panel} accessibilityRole="alert">
          <View style={styles.titleRow}>
            <Icon name={icon} size={20} color={iconColor} />
            <Text ref={titleRef} style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Text style={styles.message}>
            {message.map((part, i) => (
              <Text key={i} style={part.strong ? styles.strong : undefined}>
                {part.text}
              </Text>
            ))}
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              android_ripple={undefined}
              style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
              testID={testID ? `${testID}-cancel` : undefined}
            >
              <Text style={[MonoText.bodyStrong, { color: MonoColors.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={busy ? undefined : onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ busy }}
              android_ripple={undefined}
              style={({ pressed }) => [styles.button, styles.confirm, pressed && styles.pressed, busy && styles.busy]}
              testID={testID ? `${testID}-confirm` : undefined}
            >
              <Text style={[MonoText.bodyStrong, { color: MonoColors.bg }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.66)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 36 },
  panel: {
    borderRadius: 24,
    backgroundColor: '#131314',
    borderWidth: 1,
    borderColor: '#2A2A2B',
    padding: 20,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  message: { ...MonoText.bodyS, color: MonoColors.textSecond },
  strong: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancel: { backgroundColor: '#151516', borderWidth: 1, borderColor: '#272728' },
  confirm: { backgroundColor: MonoColors.text },
  pressed: { opacity: 0.8 },
  busy: { opacity: 0.6 },
});
