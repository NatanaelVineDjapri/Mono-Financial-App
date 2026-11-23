// Overview tab (DESIGN.md "A. Overview", PAGES.md A1/A2). The screen only composes: header,
// wave hero, Expenses/Income cards, accounts carousel, cash flow, top categories, fixed
// expenses, recent transactions, budget, goal, net worth history, where your money is.
// Every figure comes from src/domain through the hooks in src/features/overview (views
// underneath); nothing is computed here. Empty state when no accounts exist.
import { Redirect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DeferredMount } from '@/components/DeferredMount';
import { useTabBarClearance } from '@/components/TabBar';
import { accountShares } from '@/domain/overview';
import { defaultTransactionFilters, type TxTypeFilter } from '@/domain/transactionFilters';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import { AccountsCarousel } from '@/features/overview/AccountsCarousel';
import { BudgetSummaryCard, GoalCard } from '@/features/overview/BudgetGoalCards';
import { CashFlowCard } from '@/features/overview/CashFlowCard';
import { FixedExpensesCard } from '@/features/overview/FixedExpensesCard';
import { AnalysisBanner } from '@/features/overview/AnalysisBanner';
import { HeroSection, type HeroChange } from '@/features/overview/HeroSection';
import { NetCashFlowCard } from '@/features/overview/NetCashFlowCard';
import { QuickRecordCard } from '@/features/overview/QuickRecordCard';
import { useQuickRecords } from '@/features/overview/useQuickRecords';
import { useAvatarPose } from '@/features/profile/useAvatarPose';
import { useNeedsWelcome } from '@/features/welcome/useNeedsWelcome';
import type { QuickRecord } from '@/domain/quickRecords';
import { NetWorthHistoryCard, WhereYourMoneyCard } from '@/features/overview/NetWorthCards';
import { OverviewEmpty } from '@/features/overview/OverviewEmpty';
import { OverviewHeader } from '@/features/overview/OverviewHeader';
import { useGreeting } from '@/features/overview/useGreeting';
import { avatarInitial, useDisplayName } from '@/features/settings/useDisplayName';
import { OverviewTop } from '@/features/overview/OverviewTop';
import { RecentTransactionsCard } from '@/features/overview/RecentTransactionsCard';
import { TopCategoriesCard } from '@/features/overview/TopCategoriesCard';
import { useGoalProgress, useOverviewData } from '@/features/overview/useOverview';
import { useStatsCollapsed } from '@/features/transactions/statsStore';
import { useRecurringDue } from '@/features/recurring/useRecurringDue';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { countUnread } from '@/data/repo/notifications';
import { listRecurring } from '@/domain/recurring';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';
import { allAccountsLabel, overviewEmptyMessage, yourAccountsLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';

export default function OverviewScreen() {
  const router = useRouter();
  const needsWelcome = useNeedsWelcome();
  const avatarPose = useAvatarPose();
  const db = useDb();
  const savedName = useDisplayName();
  // No name set: the header greets without one ("Selamat pagi"); nothing is made up.
  const displayName = savedName.trim();
  const greeting = useGreeting();
  const clearance = useTabBarClearance();
  const { data: accountsData, isLoading: accountsLoading } = useAccountsOverview();
  const { data: overview } = useOverviewData();
  const { data: recurringData } = useRecurringDue();
  const { data: unreadCount } = useQuery({ queryKey: [...queryKeys.notifications, 'unread'], queryFn: () => countUnread(db), staleTime: 0 });
  const { data: recurringTemplates } = useQuery({ queryKey: [...queryKeys.recurring, 'list'], queryFn: () => listRecurring(db) });
  const { data: budget } = useBudgetOverview(null);
  const { data: goals } = useGoalProgress();
  const { data: quickRecords } = useQuickRecords();
  const monthFilter = useMemo(() => ({ ...defaultTransactionFilters(), search: '' }), []);
  const { data: txData } = useTransactionsList(monthFilter);
  const recentTxs = useMemo(() => txData?.pages[0]?.rows.slice(0, 5) ?? [], [txData]);

  const onOpenMore = useCallback(() => router.push('/more'), [router]);
  const onOpenAccount = useCallback((id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }), [router]);
  const onOpenAllAccounts = useCallback(() => router.push('/(tabs)/accounts'), [router]);
  const onOpenTransactions = useCallback(() => router.push('/(tabs)/transactions'), [router]);
  const updateTransactionFilters = useStatsCollapsed(state => state.updateFilters);
  const onOpenTransactionsForType = useCallback((type: TxTypeFilter) => {
    updateTransactionFilters({ ...defaultTransactionFilters(), type });
    router.push('/(tabs)/transactions');
  }, [router, updateTransactionFilters]);
  const onOpenBudgets = useCallback(() => router.push('/(tabs)/budgets'), [router]);
  const onOpenTx = useCallback((id: number) => router.push({ pathname: '/tx/[id]', params: { id: String(id) } }), [router]);
  const onOpenRecurring = useCallback(() => router.push('/recurring' as never), [router]);
  const onOpenReports = useCallback(() => router.push('/reports' as never), [router]);
  const onOpenGoals = useCallback(() => router.push('/goals' as never), [router]);
  const onAddAccount = useCallback(() => router.push('/account/edit' as never), [router]);
  const onAddTransaction = useCallback(() => router.push('/tx/add' as never), [router]);
  const onSetBudget = useCallback(() => router.push('/budget/edit' as never), [router]);
  const onTransfer = useCallback(() => router.push({ pathname: '/tx/add', params: { type: 'transfer' } }), [router]);
  const onScan = useCallback(() => router.push('/tx/scan' as never), [router]);
  const onOpenNotifications = useCallback(() => router.push('/notifications' as never), [router]);
  const onOpenAnalysis = useCallback(() => router.push('/analysis' as never), [router]);
  const onOpenQuickRecord = useCallback((item: QuickRecord) => {
    const params: Record<string, string> = { type: item.kind, account: String(item.accountId), amount: String(item.amount) };
    if (item.categoryId !== null) params.category = String(item.categoryId);
    if (item.source === 'place' && item.placeName) params.place = item.placeName;
    router.push({ pathname: '/tx/add', params });
  }, [router]);
  const onBackup = useCallback(() => router.push('/backup' as never), [router]);

  const header = <OverviewHeader initial={avatarInitial(displayName)} avatarPose={avatarPose} nickname={displayName} greeting={greeting} onAvatarPress={onOpenMore} onBellPress={onOpenNotifications} unreadCount={unreadCount ?? 0} />;
  // One artwork behind the header and the hero together (the logo down to the balance).
  const top = (hero: ReactNode) => (
    <OverviewTop>
      {header}
      {hero}
    </OverviewTop>
  );

  // First launch: Welcome comes first, once.
  if (needsWelcome === true) return <Redirect href={"/welcome" as never} />;

  if (accountsLoading || !accountsData) {
    return <View style={styles.screen}>{top(null)}</View>;
  }

  if (accountsData.accountCount === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: clearance }]}>
          {top(<HeroSection nickname={displayName} greeting={greeting} netWorth={0} note={overviewEmptyMessage()} />)}
          <OverviewEmpty
            onAddAccount={onAddAccount}
            onAddTransaction={onAddTransaction}
            onSetBudget={onSetBudget}
            onBackup={onBackup}
          />
        </ScrollView>
      </View>
    );
  }

  // Keep "Your accounts" in the same persisted order as the Accounts tab.
  const accounts = accountsData.accounts ?? accountsData.groups.flatMap(group => group.accounts);
  const due = recurringData ?? [];
  const change: HeroChange | null =
    overview && overview.netWorthChange != null && overview.netWorthVsDate
      ? { amount: overview.netWorthChange, bp: overview.netWorthChangeBp, vsDate: overview.netWorthVsDate }
      : null;
  const overCategory = budget?.categories.find(c => c.is_over === 1);
  const goalTarget = goals?.find(g => g.mode === 'total_assets')?.target_amount;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: clearance }]} testID="overview-scroll">
        {top(<HeroSection nickname={displayName} greeting={greeting} netWorth={accountsData.netWorth} incomplete={accountsData.incomplete} change={change} onAddTransaction={onAddTransaction} onTransfer={onTransfer} onScan={onScan} />)}

        {/* A little closer to the hero than the screen's 24 gap. */}
        <View style={styles.accountsUp}>
          <AccountsCarousel
            title={yourAccountsLabel()}
            linkLabel={allAccountsLabel()}
            accounts={accounts}
            onOpenAll={onOpenAllAccounts}
            onOpenAccount={onOpenAccount}
          />
        </View>

        {quickRecords && quickRecords.length > 0 && <QuickRecordCard items={quickRecords} onOpenRecord={onOpenQuickRecord} />}
        <AnalysisBanner onPress={onOpenAnalysis} />
        {overview && <NetCashFlowCard ranges={overview.flowRanges} onOpenTransactions={onOpenTransactionsForType} />}
        {/* The top of the screen is drawn first; the charts and lists below follow a moment later (DeferredMount). */}
        <DeferredMount>
          {overview && <CashFlowCard months={overview.cashFlow} />}
          <WhereYourMoneyCard shares={accountShares(accounts)} />
          {goals && goals.length > 0 && <GoalCard goal={goals[0]} onOpenAll={onOpenGoals} />}

          {overview && <NetWorthHistoryCard history={overview.netWorthHistory} goalTarget={goalTarget} />}
          {overview && <TopCategoriesCard shares={overview.topShares} onOpenReports={onOpenReports} />}

          <FixedExpensesCard due={due} templates={recurringTemplates ?? []} onOpen={onOpenRecurring} />
          {budget?.limit && <BudgetSummaryCard month={budget.month} limit={budget.limit} overCategory={overCategory} onOpen={onOpenBudgets} />}

          {recentTxs.length > 0 && <RecentTransactionsCard rows={recentTxs} onOpenTx={onOpenTx} onSeeAll={onOpenTransactions} />}
        </DeferredMount>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { gap: 24 },
  accountsUp: { marginTop: -10 },
});
