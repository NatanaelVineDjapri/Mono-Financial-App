// Accounts tab, Fase 4.2c ("Accounts screen = card stack", DESIGN.md's account-cards
// addendum): a total card on top, then one BankCard per account overlapping the one
// before it by 12dp. Exactly one account card is open (the full 184-tall look, unchanged
// — CLAUDE.md step 1 "don't change the full look") at a time; every other account is a
// 68-tall "strip" (BankCard's own new variant). Tapping a strip brings it forward
// (opens it, closing whatever was open); tapping the open card navigates to its detail.
//
// Data stays exactly what src/features/accounts/useAccountsOverview.ts already produces
// (CLAUDE.md: "Data, hook, dan query tab Akun yang sudah ada TIDAK diubah; hanya
// presentasi") — this component only re-presents it.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { Amount } from '@/components/Amount';
import { BankCard } from '@/components/BankCard';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import type { AccountType } from '@/data/repo/accounts';
import { accountsCountLabel, accountsSummaryLabel, cardStackAdvanceLabel, cardStackOpenLabel } from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const STRIP_HEIGHT = 68;
const OPEN_HEIGHT = 184; // matches BankCard's own 358:184 "list" variant at the screen's
// typical available width (the same assumption BankCard's own styles already make).
const OVERLAP = 12;
const DURATION = 200;
const TOTAL_CARD_HEIGHT = 140;

export interface CardStackAccount {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  balance: number; // rupiah; for forex, the account's total rupiah value
  subline?: string; // forex only
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
  accounts: CardStackAccount[]; // already in display order (Bank, Cash, E-wallet, Savings, Valas, then stored order)
  onOpenAccount: (id: number) => void;
  testID?: string;
}

function TotalCard({ netWorth, accountCount, note }: { netWorth: number; accountCount: number; note: string }) {
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
        <Amount value={netWorth} variant="displayS" style={styles.totalAmount} />
        {!!note && <Text style={styles.totalNote}>{note}</Text>}
      </View>
    </View>
  );
}

interface StackedCardProps {
  account: CardStackAccount;
  isOpen: boolean;
  isLast: boolean;
  zIndex: number;
  hidden: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}

function StackedCard({ account, isOpen, isLast, zIndex, hidden, onToggle, onOpen }: StackedCardProps) {
  const reducedMotion = useReducedMotion();
  const height = useSharedValue(isOpen ? OPEN_HEIGHT : STRIP_HEIGHT);

  // Writing a shared value's `.value` belongs in an effect, not render (Reanimated's
  // strict-mode logger flags a direct write during render even though it happens to
  // "work" — this is the first component in this codebase to hit that check).
  useEffect(() => {
    const target = isOpen ? OPEN_HEIGHT : STRIP_HEIGHT;
    height.value = reducedMotion ? target : withTiming(target, { duration: DURATION, easing: Easing.out(Easing.ease) });
  }, [isOpen, reducedMotion, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));
  const balanceText = shown(rp(account.balance), hidden);
  const accessibilityLabel = isOpen
    ? cardStackOpenLabel(account.name, balanceText)
    : cardStackAdvanceLabel(account.name, balanceText);

  return (
    // Two layers on purpose: overflow:hidden (for the animated-height crop) clips a
    // shadow too, so the shadow lives on this outer, unclipped wrapper and the clip
    // itself on the inner Animated.View (RN's standard shadow + overflow:hidden split).
    <View style={[styles.shadowWrap, { marginTop: -OVERLAP, zIndex }]}>
      <Animated.View style={[styles.clipWrap, animatedStyle]}>
        <BankCard
          variant={isOpen ? 'list' : 'strip'}
          name={account.name}
          type={account.type}
          icon={account.icon}
          balance={account.balance}
          subline={isOpen ? account.subline : undefined}
          liftContent={isOpen && !isLast}
          accessibilityLabel={accessibilityLabel}
          onPress={() => (isOpen ? onOpen(account.id) : onToggle(account.id))}
          testID={`card-stack-card-${account.id}`}
        />
      </Animated.View>
    </View>
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

export function CardStack({ netWorth, accountCount, note, forexNote, accounts, onOpenAccount, testID }: CardStackProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const [openId, setOpenId] = useState<number | undefined>(() => defaultOpenId(accounts));
  const openAccount = accounts.find(a => a.id === openId);
  const displayedNote = forexNote && openAccount?.type === 'forex' ? forexNote : note;

  return (
    <View testID={testID}>
      <TotalCard netWorth={netWorth} accountCount={accountCount} note={displayedNote} />
      {accounts.map((account, index) => (
        <StackedCard
          key={account.id}
          account={account}
          isOpen={account.id === openId}
          isLast={index === accounts.length - 1}
          zIndex={index + 1}
          hidden={hidden}
          onToggle={setOpenId}
          onOpen={onOpenAccount}
        />
      ))}
    </View>
  );
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
