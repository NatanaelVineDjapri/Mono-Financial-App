// The header every bottom sheet shares (Filters on Transactions, the month list on
// Budgets): a drag handle that closes the sheet on a swipe down, then a row with the
// sheet's icon, its title over a one-line subtitle, an optional action, and a close
// button, with a hairline under it. One component so the two sheets cannot drift apart.
// The close button is a rounded square (the HeaderButton box, smaller), never a circle.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, PanResponder, Pressable, StyleSheet, Text, View, findNodeHandle, type TextInstance } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { closeLabel } from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const SWIPE_DISMISS_DISTANCE = 56;
const SWIPE_DISMISS_VELOCITY = 0.8;

export interface SheetHeaderProps {
  visible: boolean;
  icon: IconName;
  title: string;
  subtitle: string;
  onClose: () => void;
  // Sits between the title and the close button (Filters' "Reset all").
  action?: ReactNode;
  closeTestID?: string;
}

export function SheetHeader({ visible, icon, title, subtitle, onClose, action, closeTestID }: SheetHeaderProps) {
  const titleRef = useRef<TextInstance>(null);
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy >= SWIPE_DISMISS_DISTANCE || gesture.vy >= SWIPE_DISMISS_VELOCITY) onClose();
      },
    }),
    [onClose],
  );

  // Screen readers land on the title each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }, 250);
    return () => clearTimeout(timeout);
  }, [visible]);

  return (
    <>
      <View style={styles.handleTouch} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>

      <View style={styles.titleRow}>
        <Icon name={icon} size={26} color={MonoColors.text} />
        <View style={styles.titleText}>
          <Text ref={titleRef} accessible accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {action}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel()}
          hitSlop={4}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
          testID={closeTestID}
        >
          <Icon name="close" size={16} color={MonoColors.textSecond} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // marginTop -16 pulls the handle up into Sheet.tsx's own 16px panel padding.
  handleTouch: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -16 },
  handle: { width: 32, height: 3, borderRadius: 2, backgroundColor: MonoColors.textDisabled },
  titleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: MonoColors.border,
  },
  titleText: { flex: 1 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  subtitle: { ...MonoText.caption, color: MonoColors.textMeta },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: MonoColors.bg },
});
