// DESIGN.md sections 8/9/16 (component map's "Bottom navigation" row): a floating pill
// tab bar, replacing the old flat bar + 28x2 indicator above the icon. A 72-tall zone
// (plus the bottom safe-area inset, added below it) holds one 56-tall, radius-28 bar;
// the active tab is a 44-tall, radius-22 pill filled `text` (icon+label on `bg`) — the
// one deliberate "inverse" surface here, same footing as BankCard's own brand-colour
// exception (CLAUDE.md rule 5). Inactive tabs are icon-only; colour is never the only
// signal regardless — position (flex width, the pill itself) and accessibilityState
// both say the same thing colour does. Amber never appears here.
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import type { IconName } from '@/components/Icon';
import { Icon } from '@/components/Icon';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// Exported so other screens (e.g. the Transactions tab's FAB) can size themselves
// against the real navbar zone instead of a duplicated magic number.
export const TAB_BAR_ZONE_HEIGHT = 72;
// The empty strip between the zone's top edge and the visible bar's top edge. The zone's
// edge itself can't be seen (same colour as the screen), so a screen that floats something
// above the bar measures its gap from the bar's visible edge, i.e. net of this strip.
export const TAB_BAR_ZONE_PADDING_TOP = 8;
const ZONE_HEIGHT = TAB_BAR_ZONE_HEIGHT;
const ZONE_PADDING_TOP = TAB_BAR_ZONE_PADDING_TOP;
const ZONE_PADDING_BOTTOM = 8;
const ZONE_PADDING_HORIZONTAL = 10;
const BAR_HEIGHT = 56;
const BAR_RADIUS = 28;
const BAR_PADDING_HORIZONTAL = 5;
const BAR_GAP = 2;
const PILL_HEIGHT = 44;
const PILL_RADIUS = 22;
const PILL_PADDING_HORIZONTAL = 14;
const PILL_GAP = 8;
const ICON_SIZE = 22;
const TRANSITION_MS = 200;

// The active pill's label hides when it wouldn't fit — CLAUDE.md rule 7 ("text never
// truncates") leaves hiding the label as the only option, not shrinking or clipping it.
// A formula, not a live text measurement (no onLayout round-trip, so it can never flash
// label-then-hide): each of the other 4 tabs keeps its own 44dp floor, and the active
// pill's own estimated width (icon + gap + an average-character label estimate +
// padding) must fit in whatever's left of the bar.
const CHAR_WIDTH_AT_SCALE_1 = 7.5; // IBM Plex Sans 600, 13dp — a deliberately generous average
function estimatedLabelWidth(label: string, fontScale: number): number {
  return label.length * CHAR_WIDTH_AT_SCALE_1 * fontScale;
}

function fitsWithLabel(label: string, barWidth: number, itemCount: number, fontScale: number): boolean {
  if (!Number.isFinite(barWidth)) return true;
  const barInnerWidth = barWidth - BAR_PADDING_HORIZONTAL * 2 - BAR_GAP * (itemCount - 1);
  const reservedForOthers = (itemCount - 1) * PILL_HEIGHT; // each keeps its 44dp floor
  const availableForActivePill = barInnerWidth - reservedForOthers;
  const estimatedPillWidth = ICON_SIZE + PILL_GAP + estimatedLabelWidth(label, fontScale) + PILL_PADDING_HORIZONTAL * 2;
  return estimatedPillWidth <= availableForActivePill;
}

export interface TabBarItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onPress: (key: string) => void;
  // The navigator already knows the bottom safe-area inset (BottomTabBarProps.insets) —
  // taking it as a prop keeps this component itself free of a useSafeAreaInsets() call,
  // so a test can set it directly instead of wrapping in a SafeAreaProvider.
  bottomInset?: number;
  testID?: string;
}

interface TabButtonProps {
  item: TabBarItem;
  selected: boolean;
  showLabel: boolean;
  layoutTransition: ReturnType<typeof LinearTransition.duration> | undefined;
  onPress: () => void;
  testID?: string;
}

function TabButton({ item, selected, showLabel, layoutTransition, onPress, testID }: TabButtonProps) {
  const color = selected ? MonoColors.bg : MonoColors.textMeta;
  return (
    <Animated.View layout={layoutTransition} style={selected ? styles.pill : styles.cell}>
      <Icon name={item.icon} size={ICON_SIZE} color={color} />
      {selected && showLabel && <Text style={[styles.label, { color }]}>{item.label}</Text>}
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        android_ripple={undefined}
        style={StyleSheet.absoluteFill}
        testID={testID}
      />
    </Animated.View>
  );
}

export function TabBar({ items, activeKey, onPress, bottomInset = 0, testID }: TabBarProps) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Starts generously (most phones are wider than this at rest) so the label doesn't
  // flash hidden-then-shown before the first onLayout measurement lands.
  const [barWidth, setBarWidth] = useState(Number.POSITIVE_INFINITY);
  const onBarLayout = useCallback((e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width), []);

  const activeItem = items.find(i => i.key === activeKey);
  const showLabel = !!activeItem && fitsWithLabel(activeItem.label, barWidth, items.length, fontScale);
  const layoutTransition = reducedMotion ? undefined : LinearTransition.duration(TRANSITION_MS).easing(Easing.out(Easing.ease));

  return (
    <View
      testID={testID}
      style={[styles.zone, { height: ZONE_HEIGHT + bottomInset, paddingBottom: ZONE_PADDING_BOTTOM + bottomInset }]}
    >
      <View testID={testID && `${testID}-bar`} accessibilityRole="tablist" style={styles.bar} onLayout={onBarLayout}>
        {items.map(item => (
          <TabButton
            key={item.key}
            item={item}
            selected={item.key === activeKey}
            showLabel={showLabel}
            layoutTransition={layoutTransition}
            onPress={() => onPress(item.key)}
            testID={testID && `${testID}-${item.key}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingTop: ZONE_PADDING_TOP,
    paddingHorizontal: ZONE_PADDING_HORIZONTAL,
    backgroundColor: MonoColors.bg,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    backgroundColor: MonoColors.surface,
    borderWidth: 1,
    borderColor: MonoColors.border,
    paddingHorizontal: BAR_PADDING_HORIZONTAL,
    gap: BAR_GAP,
  },
  // Explicit flexGrow/flexShrink/flexBasis, not the `flex` shorthand: RN/Yoga's `flex: 0`
  // also zeroes flexBasis (unlike web CSS, where flex:0 keeps basis auto), which let an
  // active pill with a label claim a flexBasis of 0 and get its real width fought over by
  // the inactive cells' flexGrow:1 instead of sized from its own content — the pill then
  // overflowed the bar and pushed the last tab out (TabBar bug report). flexBasis:'auto'
  // here is the actual fix.
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MonoColors.text,
    paddingHorizontal: PILL_PADDING_HORIZONTAL,
    gap: PILL_GAP,
  },
  label: { ...MonoText.navLabel },
});
