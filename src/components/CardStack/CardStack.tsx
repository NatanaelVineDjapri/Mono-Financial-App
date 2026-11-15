// Accounts tab, Fase 4.2c ("Accounts screen = card stack", DESIGN.md's account-cards
// addendum): a total card on top, then one PhysicalCard per account overlapping the one
// before it by 12dp. Exactly one account card is open (the full 184-tall look, unchanged
// — CLAUDE.md step 1 "don't change the full look") at a time; every other account is a
// 68-tall "strip" (PhysicalCard's own variant). Tapping a strip brings it forward
// (opens it, closing whatever was open); tapping the open card navigates to its detail.
//
// Reordering — "hold a card, then drag it": a press held for HOLD_TO_DRAG lifts the card
// (it grows slightly and its shadow deepens); from there a vertical drag walks it through
// the stack while the cards it passes slide out of the way. Releasing drops it in the
// nearest slot and the new order goes out through onReorder. The hold is what keeps the
// gestures apart: a tap still opens a card, and a plain swipe still scrolls the page.
// While a card is in hand the screen turns its ScrollView off (onDragActiveChange),
// because Android's scroll view would otherwise intercept the vertical drag before the
// JS responder ever sees it.
//
// Data stays exactly what src/features/accounts/useAccountsOverview.ts already produces
// (CLAUDE.md: "Data, hook, dan query tab Akun yang sudah ada TIDAK diubah; hanya
// presentasi") — this component only re-presents it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { Amount } from '@/components/Amount';
import { PhysicalCard } from '@/components/PhysicalCard';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import type { AccountType } from '@/data/repo/accounts';
import { accountsCountLabel, accountsSummaryLabel, cardStackAdvanceLabel, cardStackOpenLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const STRIP_HEIGHT = 68;
const OPEN_HEIGHT = 184; // matches PhysicalCard's own 358:184 "list" variant at the screen's
// typical available width (the same assumption PhysicalCard's own styles already make).
const OVERLAP = 12;
const DURATION = 200;
const TOTAL_CARD_HEIGHT = 140;
const HOLD_TO_DRAG = 220; // ms of stillness before a card is "in hand" and can be dragged

export interface CardStackAccount {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  balance: number; // rupiah; for forex, the account's total rupiah value
  subline?: string; // forex only
  nativeOnly?: boolean; // forex only: a pocket has no rate, so the card shows native amounts instead of ≈ Rp
}

export interface CardStackProps {
  netWorth: number;
  accountCount: number;
  // The total card's note line. `note` is the everyday one (or an incomplete-data
  // warning) and always applies; `forexNote` — the "foreign currency uses your latest
  // rates" line — only replaces it while the forex account is the one *open* (this
  // component owns that open/closed state, not the caller), since it's only relevant
  // detail about whichever card is actually in view.
  note: string;
  forexNote?: string;
  // The total includes foreign money valued at the latest rates: draw it with "≈" (and not when the
  // total is incomplete, where the note says what is missing).
  approximate?: boolean;
  accounts: CardStackAccount[]; // already in display order (Bank, Cash, E-wallet, Savings, Valas, then stored order)
  onOpenAccount: (id: number) => void;
  // The new order after a drop, as account ids. Persisting it is the caller's job.
  onReorder?: (orderedIds: number[]) => void;
  // True from the moment a card is picked up until it is dropped. The screen turns its
  // ScrollView off while this is true so the drag is not swallowed by page scrolling.
  onDragActiveChange?: (active: boolean) => void;
  testID?: string;
}

// The card being dragged: which account, where it came from and the slot it is over now.
interface DragState {
  id: number;
  from: number;
  to: number;
}

function cardHeight(isOpen: boolean): number {
  return isOpen ? OPEN_HEIGHT : STRIP_HEIGHT;
}

// Where every card's top edge sits: each card starts where the previous one ends, minus
// the 12dp overlap. An open card is 116 taller than a strip, so a fixed step would drift
// as soon as anything but the last card is the open one.
function stackTops(items: CardStackAccount[], openId: number | undefined): number[] {
  const tops: number[] = [];
  let top = 0;
  for (const item of items) {
    tops.push(top);
    top += cardHeight(item.id === openId) - OVERLAP;
  }
  return tops;
}

// The slot whose top edge is closest to the dragged card's top edge.
function nearestSlot(tops: number[], from: number, dy: number): number {
  const draggedTop = tops[from] + dy;
  let best = from;
  for (let i = 0; i < tops.length; i++) {
    if (Math.abs(tops[i] - draggedTop) < Math.abs(tops[best] - draggedTop)) best = i;
  }
  return best;
}

// The list order with the card at `from` moved to `to` — the same helper for the live
// preview and for the commit, so the cards cannot disagree about where things land.
function movedOrder(count: number, from: number, to: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return order;
}

function TotalCard({ netWorth, accountCount, note, approximate }: { netWorth: number; accountCount: number; note: string; approximate?: boolean }) {
  return (
    <View style={styles.totalCard}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="total" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#C9973A" />
            <Stop offset="0.5" stopColor="#E3C27A" />
            <Stop offset="1" stopColor="#F0D99A" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#total)" />
      </Svg>
      <View style={styles.totalContent}>
        <View style={styles.totalTopRow}>
          <Text style={styles.totalLabel}>{accountsSummaryLabel()}</Text>
          <Text style={styles.totalCount}>{accountsCountLabel(accountCount)}</Text>
        </View>
        <View style={styles.totalAmountRow}>
          {!!approximate && <Text style={[MonoText.displayS, styles.totalAmount]}>{'≈ '}</Text>}
          <Amount value={netWorth} variant="displayS" style={styles.totalAmount} />
        </View>
        {!!note && <Text style={styles.totalNote}>{note}</Text>}
      </View>
    </View>
  );
}

interface StackedCardProps {
  account: CardStackAccount;
  index: number;
  isOpen: boolean;
  isLast: boolean;
  zIndex: number;
  hidden: boolean;
  isDragging: boolean;
  shift: number; // how far this card slides to make room for the one being dragged
  dragY: Animated.Value;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  onDragStart: (index: number) => void;
  onDragMove: (index: number, dy: number) => void;
  onDragEnd: (index: number, dy: number) => void;
  onDragCancel: () => void;
  onDragActiveChange: (active: boolean) => void;
}

function StackedCard({
  account,
  index,
  isOpen,
  isLast,
  zIndex,
  hidden,
  isDragging,
  shift,
  dragY,
  onToggle,
  onOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onDragActiveChange,
}: StackedCardProps) {
  const reducedMotion = useReducedMotion();
  const height = useSharedValue(isOpen ? OPEN_HEIGHT : STRIP_HEIGHT);
  const [shiftAnim] = useState(() => new Animated.Value(0));
  const [lifted, setLifted] = useState(false);
  const armed = useRef(false);
  // A hold that never turns into a drag must not also count as a tap when it ends: the
  // card was picked up, so releasing it puts it back instead of opening it.
  const held = useRef(false);
  const isArmed = useCallback(() => armed.current, []);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Writing a shared value's `.value` belongs in an effect, not render (Reanimated's
  // strict-mode logger flags a direct write during render even though it happens to
  // "work" — this is the first component in this codebase to hit that check).
  useEffect(() => {
    const target = isOpen ? OPEN_HEIGHT : STRIP_HEIGHT;
    height.value = reducedMotion ? target : withTiming(target, { duration: DURATION, easing: Easing.out(Easing.ease) });
  }, [isOpen, reducedMotion, height]);

  // The cards the dragged one passes slide out of the way, in a spring so the motion
  // reads as "make room" rather than a jump.
  useEffect(() => {
    Animated.spring(shiftAnim, {
      toValue: shift,
      useNativeDriver: true,
      tension: 180,
      friction: 20,
    }).start();
  }, [shift, shiftAnim]);

  // Letting go (or losing the touch) always ends the hold, whatever stage it reached.
  const disarm = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (!armed.current) return;
    armed.current = false;
    setLifted(false);
    onDragActiveChange(false);
  }, [onDragActiveChange]);

  // A card unmounted mid-hold must not leave the timer behind.
  useEffect(() => disarm, [disarm]);

  // A touch that stays put for HOLD_TO_DRAG puts the card in hand: it lifts, the page
  // stops scrolling, and from here a move is a drag instead of a scroll.
  const onTouchStart = useCallback(() => {
    held.current = false;
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      armed.current = true;
      held.current = true;
      setLifted(true);
      onDragActiveChange(true);
    }, HOLD_TO_DRAG);
  }, [onDragActiveChange]);

  const panResponder = useMemo(
    () =>
      // PanResponder's callbacks run on touch events, never during render; the rule cannot
      // see through PanResponder.create and treats the hold flag as a render-time read.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        // A tap belongs to the card's own Pressable; only a held touch becomes a drag.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => isArmed(),
        onMoveShouldSetPanResponderCapture: () => isArmed(),
        // Once the card is in hand nothing may take it back — not the page's scroll view.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          onDragStart(index);
        },
        onPanResponderMove: (_, gesture) => {
          onDragMove(index, gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          onDragEnd(index, gesture.dy);
          disarm();
        },
        onPanResponderTerminate: () => {
          onDragCancel();
          disarm();
        },
      }),
    [index, disarm, isArmed, onDragStart, onDragMove, onDragEnd, onDragCancel],
  );

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));
  const balanceText = shown(rp(account.balance), hidden);
  const accessibilityLabel = isOpen
    ? cardStackOpenLabel(account.name, balanceText)
    : cardStackAdvanceLabel(account.name, balanceText);

  // A small tilt makes the card feel held rather than glued to the finger. Keep it subtle:
  // large rotations make a tall open card look unstable.
  const dragRotation = dragY.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ['-2deg', '0deg', '2deg'],
    extrapolate: 'clamp',
  });

  // One transform per card: the dragged one follows the finger, a lifted one just grows,
  // and every other one sits at its shift.
  const transform = isDragging
    ? [{ translateY: dragY }, { rotate: dragRotation }, { scale: 1.025 }]
    : lifted
      ? [{ translateY: shiftAnim }, { scale: 1.02 }]
      : [{ translateY: shiftAnim }];

  return (
    // Two layers on purpose: overflow:hidden (for the animated-height crop) clips a
    // shadow too, so the shadow lives on this outer, unclipped wrapper and the clip
    // itself on the inner Reanimated.View (RN's standard shadow + overflow:hidden split).
    <Animated.View
      testID={`card-stack-drag-${account.id}`}
      {...panResponder.panHandlers}
      onTouchStart={onTouchStart}
      onTouchEnd={disarm}
      onTouchCancel={disarm}
      style={[
        styles.shadowWrap,
        {
          marginTop: -OVERLAP,
          zIndex: isDragging || lifted ? 999 : zIndex,
          transform,
          shadowOpacity: isDragging ? 0.6 : lifted ? 0.5 : 0.4,
          elevation: isDragging ? 16 : lifted ? 12 : 8,
        },
      ]}
    >
      <Reanimated.View style={[styles.clipWrap, animatedStyle]}>
        <PhysicalCard
          variant={isOpen ? 'list' : 'strip'}
          name={account.name}
          type={account.type}
          icon={account.icon}
          balance={account.balance}
          subline={isOpen || account.nativeOnly ? account.subline : undefined}
          nativeOnly={account.nativeOnly}
          liftContent={isOpen && !isLast}
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            if (held.current) return;
            if (isOpen) onOpen(account.id);
            else onToggle(account.id);
          }}
          testID={`card-stack-card-${account.id}`}
        />
      </Reanimated.View>
    </Animated.View>
  );
}

// Default-open is "the last card" — except Valas, which still sorts last in the stack
// but shouldn't be the first thing the screen opens with on its own; this picks the
// last *non-forex* account instead, falling back to the true last account only if
// every account happens to be forex.
function defaultOpenId(accounts: CardStackAccount[]): number | undefined {
  for (let i = accounts.length - 1; i >= 0; i--) {
    if (accounts[i].type !== 'forex') return accounts[i].id;
  }
  return accounts[accounts.length - 1]?.id;
}

export function CardStack({
  netWorth,
  accountCount,
  note,
  forexNote,
  approximate,
  accounts,
  onOpenAccount,
  onReorder,
  onDragActiveChange,
  testID,
}: CardStackProps) {
  const hidden = useHideAmounts(s => s.hidden);
  // Only the *order* is local state; every card's data still comes from props, so a
  // balance update lands without disturbing an order the user just dragged.
  const [order, setOrder] = useState<number[]>(() => accounts.map(a => a.id));
  const [openId, setOpenId] = useState<number | undefined>(() => defaultOpenId(accounts));
  const [drag, setDrag] = useState<DragState | null>(null);

  const propOrder = accounts.map(a => a.id);
  const propKey = propOrder.join(',');
  const [knownPropKey, setKnownPropKey] = useState(propKey);
  if (propKey !== knownPropKey) {
    setKnownPropKey(propKey);
    setOrder(propOrder);
  }

  const accountById = new Map(accounts.map(account => [account.id, account]));
  const items = order
    .map(id => accountById.get(id))
    .filter((account): account is CardStackAccount => account !== undefined);

  const dragY = useState(() => new Animated.Value(0))[0];
  const dragRef = useRef<DragState | null>(null);
  const itemsRef = useRef(items);
  const openIdRef = useRef(openId);
  const mounted = useRef(true);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);


  // The ref is written by hand as well as on render: a whole drag can happen inside one
  // batch of updates, and the release must see the slot the move just chose.
  const setDragState = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const settle = useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 150,
      friction: 18,
    }).start(() => {
      if (!mounted.current) return;
      dragY.setValue(0);
      setDragState(null);
    });
  }, [dragY, setDragState]);

  const onDragStart = useCallback(
    (index: number) => {
      const account = itemsRef.current[index];
      if (!account) return;
      dragY.setValue(0);
      setDragState({ id: account.id, from: index, to: index });
    },
    [dragY, setDragState],
  );

  const onDragMove = useCallback(
    (index: number, dy: number) => {
      dragY.setValue(dy);
      const account = itemsRef.current[index];
      if (!account) return;
      const to = nearestSlot(stackTops(itemsRef.current, openIdRef.current), index, dy);
      if (dragRef.current?.to === to) return;
      setDragState({ id: account.id, from: index, to });
    },
    [dragY, setDragState],
  );

  const onDragEnd = useCallback(
    (fromIndex: number, dy: number) => {
      const current = dragRef.current;
      const list = itemsRef.current;
      const open = openIdRef.current;
      const to = current ? current.to : nearestSlot(stackTops(list, open), fromIndex, dy);

      if (!current || to === fromIndex || to < 0 || to >= list.length) {
        settle();
        return;
      }

      const next = movedOrder(list.length, fromIndex, to).map(i => list[i]);
      // The moment the list changes the card's layout jumps to its new slot; starting
      // the settle from where the finger left it is what makes it slide in, not snap.
      const visualTop = stackTops(list, open)[fromIndex] + dy;
      const layoutTop = stackTops(next, open)[to];
      dragY.setValue(visualTop - layoutTop);

      itemsRef.current = next;
      setOrder(next.map(account => account.id));
      setDragState({ id: next[to].id, from: to, to });
      onReorder?.(next.map(a => a.id));
      settle();
    },
    [dragY, onReorder, setDragState, settle],
  );

  const onDragCancel = useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 170,
      friction: 20,
    }).start(() => {
      if (!mounted.current) return;
      dragY.setValue(0);
      setDragState(null);
    });
  }, [dragY, setDragState]);

  // How far each card slides while another one is over its slot: the exact offset between
  // where the card is now and where the preview order would put it.
  const shiftById = useMemo(() => {
    const shifts = new Map<number, number>();
    if (!drag || drag.from === drag.to) return shifts;
    const order = movedOrder(items.length, drag.from, drag.to);
    const currentTops = stackTops(items, openId);
    const previewTops: number[] = [];
    let top = 0;
    for (const original of order) {
      previewTops.push(top);
      top += cardHeight(items[original].id === openId) - OVERLAP;
    }
    order.forEach((original, slot) => {
      if (original === drag.from) return;
      shifts.set(items[original].id, previewTops[slot] - currentTops[original]);
    });
    return shifts;
  }, [items, openId, drag]);

  const openAccount = items.find(a => a.id === openId);
  const displayedNote = forexNote && openAccount?.type === 'forex' ? forexNote : note;

  return (
    <View testID={testID}>
      <TotalCard netWorth={netWorth} accountCount={accountCount} note={displayedNote} approximate={approximate} />
      {items.map((account, index) => (
        <StackedCard
          key={account.id}
          account={account}
          index={index}
          isOpen={account.id === openId}
          isLast={index === items.length - 1}
          zIndex={index + 1}
          hidden={hidden}
          isDragging={drag?.id === account.id}
          shift={drag && drag.id !== account.id ? shiftById.get(account.id) ?? 0 : 0}
          dragY={dragY}
          onToggle={setOpenId}
          onOpen={onOpenAccount}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          onDragActiveChange={onDragActiveChange ?? noop}
        />
      ))}
    </View>
  );
}

function noop(): void {
  // A caller that does not care about the drag (a test, a preview) simply gets no signal.
}

const styles = StyleSheet.create({
  totalCard: {
    height: TOTAL_CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    zIndex: 0,
  },
  totalContent: { flex: 1, padding: 20, justifyContent: 'space-between' },
  totalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...MonoText.label, color: MonoColors.bg, textTransform: 'uppercase' },
  totalCount: { ...MonoText.bodyS, color: MonoColors.bg, opacity: 0.7 },
  totalAmount: { color: MonoColors.bg },
  totalAmountRow: { flexDirection: 'row', alignItems: 'baseline' },
  totalNote: { ...MonoText.caption, color: MonoColors.bg, opacity: 0.7 },

  // Top shadow per card (Fase 4.2c step 2: "0 -8 16 rgba(0,0,0,.4)"). Android's
  // `elevation` only gives a generic (non-directional) drop shadow — there is no exact
  // equivalent of a negative/upward offset — so this is an approximation there.
  shadowWrap: {
    borderRadius: radius.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  clipWrap: { overflow: 'hidden', borderRadius: radius.lg },
});
