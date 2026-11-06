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
  currencyCount?: number; // forex only — drives the open card's "N CURRENCIES" tag
}

export interface CardStackProps {
  netWorth: number;
  accountCount: number;
  note?: string; // the total card's own note line — caller composes it (incomplete warning, forex estimate, or nothing)
  accounts: CardStackAccount[]; // already in display order (Bank, Cash, E-wallet, Savings, Valas, then stored order)
  onOpenAccount: (id: number) => void;
  testID?: string;
}

function TotalCard({ netWorth, accountCount, note }: { netWorth: number; accountCount: number; note?: string }) {
  return (
    <View style={styles.totalCard}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="total" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F5F5F5" />
            <Stop offset="1" stopColor="#C7C7C7" />
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
  zIndex: number;
  hidden: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}

function StackedCard({ account, isOpen, zIndex, hidden, onToggle, onOpen }: StackedCardProps) {
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
          currencyCount={isOpen ? account.currencyCount : undefined}
          accessibilityLabel={accessibilityLabel}
          onPress={() => (isOpen ? onOpen(account.id) : onToggle(account.id))}
          testID={`card-stack-card-${account.id}`}
        />
      </Animated.View>
    </View>
  );
}

export function CardStack({ netWorth, accountCount, note, accounts, onOpenAccount, testID }: CardStackProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const [openId, setOpenId] = useState<number | undefined>(() => accounts[accounts.length - 1]?.id);

  return (
    <View testID={testID}>
      <TotalCard netWorth={netWorth} accountCount={accountCount} note={note} />
      {accounts.map((account, index) => (
        <StackedCard
          key={account.id}
          account={account}
          isOpen={account.id === openId}
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
