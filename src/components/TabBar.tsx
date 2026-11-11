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
// Switching tabs slides the pill. The slots' widths are computed (slotWidths) and animated with
// shared values: the old pill shrinks and fades as the new one grows and fills, 200 ms, ease out
// (no motion under reduce-motion). It deliberately does not use Reanimated's `layout`
// transitions: those stopped firing once every tab had been visited.
//
// The bar's own palette (charcoal fill, grey label) is inline until a theme token exists.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
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
// Inside the bar's rounded ends: the outer tabs (Overview, Budgets) sit this far in from the edge
// instead of hugging the curve.
const BAR_PADDING_HORIZONTAL = 12;
const BAR_BORDER_WIDTH = 1;
const SLOT_MIN_WIDTH = 44;
const SLOT_HEIGHT = 48;
const SLOT_RADIUS = 24;
// An icon-only pill (labels hidden on a narrow screen) grows to this much, no more.
const ICON_ONLY_PILL_MAX = 56;
const ACTIVE_PADDING_HORIZONTAL = 5; // inside the pill, each side of the label
const REST_PADDING = 3; // each side of a tab's label when it is not the pill (it is measured, so 3 is never a clip)
const ICON_SIZE = 22;
const ICON_LABEL_GAP = 2;
// The centre gap the "+" occupies between the second and third tab. It grows with the screen: at
// 360dp it is the circle plus a hair, at 411dp there are about 5dp of clear bar between the +'s ring
// and its neighbours, so the tabs never crowd it. (Narrow screens have no width to spare.)
const FAB_SLOT_MIN = 74;
const FAB_SLOT_MAX = 90;
const FAB_SLOT_GROWTH = 0.3; // dp of gap per dp of screen width above 360

export function fabSlotWidth(windowWidth: number): number {
  return Math.round(Math.min(FAB_SLOT_MAX, Math.max(FAB_SLOT_MIN, FAB_SLOT_MIN + (windowWidth - 360) * FAB_SLOT_GROWTH)));
}

const BAR_FILL = '#131314';
const BAR_BORDER = '#262627';
const INACTIVE = '#9A9A9A';
const ACTIVE_FILL = MonoColors.text; // #F5F5F5
const ACTIVE_FILL_CLEAR = 'rgba(245,245,245,0)';
const ACTIVE_INK = MonoColors.bg; // #0A0A0A

const TRANSITION_MS = 220;
// The pill starts sliding this long before the navigation runs, so the (heavy) screen switch
// cannot swallow the first frames of the slide. Zero under reduce-motion.
export const SLIDE_LEAD_MS = 70;
const SLIDE_EASING = Easing.out(Easing.cubic);

const HIDE_LABELS_BELOW_WIDTH = 340;
const HIDE_LABELS_ABOVE_FONT_SCALE = 1.15;
// A deliberately generous average advance for IBM Plex Sans 500/600 at 10.5dp.
const CHAR_WIDTH_AT_SCALE_1 = 5.3;

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
  fabOpen?: boolean; // the add menu is showing
  testID?: string;
}

// Where the centre of the + sits above the bottom of the screen: the add menu fans out from it.
export function fabCenterFromBottom(bottomInset: number): number {
  return ZONE_PADDING_BOTTOM + bottomInset + BAR_HEIGHT + TAB_FAB_RAISE - TAB_FAB_SIZE / 2;
}

// Distance from the bottom of the screen to the top of the bar's zone — what a screen's
// scroll content has to clear so its last row isn't covered by the (absolutely placed) bar.
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_ZONE_HEIGHT + insets.bottom;
}

// The real width of every label, as the bar measures it (see LabelMeasurer), per weight: the
// active label is semibold, the others medium. Until a label has been measured (the first frame)
// the width is estimated from its length; the estimate is generous but a measurement is exact,
// so no label is ever cut off.
export type LabelMetrics = Record<string, { medium?: number; semi?: number }>;

function labelWidth(item: TabBarItem, bold: boolean, fontScale: number, metrics?: LabelMetrics): number {
  const measured = metrics?.[item.key]?.[bold ? 'semi' : 'medium'];
  return measured != null ? measured : item.label.length * CHAR_WIDTH_AT_SCALE_1 * fontScale;
}

// The bar is symmetric around the +: the two tabs on its left and the two on its right always
// take exactly the same width (half of what is left of the bar), whichever tab is active, so the
// distance from the + to its neighbours never changes. Inside a half the active pill GROWS: it takes
// all the room its neighbour does not need for its own label, so the neighbour is pushed aside and
// shrinks, never the pill. A half with no pill shares its width by what the two labels need.
function barHalf(windowWidth: number): number {
  const inner = windowWidth - ZONE_MARGIN_HORIZONTAL * 2 - BAR_PADDING_HORIZONTAL * 2 - BAR_BORDER_WIDTH * 2 - fabSlotWidth(windowWidth);
  return inner / 2;
}

function pillNeed(item: TabBarItem, fontScale: number, showLabel: boolean, metrics?: LabelMetrics): number {
  return showLabel ? labelWidth(item, true, fontScale, metrics) + ACTIVE_PADDING_HORIZONTAL * 2 : SLOT_MIN_WIDTH + 4;
}

// A tab that is not the pill: its label plus a little air on each side, never under 44.
function restNeed(item: TabBarItem, fontScale: number, showLabel: boolean, metrics?: LabelMetrics): number {
  return Math.max(SLOT_MIN_WIDTH, showLabel ? labelWidth(item, false, fontScale, metrics) + REST_PADDING * 2 : 0);
}

// Whether the labels fit, judged for EVERY tab being the active one (so labels never come and go
// as the pill moves): in each half, the pill plus its neighbour, or the two labels, must fit.
export function labelsFit(items: TabBarItem[], windowWidth: number, fontScale: number, metrics?: LabelMetrics): boolean {
  if (windowWidth < HIDE_LABELS_BELOW_WIDTH || fontScale > HIDE_LABELS_ABOVE_FONT_SCALE) return false;
  const half = barHalf(windowWidth);
  const cut = Math.ceil(items.length / 2);
  const sides = [items.slice(0, cut), items.slice(cut)];
  return items.every(active =>
    sides.every(side => {
      const need = side.reduce((sum, item) => sum + (item.key === active.key ? pillNeed(item, fontScale, true, metrics) : restNeed(item, fontScale, true, metrics)), 0);
      return need <= half;
    }),
  );
}

// The width of each slot, in dp, for the given active tab: the numbers the slots animate between.
// Each half sums to exactly `barHalf`, so the + stays in the middle of the row.
export function slotWidths(items: TabBarItem[], activeKey: string, windowWidth: number, fontScale: number, showLabel: boolean, metrics?: LabelMetrics): number[] {
  const half = barHalf(windowWidth);
  const cut = Math.ceil(items.length / 2);
  const widths: number[] = [];
  for (const side of [items.slice(0, cut), items.slice(cut)]) {
    const activeIndex = side.findIndex(item => item.key === activeKey);
    if (activeIndex >= 0) {
      const others = side.filter((_, i) => i !== activeIndex);
      const othersMin = others.length * SLOT_MIN_WIDTH;
      const othersNeed = others.reduce((sum, item) => sum + restNeed(item, fontScale, showLabel, metrics), 0);
      // The room left once the neighbour has what its label needs. With labels the pill is never
      // narrower than its own label and padding; icon-only it is capped so it stays a pill.
      const grown = half - othersNeed;
      const wanted = showLabel ? Math.max(pillNeed(side[activeIndex], fontScale, true, metrics), grown) : Math.min(grown, ICON_ONLY_PILL_MAX);
      const pill = Math.min(wanted, half - othersMin);
      const rest = (half - pill) / Math.max(others.length, 1);
      side.forEach((_, i) => widths.push(i === activeIndex ? pill : rest));
    } else {
      const needs = side.map(item => restNeed(item, fontScale, showLabel, metrics));
      const share = (half - needs.reduce((sum, n) => sum + n, 0)) / side.length;
      needs.forEach(n => widths.push(Math.max(SLOT_MIN_WIDTH, n + share)));
    }
  }
  return widths;
}

interface TabButtonProps {
  item: TabBarItem;
  selected: boolean;
  showLabel: boolean;
  width: number; // the slot's target width
  reducedMotion: boolean;
  onPress: () => void;
  testID?: string;
}

function TabButton({ item, selected, showLabel, width, reducedMotion, onPress, testID }: TabButtonProps) {
  const color = selected ? ACTIVE_INK : INACTIVE;
  // Starting at the target means nothing animates on the first draw; later changes glide.
  const animatedWidth = useSharedValue(width);
  const fill = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const toFill = selected ? 1 : 0;
    animatedWidth.set(reducedMotion ? width : withTiming(width, { duration: TRANSITION_MS, easing: SLIDE_EASING }));
    fill.set(reducedMotion ? toFill : withTiming(toFill, { duration: TRANSITION_MS, easing: SLIDE_EASING }));
  }, [width, selected, reducedMotion, animatedWidth, fill]);
  const slotStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
    backgroundColor: interpolateColor(fill.value, [0, 1], [ACTIVE_FILL_CLEAR, ACTIVE_FILL]),
  }));
  return (
    <Animated.View style={[styles.slot, slotStyle]}>
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
          <Text style={[selected ? MonoText.navLabelActive : MonoText.navLabel, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {item.label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Renders every label twice, invisibly (medium and semibold, the two weights a tab can have), and
// reports their real widths. Nothing here is drawn or read aloud; it only feeds slotWidths and
// labelsFit, which then never have to guess.
function LabelMeasurer({ items, onMeasure, testID }: { items: TabBarItem[]; onMeasure: (key: string, bold: boolean, width: number) => void; testID?: string }) {
  return (
    <View style={styles.measurer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {items.flatMap(item =>
        [false, true].map(bold => (
          <Text
            key={`${item.key}-${bold ? 'semi' : 'medium'}`}
            style={bold ? MonoText.navLabelActive : MonoText.navLabel}
            numberOfLines={1}
            onLayout={e => onMeasure(item.key, bold, Math.ceil(e.nativeEvent.layout.width))}
            testID={testID && `${testID}-${item.key}-${bold ? 'semi' : 'medium'}`}
          >
            {item.label}
          </Text>
        )),
      )}
    </View>
  );
}

export function TabBar({ items, activeKey, onPress, fabLabel, onFabPress, fabOpen = false, testID }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // The pill follows a local "visual" tab that a press sets at once; the navigation itself runs
  // SLIDE_LEAD_MS later. Switching to a screen that is already mounted can block the UI thread for
  // a moment, and a slide that starts at the same instant would be over before it was seen.
  // When the real active tab changes some other way (a link, the back button) the pill follows it.
  const [visualKey, setVisualKey] = useState(activeKey);
  const [seenActiveKey, setSeenActiveKey] = useState(activeKey);
  if (activeKey !== seenActiveKey) {
    setSeenActiveKey(activeKey);
    setVisualKey(activeKey);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const press = (key: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (reducedMotion || key === visualKey) {
      setVisualKey(key);
      onPress(key);
      return;
    }
    setVisualKey(key);
    timer.current = setTimeout(() => {
      timer.current = null;
      onPress(key);
    }, SLIDE_LEAD_MS);
  };

  // Real label widths, measured once the labels exist (and again if the text size changes).
  const [metrics, setMetrics] = useState<LabelMetrics>({});
  const onMeasure = (key: string, bold: boolean, measured: number) =>
    setMetrics(previous => {
      const field = bold ? 'semi' : 'medium';
      return previous[key]?.[field] === measured ? previous : { ...previous, [key]: { ...previous[key], [field]: measured } };
    });

  const showLabel = labelsFit(items, width, fontScale, metrics);
  const widths = slotWidths(items, visualKey, width, fontScale, showLabel, metrics);

  const buttons = items.map((item, i) => (
    <TabButton
      key={item.key}
      item={item}
      selected={item.key === visualKey}
      showLabel={showLabel}
      width={widths[i]}
      reducedMotion={reducedMotion}
      onPress={() => press(item.key)}
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
        <LabelMeasurer items={items} onMeasure={onMeasure} testID={testID && `${testID}-measure`} />
        {buttons.slice(0, half)}
        <View style={{ width: fabSlotWidth(width) }} />
        {buttons.slice(half)}
      </View>
      <View style={[styles.fabHost, { bottom: ZONE_PADDING_BOTTOM + insets.bottom + BAR_HEIGHT - TAB_FAB_SIZE + TAB_FAB_RAISE }]}>
        <TabFab label={fabLabel} onPress={onFabPress} open={fabOpen} testID={testID && `${testID}-fab`} />
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
  // Horizontally centred over the bar; `bottom` is set per render from the safe-area inset.
  fabHost: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  // Each slot's width and fill are animated (TabButton); the pill is the one whose fill is light.
  slot: {
    height: SLOT_HEIGHT,
    borderRadius: SLOT_RADIUS,
    // No overflow clipping: a label may never be cut off at the slot's edge.
  },
  // Out of sight and out of the layout: the two weights of every label, to read their widths.
  measurer: { position: 'absolute', left: 0, top: 0, opacity: 0, alignItems: 'flex-start' },
  slotPress: {
    flex: 1,
    minWidth: SLOT_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_LABEL_GAP,
  },
});
