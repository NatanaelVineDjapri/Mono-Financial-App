// Overview tab (DESIGN.md "A. Overview", PAGES.md A1/A2; Fase 4.6). Greeting, net worth,
// account carousel, fixed expenses, this month's summary, and recent transactions.
// Empty state (Overview-Empty) when no accounts exist.
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { BankCard } from '@/components/BankCard';
import { Button } from '@/components/Button';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { money, pct, rp, shown } from '@/core/money';
import type { TxListRow } from '@/data/repo/transactions';
import { defaultTransactionFilters } from '@/domain/transactionFilters';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useRecurringDue } from '@/features/recurring/useRecurringDue';
import { useTransactionsFilterSummary, useTransactionsList } from '@/features/transactions/useTransactionsList';
import {
  addAccountStepLabel,
  addTransactionStepLabel,
  allAccountsLabel,
  createBackupStepLabel,
  dueTodayLabel,
  expenseLabel,
  fixedExpensesLabel,
  hideAmountsLabel,
  incomeLabel,
  netLabel,
  netWorthChangeLabel,
  nextDueLabel,
  noDueExpensesMessage,
  overviewEmptyMessage,
  privacyByDesignNote,
  recentTransactionsLabel,
  recurringAccessibilityLabel,
  reviewAndRecordLabel,
  seeAllLabel,
  setBudgetStepLabel,
  setUpInFourStepsLabel,
  showAmountsLabel,
  stepsDoneLabel,
  thisMonthLabel,
  txKindLabel,
  txRowAccessibilityLabel,
  welcomeGreeting,
  yourAccountsLabel
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// Sample nickname from the DESIGN.md Welcome board — in a later phase this comes from a
// persistent setting (CLAUDE.md's "Optional nickname field" note on Welcome).
const NICKNAME = 'Nael';

// Carousel card width = 312; horizontal list gap = 16 (DESIGN.md A1); gutter stays 16 so
// the first card's left edge aligns with the screen's other content.
const CARD_WIDTH = 312;
const CARD_HEIGHT = 184;
const CARD_GAP = 16;

function txTitle(row: TxListRow): string {
  const description = row.description.trim();
  if (description) return description;
  if (row.kind === 'transfer') return txKindLabel('transfer');
  return row.category_name ?? txKindLabel(row.kind);
}

function txSubtitle(row: TxListRow): string {
  if (row.kind === 'transfer') return `${row.account_name} → ${row.to_account_name ?? ''}`;
  return `${row.category_name ?? ''} · ${row.account_name}`;
}

function TxRow({ row, hidden, onPress }: { row: TxListRow; hidden: boolean; onPress: () => void }) {
  const title = txTitle(row);
  const subtitle = txSubtitle(row);
  const kindLabel = txKindLabel(row.kind);
  const value = row.kind === 'expense' ? -row.amount : row.amount;
  const sign = row.kind !== 'transfer';
  const amountFormatted = row.currency === 'IDR' ? rp(value, sign) : money(value, row.currency, row.minor_factor, sign);
  const accessibilityLabel = txRowAccessibilityLabel(title, subtitle, kindLabel, shown(amountFormatted, hidden));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.txRow} testID={`overview-tx-${row.id}`}>
      <View style={styles.txRowLeft}>
        <Text style={styles.txRowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.txRowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.txRowRight}>
        <Amount value={value} currency={row.currency} minorFactor={row.minor_factor} sign={sign} kind={row.kind} variant="figureRow" />
      </View>
    </Pressable>
  );
}

export default function OverviewScreen() {
  const router = useRouter();
  const hidden = useHideAmounts(state => state.hidden);
  const toggleHidden = useHideAmounts(state => state.toggle);
  const { data: accountsData, isLoading: accountsLoading } = useAccountsOverview();
  const { data: recurringData } = useRecurringDue();
  const monthFilter = useMemo(() => ({ ...defaultTransactionFilters(), search: '' }), []);
  const summary = useTransactionsFilterSummary(monthFilter);
  const { data: txData } = useTransactionsList(monthFilter);
  const recentTxs = useMemo(() => txData?.pages[0]?.rows.slice(0, 5) ?? [], [txData]);

  const onToggleAmounts = useCallback(() => toggleHidden(), [toggleHidden]);
  const onOpenAccount = useCallback((id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }), [router]);
  const onOpenAllAccounts = useCallback(() => router.push('/(tabs)/accounts'), [router]);
  const onOpenTransactions = useCallback(() => router.push('/(tabs)/transactions'), [router]);
  const onOpenTx = useCallback((id: number) => router.push({ pathname: '/tx/[id]', params: { id: String(id) } }), [router]);
  const onOpenRecurring = useCallback(() => router.push('/recurring' as any), [router]);
  const onAddAccount = useCallback(() => router.push('/account/edit' as any), [router]);
  const onAddTransaction = useCallback(() => router.push('/tx/add' as any), [router]);
  const onSetBudget = useCallback(() => router.push('/budget/edit' as any), [router]);
  const onBackup = useCallback(() => router.push('/backup' as any), [router]);

  if (accountsLoading || !accountsData) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="" />
      </View>
    );
  }

  // Empty state: no accounts yet (PAGES.md A2).
  if (accountsData.accountCount === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.greeting}>{welcomeGreeting(NICKNAME)}</Text>
          <View style={styles.heroSection}>
            <Amount value={0} variant="displayL" style={styles.heroAmount} />
            <Text style={styles.emptyNote}>{overviewEmptyMessage()}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{setUpInFourStepsLabel()}</Text>
            <Text style={styles.stepsDone}>{stepsDoneLabel(0, 4)}</Text>
            <View style={styles.stepsList}>
              <Pressable onPress={onAddAccount} accessibilityRole="button" style={styles.stepRow}>
                <Icon name="bank" size={20} color={MonoColors.textSecond} />
                <Text style={styles.stepText}>{addAccountStepLabel()}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
              </Pressable>
              <Pressable onPress={onAddTransaction} accessibilityRole="button" style={styles.stepRow}>
                <Icon name="receipt" size={20} color={MonoColors.textSecond} />
                <Text style={styles.stepText}>{addTransactionStepLabel()}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
              </Pressable>
              <Pressable onPress={onSetBudget} accessibilityRole="button" style={styles.stepRow}>
                <Icon name="pie" size={20} color={MonoColors.textSecond} />
                <Text style={styles.stepText}>{setBudgetStepLabel()}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
              </Pressable>
              <Pressable onPress={onBackup} accessibilityRole="button" style={styles.stepRow}>
                <Icon name="lock" size={16} color={MonoColors.textSecond} />
                <Text style={styles.stepText}>{createBackupStepLabel()}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
              </Pressable>
            </View>
          </View>

          <View style={styles.footerRow}>
            <Icon name="lock" size={16} color={MonoColors.textMeta} />
            <Text style={styles.footerNote}>{privacyByDesignNote()}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Main Overview with data.
  const accounts = accountsData.groups.flatMap(group => group.accounts);
  const today = new Date().toISOString().split('T')[0];
  const dueToday = recurringData?.filter((r: any) => r.due_on === today) ?? [];
  const nextDue = recurringData?.find((r: any) => r.due_on > today);

  // Net worth change calculation (placeholder - would need historical data from repo)
  const netWorthChange = 0;
  const netWorthChangePct = 0;
  const vsDate = '30 Sep 2026';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>{welcomeGreeting(NICKNAME)}</Text>

        {/* Net worth hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Net worth</Text>
            <Pressable onPress={onToggleAmounts} accessibilityRole="button" style={styles.hideButton}>
              <Icon name={hidden ? 'eye-off' : 'eye'} size={16} color={MonoColors.textSecond} />
              <Text style={styles.hideButtonText}>{hidden ? showAmountsLabel() : hideAmountsLabel()}</Text>
            </Pressable>
          </View>
          <Amount value={accountsData.netWorth} variant="displayL" style={styles.heroAmount} />
          {netWorthChange !== 0 && (
            <Text style={styles.changeLabel}>
              {netWorthChangeLabel(shown(rp(netWorthChange, true), hidden), shown(pct(netWorthChangePct, true), hidden), vsDate)}
            </Text>
          )}
        </View>

        {/* Account carousel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{yourAccountsLabel()}</Text>
            <Pressable onPress={onOpenAllAccounts} accessibilityRole="button">
              <Text style={styles.seeAllLink}>{allAccountsLabel()}</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.carousel}
            testID="overview-account-carousel"
          >
            {accounts.map((account, index) => (
              <View key={account.id} style={[styles.carouselCard, index === 0 && styles.carouselCardFirst]}>
                <BankCard
                  variant="carousel"
                  name={account.name}
                  type={account.type}
                  icon={account.icon}
                  balance={account.balance}
                  subline={account.pockets?.map(p => money(p.balance, p.currency, p.minorFactor)).join(' · ')}
                  onPress={() => onOpenAccount(account.id)}
                  testID={`overview-account-${account.id}`}
                />
              </View>
            ))}
          </ScrollView>
          {/* Dot indicators */}
          <View style={styles.indicators}>
            {accounts.map((_, index) => (
              <View key={index} style={[styles.indicator, index === 0 && styles.indicatorActive]} />
            ))}
          </View>
        </View>

        {/* Fixed expenses */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{fixedExpensesLabel()}</Text>
          {dueToday.length === 0 && !nextDue ? (
            <Text style={styles.emptyText}>{noDueExpensesMessage()}</Text>
          ) : (
            <>
              {dueToday.map(due => (
                <Pressable
                  key={due.recurring_id}
                  onPress={onOpenRecurring}
                  accessibilityRole="button"
                  accessibilityLabel={recurringAccessibilityLabel(due.name, dueTodayLabel(), shown(rp(due.amount), hidden))}
                  style={styles.recurringRow}
                  testID={`overview-recurring-${due.recurring_id}`}
                >
                  <View style={styles.recurringLeft}>
                    <Text style={styles.recurringName}>{due.name}</Text>
                    <Text style={styles.recurringDue}>{dueTodayLabel()}</Text>
                  </View>
                  <View style={styles.recurringRight}>
                    <Amount value={due.amount} variant="figureRow" />
                    <Button label={reviewAndRecordLabel()} variant="secondary" onPress={onOpenRecurring} style={styles.recurringButton} />
                  </View>
                </Pressable>
              ))}
              {nextDue && (
                <Text style={styles.nextDue}>
                  {nextDueLabel(nextDue.name, nextDue.due_on, shown(rp(nextDue.amount), hidden))}
                </Text>
              )}
            </>
          )}
        </View>

        {/* This month summary */}
        {summary.data && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{thisMonthLabel()}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{incomeLabel()}</Text>
              <Amount value={summary.data.summary.income} sign variant="figureRow" kind="income" />
            </View>
            <View style={[styles.summaryRow, styles.summaryRowBorder]}>
              <Text style={styles.summaryLabel}>{expenseLabel()}</Text>
              <Amount value={-summary.data.summary.expense} sign variant="figureRow" kind="expense" />
            </View>
            <View style={[styles.summaryRow, styles.summaryRowBorder]}>
              <Text style={[styles.summaryLabel, styles.summaryLabelNet]}>{netLabel()}</Text>
              <Amount value={summary.data.summary.net} sign variant="figureRow" kind={summary.data.summary.net < 0 ? 'expense' : 'income'} style={styles.summaryNet} />
            </View>
          </View>
        )}

        {/* Recent transactions */}
        {recentTxs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{recentTransactionsLabel()}</Text>
              <Pressable onPress={onOpenTransactions} accessibilityRole="button">
                <Text style={styles.seeAllLink}>{seeAllLabel()}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {recentTxs.map((tx, index) => (
                <View key={tx.id}>
                  <TxRow row={tx} hidden={hidden} onPress={() => onOpenTx(tx.id)} />
                  {index < recentTxs.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 24 },
  greeting: { ...MonoText.titleM, color: MonoColors.text, marginTop: 8 },

  heroSection: { gap: 8 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  hideButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  hideButtonText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  heroAmount: { color: MonoColors.text },
  changeLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
  emptyNote: { ...MonoText.body, color: MonoColors.textSecond },

  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text },
  seeAllLink: { ...MonoText.bodyS, color: MonoColors.text },

  carousel: { paddingRight: 16, gap: CARD_GAP },
  carouselCard: { width: CARD_WIDTH, height: CARD_HEIGHT },
  carouselCardFirst: { marginLeft: 0 },
  indicators: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  indicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: MonoColors.border },
  indicatorActive: { backgroundColor: MonoColors.text },

  card: {
    backgroundColor: MonoColors.card,
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
  },
  cardTitle: { ...MonoText.titleM, color: MonoColors.text },
  emptyText: { ...MonoText.bodyS, color: MonoColors.textSecond },

  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  recurringLeft: { flex: 1, gap: 4 },
  recurringName: { ...MonoText.bodyStrong, color: MonoColors.text },
  recurringDue: { ...MonoText.caption, color: MonoColors.textMeta },
  recurringRight: { alignItems: 'flex-end', gap: 8 },
  recurringButton: { minWidth: 120 },
  nextDue: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingTop: 4 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  summaryLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  summaryLabelNet: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  summaryNet: { fontFamily: MonoText.bodyStrong.fontFamily },

  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },
  txRowLeft: { flex: 1, gap: 4 },
  txRowTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  txRowSubtitle: { ...MonoText.bodyS, color: MonoColors.textSecond },
  txRowRight: { alignItems: 'flex-end' },
  txDivider: { height: 1, backgroundColor: MonoColors.border },

  stepsList: { gap: 4 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  stepText: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  stepsDone: { ...MonoText.bodyS, color: MonoColors.textSecond },

  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
});
