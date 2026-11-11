// "Your accounts" (DESIGN.md "A. Overview", design v77): a 3D coverflow of brand-colour bank
// cards (300×154). The focused card sits centred at full size with a soft shadow; its
// neighbours peek in on both sides, smaller (0.88), turned about 26° around the Y axis and
// darker, tucked slightly behind it. Swiping snaps to the centre one card at a time, and a
// row of dots under the cards shows the position (the active one is a longer gold pill).
// Tapping the focused card opens it; tapping a neighbour brings it to the centre first.
//
// The row loops: the first card has the last one on its left, and the last card has the
// first on its right. It is the account list repeated 3 or 5 times with the middle copy in
// view; whenever a swipe settles, the scroll position silently jumps to the same card in
// the middle copy, so the user never reaches an end. One account does not loop.
//
// Everything that follows the finger runs on the UI thread from one scroll offset (a shared
// value), so there is no React re-render per frame. Only the committed index (for the tap
// behaviour) is JS state, set when a swipe settles.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { BankCard } from '@/components/BankCard';
import { money } from '@/core/money';
import type { AccountsOverviewAccount } from '@/domain/balances';
import { accountsCountNote } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SectionHeader } from './SectionHeader';

export const CARD_WIDTH = 300;
const CARD_HEIGHT = 154;
// Distance between card centres: less than the card width, so each neighbour tucks behind
// the focused card and only its outer part peeks out.
export const CARD_INTERVAL = 260;
const SIDE_SCALE = 0.88;
const SIDE_ROTATE_DEG = 26;
const SIDE_DIM = 0.45; // opacity of the black veil over a card one step away
const PERSPECTIVE = 900;
const DOT = 6;
const DOT_ACTIVE = 18;

export interface AccountsCarouselProps {
  title: string;
  linkLabel: string;
  accounts: AccountsOverviewAccount[];
  onOpenAll: () => void;
  onOpenAccount: (id: number) => void;
}

function CarouselItem({ index, offset, isLast, hiddenFromA11y, children }: { index: number; offset: SharedValue<number>; isLast: boolean; hiddenFromA11y: boolean; children: ReactNode }) {
  // `d` is how many card-steps this card is from the centre: 0 focused, -1 one to the left.
  const style = useAnimatedStyle(() => {
    const d = index - offset.value / CARD_INTERVAL;
    return {
      zIndex: Math.round(100 - Math.min(Math.abs(d), 5) * 10),
      transform: [
        { perspective: PERSPECTIVE },
        { scale: interpolate(d, [-1, 0, 1], [SIDE_SCALE, 1, SIDE_SCALE], Extrapolation.CLAMP) },
        { rotateY: `${interpolate(d, [-1, 0, 1], [SIDE_ROTATE_DEG, 0, -SIDE_ROTATE_DEG], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
  const veil = useAnimatedStyle(() => {
    const d = index - offset.value / CARD_INTERVAL;
    return { opacity: interpolate(Math.abs(d), [0, 1], [0, SIDE_DIM], Extrapolation.CLAMP) };
  });
  return (
    // The repeated copies exist only to make the row loop; screen readers get each account once.
    <Animated.View
      style={[styles.item, !isLast && styles.itemOverlap, style]}
      accessibilityElementsHidden={hiddenFromA11y}
      importantForAccessibility={hiddenFromA11y ? 'no-hide-descendants' : 'auto'}
    >
      {children}
      <Animated.View pointerEvents="none" style={[styles.veil, veil]} />
    </Animated.View>
  );
}

function Dot({ index, count, offset }: { index: number; count: number; offset: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // Position in card steps, wrapped to the real account list, and its circular distance
    // from this dot (so the dot after the last account is the first one again).
    const p = offset.value / CARD_INTERVAL;
    const diff = (((p - index) % count) + count) % count;
    const distance = Math.min(diff, count - diff);
    return {
      width: interpolate(distance, [0, 1], [DOT_ACTIVE, DOT], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(distance, [0, 1], [MonoColors.accent, MonoColors.border]),
    };
  });
  return <Animated.View style={[styles.dot, style]} testID={`overview-account-dot-${index}`} />;
}

// Copies of the list laid out side by side. Enough on each side of the middle one that a
// hard fling cannot run off the end before the swipe settles and re-centres.
function copiesFor(count: number): number {
  if (count <= 1) return 1;
  return count >= 6 ? 3 : 5;
}

export function AccountsCarousel(props: AccountsCarouselProps) {
  // Remount when the number of accounts changes: the offsets below depend on it.
  return <Coverflow key={props.accounts.length} {...props} />;
}

function Coverflow({ title, linkLabel, accounts, onOpenAll, onOpenAccount }: AccountsCarouselProps) {
  const { width } = useWindowDimensions();
  const sidePadding = Math.max(0, (width - CARD_WIDTH) / 2);
  const count = accounts.length;
  const copies = copiesFor(count);
  const middle = Math.floor(copies / 2);
  const startIndex = count * middle;
  const offset = useSharedValue(startIndex * CARD_INTERVAL);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const placed = useRef(false);
  const [active, setActive] = useState(startIndex);

  const onScroll = useAnimatedScrollHandler(event => {
    offset.value = event.contentOffset.x;
  });

  // Start with the first account centred in the middle copy (Android ignores the
  // `contentOffset` prop, so the first layout scrolls there).
  const placeAtStart = useCallback(() => {
    if (placed.current || startIndex === 0) return;
    placed.current = true;
    scrollRef.current?.scrollTo({ x: startIndex * CARD_INTERVAL, animated: false });
  }, [startIndex]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.x / CARD_INTERVAL), 0), count * copies - 1);
      if (count <= 1) {
        setActive(index);
        return;
      }
      // Same card, middle copy: an invisible jump that keeps both sides full.
      const home = startIndex + (index % count);
      if (home !== index) {
        scrollRef.current?.scrollTo({ x: home * CARD_INTERVAL, animated: false });
        offset.set(home * CARD_INTERVAL);
      }
      setActive(home);
    },
    [count, copies, startIndex, offset],
  );

  const onPressCard = useCallback(
    (index: number, id: number) => {
      if (index === active) {
        onOpenAccount(id);
        return;
      }
      scrollRef.current?.scrollTo({ x: index * CARD_INTERVAL, animated: true });
      setActive(index);
    },
    [active, onOpenAccount],
  );

  const items = Array.from({ length: copies * count }, (_, index) => ({ index, copy: Math.floor(index / count), account: accounts[index % count] }));

  return (
    <View style={styles.section}>
      <SectionHeader title={title} linkLabel={linkLabel} onPress={onOpenAll} />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={placeAtStart}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentOffset={{ x: startIndex * CARD_INTERVAL, y: 0 }}
        contentContainerStyle={[styles.row, { paddingHorizontal: sidePadding }]}
        style={styles.scroller}
        testID="overview-account-carousel"
      >
        {items.map(({ index, copy, account }) => {
          const real = copy === middle;
          return (
            <CarouselItem
              key={`${copy}-${account.id}`}
              index={index}
              offset={offset}
              isLast={index === items.length - 1}
              hiddenFromA11y={!real}
            >
              <BankCard
                variant="carousel"
                name={account.name}
                type={account.type}
                icon={account.icon}
                balance={account.balance}
                subline={account.pockets?.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · ')}
                onPress={() => onPressCard(index, account.id)}
                testID={real ? `overview-account-${account.id}` : `overview-account-${account.id}-copy-${copy}`}
              />
            </CarouselItem>
          );
        })}
      </Animated.ScrollView>
      {count > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {accounts.map((account, index) => (
            <Dot key={account.id} index={index} count={count} offset={offset} />
          ))}
        </View>
      )}
      <Text style={styles.note}>{accountsCountNote(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  // Room above and below for the shadow and the rotated cards' corners.
  scroller: { flexGrow: 0, paddingVertical: 12 },
  row: { alignItems: 'center' },
  item: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    boxShadow: '0px 10px 24px rgba(0,0,0,0.5)',
  },
  // Pulls the next card back so it tucks behind this one.
  itemOverlap: { marginRight: CARD_INTERVAL - CARD_WIDTH },
  veil: { ...StyleSheet.absoluteFill, borderRadius: 16, backgroundColor: '#000' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: DOT, borderRadius: DOT / 2 },
  note: { ...MonoText.caption, color: MonoColors.textMeta, paddingHorizontal: 16 },
});
