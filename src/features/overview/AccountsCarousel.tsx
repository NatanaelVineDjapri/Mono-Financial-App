// "Your accounts" (DESIGN.md "A. Overview", design v77): a 3D coverflow of brand-colour bank
// cards (300×154). The focused card sits centred at full size with a soft shadow; its
// neighbours peek in on both sides, smaller (0.88), turned about 26° around the Y axis and
// darker, tucked slightly behind it. A row of dots under the cards shows the position (the
// active one is a longer pill). Tapping the focused card opens it; tapping a neighbour brings
// it to the centre first.
//
// The cards follow the finger and then settle with a spring that carries the finger's speed, so
// a flick can pass a few cards and a slow drag moves one. The row loops without an end: the
// position is a number of cards that only grows or shrinks, and card k shows account k modulo
// the number of accounts. Only the five cards around the middle one are drawn.
//
// Everything that follows the finger runs on the UI thread from one shared value; React hears
// only when another card reaches the middle.
import { memo, useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PhysicalCard } from '@/components/PhysicalCard';
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
const AROUND = 2; // cards drawn on each side of the middle one
const MAX_FLING = 3; // cards one flick can pass
const GLIDE_SECONDS = 0.15; // how far ahead the finger's speed is carried
const SPRING = { damping: 20, stiffness: 170, mass: 0.8 };

export interface AccountsCarouselProps {
  title: string;
  linkLabel: string;
  accounts: AccountsOverviewAccount[];
  onOpenAll: () => void;
  onOpenAccount: (id: number) => void;
}

const wrap = (k: number, count: number) => ((k % count) + count) % count;

// Where a released drag comes to rest: `position` (in cards) carried on by the finger's speed, at most MAX_FLING cards
// from where it started; a quick short flick still moves on by one.
export function settleTarget(position: number, startedAt: number, velocityX: number): number {
  'worklet';
  const speed = -velocityX / CARD_INTERVAL; // cards per second
  const from = Math.round(startedAt);
  let target = Math.round(position + speed * GLIDE_SECONDS);
  if (target === from && Math.abs(velocityX) > 400) target = from + Math.sign(speed);
  return Math.min(Math.max(target, from - MAX_FLING), from + MAX_FLING);
}

interface ItemProps {
  k: number; // which place in the endless row
  account: AccountsOverviewAccount;
  position: SharedValue<number>;
  left: number;
  zIndex: number;
  hiddenFromA11y: boolean;
  onPress: (k: number, id: number) => void;
  testID: string;
}

const CarouselItem = memo(function CarouselItem({ k, account, position, left, zIndex, hiddenFromA11y, onPress, testID }: ItemProps) {
  // `d` is how many card-steps this card is from the middle: 0 focused, -1 one to the left.
  const style = useAnimatedStyle(() => {
    const d = k - position.value;
    return {
      transform: [
        { perspective: PERSPECTIVE },
        { translateX: d * CARD_INTERVAL },
        { scale: interpolate(d, [-1, 0, 1], [SIDE_SCALE, 1, SIDE_SCALE], Extrapolation.CLAMP) },
        { rotateY: `${interpolate(d, [-1, 0, 1], [SIDE_ROTATE_DEG, 0, -SIDE_ROTATE_DEG], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(k - position.value), [0, 1], [0, SIDE_DIM], Extrapolation.CLAMP) }));
  return (
    <Animated.View
      style={[styles.item, { left, zIndex }, style]}
      renderToHardwareTextureAndroid
      accessibilityElementsHidden={hiddenFromA11y}
      importantForAccessibility={hiddenFromA11y ? 'no-hide-descendants' : 'auto'}
    >
      <PhysicalCard
        variant="carousel"
        name={account.name}
        type={account.type}
        icon={account.icon}
        balance={account.balance}
        subline={account.pockets?.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · ')}
        onPress={() => onPress(k, account.id)}
        testID={testID}
      />
      <Animated.View pointerEvents="none" style={[styles.veil, veil]} />
    </Animated.View>
  );
});

function Dot({ index, count, position }: { index: number; count: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // The position wrapped to the real account list, and its circular distance from this dot
    // (so the dot after the last account is the first one again).
    const diff = (((position.value - index) % count) + count) % count;
    const distance = Math.min(diff, count - diff);
    return {
      width: interpolate(distance, [0, 1], [DOT_ACTIVE, DOT], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(distance, [0, 1], [MonoColors.accent, MonoColors.border]),
    };
  });
  return <Animated.View style={[styles.dot, style]} testID={`overview-account-dot-${index}`} />;
}

export function AccountsCarousel(props: AccountsCarouselProps) {
  // Remount when the number of accounts changes: which card sits where depends on it.
  return <Coverflow key={props.accounts.length} {...props} />;
}

function Coverflow({ title, linkLabel, accounts, onOpenAll, onOpenAccount }: AccountsCarouselProps) {
  const { width } = useWindowDimensions();
  const left = Math.max(0, (width - CARD_WIDTH) / 2);
  const count = accounts.length;
  const loops = count > 1;
  const position = useSharedValue(0);
  const dragFrom = useSharedValue(0);
  const touchFrom = useSharedValue(0);
  const [center, setCenter] = useState(0);
  const centerRef = useRef(0);

  const focus = useCallback((k: number) => {
    centerRef.current = k;
    setCenter(k);
  }, []);

  useAnimatedReaction(
    () => Math.round(position.value),
    (now, before) => {
      if (before !== null && now !== before) scheduleOnRN(focus, now);
    },
  );

  // Only a sideways drag is taken: an up or down one is left to the page.
  const pan = usePanGesture({
    testID: 'overview-account-pan',
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    onActivate: event => {
      'worklet';
      cancelAnimation(position);
      dragFrom.set(position.value);
      touchFrom.set(event.translationX); // so the card does not jump by the distance it took to activate
    },
    onUpdate: event => {
      'worklet';
      const moved = (event.translationX - touchFrom.value) / CARD_INTERVAL;
      // one account has nowhere to go: it gives a little and comes back
      position.set(loops ? dragFrom.value - moved : -moved * 0.2);
    },
    onDeactivate: event => {
      'worklet';
      if (!loops) {
        position.set(withSpring(0, SPRING));
        return;
      }
      const target = settleTarget(position.value, dragFrom.value, event.velocityX);
      position.set(withSpring(target, { ...SPRING, velocity: -event.velocityX / CARD_INTERVAL }));
    },
  });

  const onPressCard = useCallback(
    (k: number, id: number) => {
      if (k === centerRef.current) {
        onOpenAccount(id);
        return;
      }
      position.set(withSpring(k, SPRING));
      focus(k);
    },
    [onOpenAccount, position, focus],
  );

  const places = loops ? Array.from({ length: AROUND * 2 + 1 }, (_, i) => center - AROUND + i) : [0];
  // The nearest drawn card of each account carries the account's own test id.
  const nearest = new Map<number, number>();
  for (const k of [...places].sort((a, b) => Math.abs(a - center) - Math.abs(b - center))) {
    const index = wrap(k, count);
    if (!nearest.has(index)) nearest.set(index, k);
  }

  return (
    <View style={styles.section}>
      <SectionHeader title={title} linkLabel={linkLabel} onPress={onOpenAll} />
      <GestureDetector gesture={pan}>
        <View style={styles.stage} collapsable={false} testID="overview-account-carousel">
          {places.map(k => {
            const index = wrap(k, count);
            const account = accounts[index];
            const own = nearest.get(index) === k;
            return (
              <CarouselItem
                key={k}
                k={k}
                account={account}
                position={position}
                left={left}
                zIndex={10 - Math.abs(k - center)}
                // screen readers get each account once, from the cards that can be seen
                hiddenFromA11y={!own || Math.abs(k - center) > 1}
                onPress={onPressCard}
                testID={own ? `overview-account-${account.id}` : `overview-account-${account.id}-copy-${k}`}
              />
            );
          })}
        </View>
      </GestureDetector>
      {count > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {accounts.map((account, index) => (
            <Dot key={account.id} index={index} count={count} position={position} />
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
  stage: { height: CARD_HEIGHT + 24, overflow: 'hidden' },
  item: {
    position: 'absolute',
    top: 12,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    boxShadow: '0px 8px 16px rgba(0,0,0,0.45)',
  },
  veil: { ...StyleSheet.absoluteFill, borderRadius: 16, backgroundColor: '#000' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: DOT, borderRadius: DOT / 2 },
  note: { ...MonoText.caption, color: MonoColors.textMeta, paddingHorizontal: 16 },
});
