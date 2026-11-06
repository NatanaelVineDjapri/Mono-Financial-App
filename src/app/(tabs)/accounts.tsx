// Akun (Accounts) tab (DESIGN.md "D. Accounts" / "Account cards", PAGES.md D1/V1). Add
// account, transfer and account detail are later phases — every action here just shows
// a "Belum tersedia" toast until those screens exist.
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { BankCard } from '@/components/BankCard';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { showToast } from '@/components/toast-store';
import { money } from '@/core/money';
import type { AccountsOverview, AccountsOverviewAccount, AccountsOverviewGroup } from '@/domain/balances';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import {
  accountGroupLabel,
  accountsCountLabel,
  accountsEmptyBody,
  accountsEmptyTitle,
  accountsErrorMessage,
  accountsIncompleteNote,
  accountsNoLoginNote,
  accountsSummaryLabel,
  accountsTransferNote,
  addAccountLabel,
  notAvailableToast,
  retryLabel,
  tabLabel,
  transferAccountsLabel,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// TODO(Phase 5/6): Add account, Transfer between accounts and Account detail don't exist
// yet — every entry point here shows this toast instead of navigating.
function notAvailable() {
  showToast(notAvailableToast());
}

// ScreenHeader's right slot: Add account doesn't exist yet (Phase 5), so this matches
// the screen's own "Tambah akun" buttons below and just shows the same toast.
function AccountsHeaderAction() {
  return (
    <Pressable
      onPress={notAvailable}
      accessibilityRole="button"
      accessibilityLabel={addAccountLabel()}
      hitSlop={4}
      style={styles.headerAction}
    >
      <Icon name="plus" color={MonoColors.text} />
    </Pressable>
  );
}

function forexSubline(account: AccountsOverviewAccount): string | undefined {
  if (!account.pockets || account.pockets.length === 0) return undefined;
  return account.pockets.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · ');
}

function SummaryCard({ overview }: { overview: AccountsOverview }) {
  const hasForex = overview.groups.some(g => g.type === 'forex');
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <Text style={styles.summaryLabel}>{accountsSummaryLabel()}</Text>
        <Text style={styles.summaryCount}>{accountsCountLabel(overview.accountCount)}</Text>
      </View>
      <View style={styles.summaryAmountRow}>
        {hasForex && <Text style={styles.approx}>{'≈ '}</Text>}
        <Amount value={overview.netWorth} variant="displayS" style={styles.summaryAmount} />
      </View>
      {overview.incomplete && (
        <View style={styles.incompleteRow}>
          <Icon name="alert-circle" size={16} color={MonoColors.negative} />
          <Text style={styles.incompleteText}>{accountsIncompleteNote()}</Text>
        </View>
      )}
      <Text style={styles.summaryNote}>{accountsTransferNote()}</Text>
    </View>
  );
}

function AccountGroupSection({ group }: { group: AccountsOverviewGroup }) {
  return (
    <View style={styles.groupSection}>
      <View style={styles.groupHeaderRow}>
        <Text accessibilityRole="header" style={styles.groupLabel}>
          {accountGroupLabel(group.type)}
        </Text>
        <Amount value={group.subtotal} variant="figureRow" style={styles.groupSubtotal} />
      </View>
      <View style={styles.cardsList}>
        {group.accounts.map(account => (
          <BankCard
            key={account.id}
            name={account.name}
            type={account.type}
            icon={account.icon}
            balance={account.balance}
            subline={forexSubline(account)}
            variant="list"
            onPress={notAvailable}
            testID={`account-card-${account.id}`}
          />
        ))}
      </View>
    </View>
  );
}

export default function AccountsScreen() {
  const { data, isLoading, isError, refetch } = useAccountsOverview();
  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} serif={false} right={<AccountsHeaderAction />} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('accounts')} serif={false} right={<AccountsHeaderAction />} />
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
        <ScreenHeader title={tabLabel('accounts')} serif={false} right={<AccountsHeaderAction />} />
        <View style={styles.centerFill}>
          <Icon name="bank" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{accountsEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{accountsEmptyBody()}</Text>
          <Button label={addAccountLabel()} icon="plus" onPress={notAvailable} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('accounts')} serif={false} right={<AccountsHeaderAction />} />
      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard overview={data} />
        {data.groups.map(group => (
          <AccountGroupSection key={group.type} group={group} />
        ))}
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
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 28 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center' },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  summaryCard: { backgroundColor: MonoColors.card, borderRadius: 16, padding: 20, gap: 4 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  summaryAmountRow: { flexDirection: 'row', alignItems: 'baseline' },
  approx: { ...MonoText.displayS, color: MonoColors.text },
  summaryAmount: {},
  summaryCount: { ...MonoText.bodyS, color: MonoColors.textSecond },
  incompleteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  incompleteText: { ...MonoText.bodyS, color: MonoColors.negative },
  summaryNote: { ...MonoText.caption, color: MonoColors.textMeta, marginTop: 8 },

  groupSection: { gap: 12 },
  groupHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  groupSubtotal: { color: MonoColors.textSecond },
  cardsList: { gap: 16 },

  buttonRow: { flexDirection: 'columm', gap: 12 },
  buttonFlex: {   alignSelf: 'stretch' },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
});
