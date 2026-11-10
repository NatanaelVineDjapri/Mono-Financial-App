// Akun (Accounts) tab (DESIGN.md "D. Accounts" / "Account cards", PAGES.md D1/V1; Fase
// 4.2c: "Accounts screen = card stack"). Add account, transfer and account detail are
// later phases — every action here just shows a "Not available yet." toast until those
// screens exist, except the card stack's own open card, which now navigates to the
// /account/[id] stub.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CardStack, type CardStackAccount } from '@/components/CardStack';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTabBarClearance } from '@/components/TabBar';
import { showToast } from '@/components/toast-store';
import { formatDateTime } from '@/core/date';
import { money } from '@/core/money';
import type { AccountsOverview, AccountsOverviewAccount } from '@/domain/balances';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useLatestFxUpdate } from '@/features/fx/useLatestFxUpdate';
import {
    accountsEmptyBody,
    accountsEmptyTitle,
    accountsErrorMessage,
    accountsForexEstimateNote,
    accountsIncompleteNote,
    accountsNoLoginNote,
    accountsTransferNote,
    addAccountLabel,
    exchangeRatesLabel,
    exchangeRatesUpdatedLabel,
    notAvailableToast,
    retryLabel,
    tabLabel,
    transferAccountsLabel,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// TODO(Phase 5): Add account and Transfer between accounts don't exist yet — every entry
// point here shows this toast instead of navigating.
function notAvailable() {
  showToast(notAvailableToast());
}

// ScreenHeader's right slot: Add account doesn't exist yet (Phase 5), so this matches
// the screen's own "Add account" button below and just shows the same toast.
function AccountsHeaderAction() {
  return <HeaderButton icon="plus" label={addAccountLabel()} onPress={notAvailable} testID="accounts-add-button" />;
}

function forexSubline(account: AccountsOverviewAccount): string | undefined {
  if (!account.pockets || account.pockets.length === 0) return undefined;
  return account.pockets.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · ');
}

function toCardStackAccount(account: AccountsOverviewAccount): CardStackAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    balance: account.balance,
    subline: forexSubline(account),
  };
}

// The total card's note (Fase 4.2c step 3: the stack's old standalone note below it is
// gone — this is now the only place it lives). `note` is the everyday one, or a genuine
// data-gap warning that always applies regardless of what's open; `forexNote` is only
// shown by CardStack while the Valas card itself is the one open, so it never overrides
// the warning (accounts.tsx never hands out both at once).
function defaultNote(overview: AccountsOverview): string {
  return overview.incomplete ? accountsIncompleteNote() : accountsTransferNote();
}

function forexOpenNote(overview: AccountsOverview, latestFxUpdate: string | null | undefined): string | undefined {
  if (overview.incomplete) return undefined;
  const hasForex = overview.groups.some(g => g.type === 'forex');
  return hasForex && latestFxUpdate ? accountsForexEstimateNote(formatDateTime(latestFxUpdate)) : undefined;
}

function ExchangeRatesRow({ latestFxUpdate }: { latestFxUpdate: string | null | undefined }) {
  const updatedText = latestFxUpdate ? exchangeRatesUpdatedLabel(formatDateTime(latestFxUpdate)) : undefined;
  return (
    <Pressable
      onPress={notAvailable}
      accessibilityRole="button"
      accessibilityLabel={updatedText ? `${exchangeRatesLabel()}. ${updatedText}` : exchangeRatesLabel()}
      style={styles.ratesRow}
    >
      <Icon name="refresh" size={16} color={MonoColors.textSecond} />
      <Text style={styles.ratesLabel}>{exchangeRatesLabel()}</Text>
      {!!updatedText && <Text style={styles.ratesUpdated}>{updatedText}</Text>}
      <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
    </Pressable>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const { data, isLoading, isError, refetch } = useAccountsOverview();
  const { data: latestFxUpdate } = useLatestFxUpdate();
  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);
  const onOpenAccount = useCallback(
    (id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }),
    [router],
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction />} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction />} />
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{accountsErrorMessage()}</Text>
          <Button label={retryLabel()} onPress={onRetry} />
        </View>
      </View>
    );
  }

  if (data.accountCount === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction />} />
        <View style={styles.centerFill}>
          <Icon name="bank" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{accountsEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{accountsEmptyBody()}</Text>
          <Button label={addAccountLabel()} icon="plus" onPress={notAvailable} />
        </View>
      </View>
    );
  }

  // GROUP_ORDER (src/domain/balances.ts) already places groups Bank, Cash, E-wallet,
  // Savings, Forex in that order — flattening keeps it, per Fase 4.2c step 2's own order.
  const accounts = data.groups.flatMap(group => group.accounts.map(toCardStackAccount));
  const hasForex = data.groups.some(g => g.type === 'forex');

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        <CardStack
          netWorth={data.netWorth}
          accountCount={data.accountCount}
          note={defaultNote(data)}
          forexNote={forexOpenNote(data, latestFxUpdate)}
          accounts={accounts}
          onOpenAccount={onOpenAccount}
          testID="accounts-card-stack"
        />
        {hasForex && <ExchangeRatesRow latestFxUpdate={latestFxUpdate} />}
        <View style={styles.buttonRow}>
          <Button label={transferAccountsLabel()} icon="transfer" onPress={notAvailable} style={styles.buttonFlex} />
          <Button label={addAccountLabel()} icon="plus" variant="secondary" onPress={notAvailable} style={styles.buttonFlex} />
        </View>
        <View style={styles.footerRow}>
          <Icon name="lock" size={16} color={MonoColors.textMeta} />
          <Text style={styles.footerNote}>{accountsNoLoginNote()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, gap: 20 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center' },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  ratesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: MonoColors.card,
  },
  ratesLabel: { ...MonoText.bodyStrong, color: MonoColors.text },
  ratesUpdated: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  buttonRow: { flexDirection: 'row', gap: 12 },
  buttonFlex: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
});
