// DESIGN.md "Bottom navigation": a floating "charcoal & gold" bar. A 112-high zone (plus the
// bottom safe-area inset) holds one 64-high, radius-30 bar; the centre "+" (TabFab) sits 32
// above the bar's top edge. Order: two tabs, the "+", two tabs. The zone itself is
// transparent over the screen's #0A0A0A, so the host (src/app/(tabs)/_layout.tsx) lays it out
// absolutely over the content and every tab screen pads its scroll content by
// `useTabBarClearance()`.
//
// Active tab = solid light pill (icon + label dark, label semibold); inactive = icon over a
// grey label. Colour is never the only signal: the pill's shape/width and
// accessibilityState.selected say the same thing. Labels hide below 340dp wide, at large
// font scales, or when their estimated widths would not fit — CLAUDE.md rule 7 ("text never
// truncates") leaves hiding as the only option; the accessibilityLabel stays either way.
//
// The bar's own palette (charcoal fill, grey label) is inline until a theme token exists.
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/Icon';
import { Icon } from '@/components/Icon';
import { TabFab, TAB_FAB_RAISE, TAB_FAB_SIZE } from '@/components/TabFab';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// 24 for the "+" (it overlaps the bar's top by 32, so the zone's top edge is 34 above the
// bar), 14 under the bar, plus the safe-area inset on top of the zone's own height.
export const TAB_BAR_ZONE_HEIGHT = 112;
const ZONE_PADDING_BOTTOM = 14;
const ZONE_MARGIN_HORIZONTAL = 10;
const BAR_HEIGHT = 64;
const BAR_RADIUS = 30;
const BAR_PADDING_HORIZONTAL = 6;
const SLOT_MIN_WIDTH = 44;
const SLOT_HEIGHT = 48;
const SLOT_RADIUS = 24;
const ACTIVE_PADDING_HORIZONTAL = 13;
const ICON_SIZE = 22;
const ICON_LABEL_GAP = 2;
// The centre gap the "+" occupies between the second and third tab (64 circle + a little air).
const FAB_SLOT_WIDTH = 72;
const TRANSITION_MS = 200;

const BAR_FILL = '#131314';
const BAR_BORDER = '#262627';
const INACTIVE = '#9A9A9A';
const ACTIVE_FILL = MonoColors.text; // #F5F5F5
const ACTIVE_INK = MonoColors.bg; // #0A0A0A

const HIDE_LABELS_BELOW_WIDTH = 340;
const HIDE_LABELS_ABOVE_FONT_SCALE = 1.15;
// A deliberately generous average advance for IBM Plex Sans 500/600 at 10.5dp.
const CHAR_WIDTH_AT_SCALE_1 = 5.8;

export interface TabBarItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  items: TabBarItem[]; // the four tabs, in order; the "+" is inserted after the second
  activeKey: string;
  onPress: (key: string) => void;
  fabLabel: string;
  onFabPress: () => void;
  testID?: string;
}

// Distance from the bottom of the screen to the top of the bar's zone — what a screen's
// scroll content has to clear so its last row isn't covered by the (absolutely placed) bar.
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_ZONE_HEIGHT + insets.bottom;
}

function labelWidth(label: string, fontScale: number): number {
  return label.length * CHAR_WIDTH_AT_SCALE_1 * fontScale;
}

// Whether every label fits at once: each inactive slot needs its label (or the 44 floor),
// the active pill needs its label plus its padding.
export function labelsFit(items: TabBarItem[], activeKey: string, windowWidth: number, fontScale: number): boolean {
  if (windowWidth < HIDE_LABELS_BELOW_WIDTH || fontScale > HIDE_LABELS_ABOVE_FONT_SCALE) return false;
  const inner = windowWidth - ZONE_MARGIN_HORIZONTAL * 2 - BAR_PADDING_HORIZONTAL * 2 - FAB_SLOT_WIDTH;
  const needed = items.reduce((sum, item) => {
    const w = labelWidth(item.label, fontScale);
    return sum + (item.key === activeKey ? w + ACTIVE_PADDING_HORIZONTAL * 2 : Math.max(SLOT_MIN_WIDTH, w + 4));
  }, 0);
  return needed <= inner;
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
  const color = selected ? ACTIVE_INK : INACTIVE;
  return (
    <Animated.View layout={layoutTransition} style={selected ? styles.slotActive : styles.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        android_ripple={undefined}
        style={styles.slotPress}
        testID={testID}
      >
        <Icon name={item.icon} size={ICON_SIZE} color={color} />
        {showLabel && (
          <Text style={[selected ? MonoText.navLabelActive : MonoText.navLabel, { color }]} numberOfLines={1}>
            {item.label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function TabBar({ items, activeKey, onPress, fabLabel, onFabPress, testID }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const layoutTransition = useMemo(() => LinearTransition.duration(TRANSITION_MS).easing(Easing.out(Easing.ease)), []);
  const showLabel = labelsFit(items, activeKey, width, fontScale);

  const buttons = items.map(item => (
    <TabButton
      key={item.key}
      item={item}
      selected={item.key === activeKey}
      showLabel={showLabel}
      layoutTransition={reducedMotion ? undefined : layoutTransition}
      onPress={() => onPress(item.key)}
      testID={testID && `${testID}-${item.key}`}
    />
  ));
  const half = Math.ceil(buttons.length / 2);

  return (
    <View
      testID={testID}
      style={[styles.zone, { height: TAB_BAR_ZONE_HEIGHT + insets.bottom, paddingBottom: ZONE_PADDING_BOTTOM + insets.bottom }]}
    >
      <View testID={testID && `${testID}-bar`} accessibilityRole="tablist" style={styles.bar}>
        {buttons.slice(0, half)}
        <View style={styles.fabSlot} />
        {buttons.slice(half)}
      </View>
      <View style={[styles.fabHost, { bottom: ZONE_PADDING_BOTTOM + insets.bottom + BAR_HEIGHT - TAB_FAB_SIZE + TAB_FAB_RAISE }]}>
        <TabFab label={fabLabel} onPress={onFabPress} testID={testID && `${testID}-fab`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the screen's own #0A0A0A shows through. justifyContent flex-end puts the
  // bar's bottom edge ZONE_PADDING_BOTTOM above the zone's bottom.
  zone: {
    pointerEvents: 'box-none', // the transparent strip around the bar must not swallow touches
    justifyContent: 'flex-end',
    marginHorizontal: ZONE_MARGIN_HORIZONTAL,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    backgroundColor: BAR_FILL,
    borderWidth: 1,
    borderColor: BAR_BORDER,
    paddingHorizontal: BAR_PADDING_HORIZONTAL,
    boxShadow: '0px -10px 28px rgba(0,0,0,0.55)',
  },
  fabSlot: { width: FAB_SLOT_WIDTH },
  // Horizontally centred over the bar; `bottom` is set per render from the safe-area inset.
  fabHost: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  // Explicit flexGrow/flexShrink/flexBasis, not the `flex` shorthand: RN/Yoga's `flex: 0`
  // also zeroes flexBasis (unlike web CSS), which let an active pill with a label fight for
  // its width against the inactive slots' flexGrow instead of sizing from its own content
  // and push the last tab out of the bar. flexBasis 'auto' on the pill is the fix.
  slot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: SLOT_MIN_WIDTH,
    height: SLOT_HEIGHT,
    borderRadius: SLOT_RADIUS,
  },
  slotActive: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: SLOT_MIN_WIDTH,
    height: SLOT_HEIGHT,
    borderRadius: SLOT_RADIUS,
    paddingHorizontal: ACTIVE_PADDING_HORIZONTAL,
    backgroundColor: ACTIVE_FILL,
  },
  slotPress: {
    flex: 1,
    minWidth: SLOT_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_LABEL_GAP,
  },
});
