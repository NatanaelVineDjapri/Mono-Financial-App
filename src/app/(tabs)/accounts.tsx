// Akun (Accounts) tab (DESIGN.md "D. Accounts" / "Account cards", PAGES.md D1/V1; Fase
// 4.2c: "Accounts screen = card stack"). Add account opens /account/edit, Transfer opens the
// transaction form as a transfer, and the card stack's open card opens /account/[id]. Only
// the Exchange rates row opens /settings/rates.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CardStack, type CardStackAccount } from '@/components/CardStack';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTabBarClearance } from '@/components/TabBar';
import { formatDateTime } from '@/core/date';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { money, shown } from '@/core/money';
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
    retryLabel,
    tabLabel,
    transferAccountsLabel,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// ScreenHeader's right slot: the same "Add account" as the screen's own button below.
function AccountsHeaderAction({ onPress }: { onPress: () => void }) {
  return <HeaderButton icon="plus" label={addAccountLabel()} onPress={onPress} testID="accounts-add-button" />;
}

// "US$250,00 · S$180,00": the native amounts. Hidden-amounts mode masks the whole line, like every
// other figure on the card.
function forexSubline(account: AccountsOverviewAccount, hidden: boolean): string | undefined {
  if (!account.pockets || account.pockets.length === 0) return undefined;
  return shown(account.pockets.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · '), hidden);
}

function toCardStackAccount(account: AccountsOverviewAccount, hidden: boolean): CardStackAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    balance: account.balance,
    subline: forexSubline(account, hidden),
    // A pocket with no rate: its rupiah value is unknown (never 0), so the card shows the native amounts.
    nativeOnly: account.type === 'forex' && account.missingRates > 0,
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

function ExchangeRatesRow({ latestFxUpdate, onPress }: { latestFxUpdate: string | null | undefined; onPress: () => void }) {
  const updatedText = latestFxUpdate ? exchangeRatesUpdatedLabel(formatDateTime(latestFxUpdate)) : undefined;
  return (
    <Pressable
      onPress={onPress}
      testID="accounts-rates-row"
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
  const hidden = useHideAmounts(s => s.hidden);
  const onOpenRates = useCallback(() => router.push('/settings/rates' as never), [router]);
  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);
  const onAddAccount = useCallback(() => router.push('/account/edit' as never), [router]);
  const onTransfer = useCallback(() => router.push({ pathname: '/tx/add', params: { type: 'transfer' } }), [router]);
  const onOpenAccount = useCallback(
    (id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }),
    [router],
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction onPress={onAddAccount} />} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction onPress={onAddAccount} />} />
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
        <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction onPress={onAddAccount} />} />
        <View style={styles.centerFill}>
          <Icon name="bank" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{accountsEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{accountsEmptyBody()}</Text>
          <Button label={addAccountLabel()} icon="plus" onPress={onAddAccount} />
        </View>
      </View>
    );
  }

  // GROUP_ORDER (src/domain/balances.ts) already places groups Bank, Cash, E-wallet,
  // Savings, Forex in that order — flattening keeps it, per Fase 4.2c step 2's own order.
  const accounts = data.groups.flatMap(group => group.accounts.map(account => toCardStackAccount(account, hidden)));
  const hasForex = data.groups.some(g => g.type === 'forex');

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('accounts')} right={<AccountsHeaderAction onPress={onAddAccount} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        <CardStack
          netWorth={data.netWorth}
          accountCount={data.accountCount}
          note={defaultNote(data)}
          forexNote={forexOpenNote(data, latestFxUpdate)}
          approximate={hasForex && !data.incomplete}
          accounts={accounts}
          onOpenAccount={onOpenAccount}
          testID="accounts-card-stack"
        />
        {hasForex && <ExchangeRatesRow latestFxUpdate={latestFxUpdate} onPress={onOpenRates} />}
        <View style={styles.buttonRow}>
          <Button label={transferAccountsLabel()} icon="transfer" onPress={onTransfer} style={styles.buttonFlex} />
          <Button label={addAccountLabel()} icon="plus" variant="secondary" onPress={onAddAccount} style={styles.buttonFlex} />
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
