// Overview tab (DESIGN.md "A. Overview", PAGES.md A1/A2). The screen only composes: header,
// wave hero, Expenses/Income cards, accounts carousel, cash flow, top categories, fixed
// expenses, recent transactions, budget, goal, net worth history, where your money is.
// Every figure comes from src/domain through the hooks in src/features/overview (views
// underneath); nothing is computed here. Empty state when no accounts exist.
import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/TabBar';
import { accountShares } from '@/domain/overview';
import { defaultTransactionFilters } from '@/domain/transactionFilters';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import { AccountsCarousel } from '@/features/overview/AccountsCarousel';
import { BudgetSummaryCard, GoalCard } from '@/features/overview/BudgetGoalCards';
import { CashFlowCard } from '@/features/overview/CashFlowCard';
import { FixedExpensesCard } from '@/features/overview/FixedExpensesCard';
import { HeroSection, type HeroChange } from '@/features/overview/HeroSection';
import { MonthFlowCards } from '@/features/overview/MonthFlowCards';
import { NetWorthHistoryCard, WhereYourMoneyCard } from '@/features/overview/NetWorthCards';
import { OverviewEmpty } from '@/features/overview/OverviewEmpty';
import { OverviewHeader } from '@/features/overview/OverviewHeader';
import { OverviewTop } from '@/features/overview/OverviewTop';
import { RecentTransactionsCard } from '@/features/overview/RecentTransactionsCard';
import { TopCategoriesCard } from '@/features/overview/TopCategoriesCard';
import { useGoalProgress, useOverviewData } from '@/features/overview/useOverview';
import { useRecurringDue } from '@/features/recurring/useRecurringDue';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';
import { allAccountsLabel, overviewEmptyMessage, yourAccountsLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';

// Sample nickname from the DESIGN.md Welcome board — in a later phase this comes from a
// persistent setting (CLAUDE.md's "Optional nickname field" note on Welcome).
const NICKNAME = 'Nael';

export default function OverviewScreen() {
  const router = useRouter();
  const clearance = useTabBarClearance();
  const { data: accountsData, isLoading: accountsLoading } = useAccountsOverview();
  const { data: overview } = useOverviewData();
  const { data: recurringData } = useRecurringDue();
  const { data: budget } = useBudgetOverview(null);
  const { data: goals } = useGoalProgress();
  const monthFilter = useMemo(() => ({ ...defaultTransactionFilters(), search: '' }), []);
  const { data: txData } = useTransactionsList(monthFilter);
  const recentTxs = useMemo(() => txData?.pages[0]?.rows.slice(0, 5) ?? [], [txData]);

  const onOpenMore = useCallback(() => router.push('/more'), [router]);
  const onOpenAccount = useCallback((id: number) => router.push({ pathname: '/account/[id]', params: { id: String(id) } }), [router]);
  const onOpenAllAccounts = useCallback(() => router.push('/(tabs)/accounts'), [router]);
  const onOpenTransactions = useCallback(() => router.push('/(tabs)/transactions'), [router]);
  const onOpenBudgets = useCallback(() => router.push('/(tabs)/budgets'), [router]);
  const onOpenTx = useCallback((id: number) => router.push({ pathname: '/tx/[id]', params: { id: String(id) } }), [router]);
  const onOpenRecurring = useCallback(() => router.push('/recurring' as never), [router]);
  const onOpenReports = useCallback(() => router.push('/reports' as never), [router]);
  const onOpenGoals = useCallback(() => router.push('/goals' as never), [router]);
  const onAddAccount = useCallback(() => router.push('/account/edit' as never), [router]);
  const onAddTransaction = useCallback(() => router.push('/tx/add' as never), [router]);
  const onSetBudget = useCallback(() => router.push('/budget/edit' as never), [router]);
  const onBackup = useCallback(() => router.push('/backup' as never), [router]);

  const header = <OverviewHeader initial={NICKNAME.charAt(0).toUpperCase()} onAvatarPress={onOpenMore} />;
  // One artwork behind the header and the hero together (the logo down to the balance).
  const top = (hero: ReactNode) => (
    <OverviewTop>
      {header}
      {hero}
    </OverviewTop>
  );

  if (accountsLoading || !accountsData) {
    return <View style={styles.screen}>{top(null)}</View>;
  }

  if (accountsData.accountCount === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: clearance }]}>
          {top(<HeroSection nickname={NICKNAME} netWorth={0} note={overviewEmptyMessage()} />)}
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

  const accounts = accountsData.groups.flatMap(group => group.accounts);
  const today = new Date().toISOString().split('T')[0];
  const dueToday = recurringData?.filter(r => r.due_on === today) ?? [];
  const nextDue = recurringData?.find(r => r.due_on > today);
  const change: HeroChange | null =
    overview && overview.netWorthChange != null && overview.netWorthVsDate
      ? { amount: overview.netWorthChange, bp: overview.netWorthChangeBp, vsDate: overview.netWorthVsDate }
      : null;
  const overCategory = budget?.categories.find(c => c.is_over === 1);
  const goalTarget = goals?.find(g => g.mode === 'total_assets')?.target_amount;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: clearance }]} testID="overview-scroll">
        {top(<HeroSection nickname={NICKNAME} netWorth={accountsData.netWorth} incomplete={accountsData.incomplete} change={change} />)}

        {overview && (
          <MonthFlowCards
            period={overview.period}
            previousPeriod={overview.previousPeriod}
            month={overview.month}
            expenseChangeBp={overview.expenseChangeBp}
            incomeChangeBp={overview.incomeChangeBp}
          />
        )}

        <AccountsCarousel
          title={yourAccountsLabel()}
          linkLabel={allAccountsLabel()}
          accounts={accounts}
          onOpenAll={onOpenAllAccounts}
          onOpenAccount={onOpenAccount}
        />

        {overview && <CashFlowCard months={overview.cashFlow} />}
        <WhereYourMoneyCard shares={accountShares(accounts)} />
        {overview && <TopCategoriesCard shares={overview.topShares} onOpenReports={onOpenReports} />}

        <FixedExpensesCard dueToday={dueToday} nextDue={nextDue} onOpen={onOpenRecurring} />

        {recentTxs.length > 0 && <RecentTransactionsCard rows={recentTxs} onOpenTx={onOpenTx} onSeeAll={onOpenTransactions} />}

        {budget?.limit && <BudgetSummaryCard month={budget.month} limit={budget.limit} overCategory={overCategory} onOpen={onOpenBudgets} />}
        {goals && goals.length > 0 && <GoalCard goal={goals[0]} onOpenAll={onOpenGoals} />}

        {overview && <NetWorthHistoryCard history={overview.netWorthHistory} goalTarget={goalTarget} />}
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { gap: 24 },
});
