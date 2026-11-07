// Budgets tab (DESIGN.md "F. Budgets", PAGES.md F1, docs/screens "F · Budgets"). Spent,
// remaining and every share come from the views through src/domain/budget.ts; nothing
// here adds money up. Over a limit the bar stays full with a striped red overflow and the
// words "Over by Rp…" — red marks only the amount over (BudgetBar).
//
// Type: the hero total is Newsreader (displayS), the same family as the serif screen
// title, per the board and the owner's call (Fase 4.4) — Budgets joins Accounts and
// Overview as a screen that pairs a serif title with a serif hero number. Every other
// size follows the Transactions tab (gutter 20, card radius 16, titleM section titles,
// bodyStrong/bodyS rows, figureRow row amounts, figureS summary values).
//
// Header: serif title left; on the right the month chip (opens the month sheet) and the
// edit-limit button, both HeaderButton — the same style as Transactions' Filters button.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTabBarVisibility } from '@/components/tab-bar-visibility-store';
import { monthLabel, monthName, monthShortLabel } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { BudgetCategoryRow, BudgetMonthRow, BudgetOverview } from '@/domain/budget';
import { BudgetBar, budgetBarLabel, type BudgetFigures } from '@/features/budgets/BudgetBar';
import { MonthSheet } from '@/features/budgets/MonthSheet';
import { useBudgetOverview } from '@/features/budgets/useBudgets';
import {
    addBudgetLabel,
    addCategoryBudgetLabel,
    availablePerDayLabel,
    budgetLimitLabel,
    budgetRowAccessibilityLabel,
    budgetsEmptyBody,
    budgetsEmptyTitle,
    budgetsErrorMessage,
    budgetsFootnote,
    budgetsTotalSpentLabel,
    byCategoryLabel,
    daysLeftInLabel,
    editMonthlyLimitLabel,
    monthChipAccessibilityLabel,
    monthTotalSubject,
    mostUsedFirstLabel,
    noCategoryBudgetsYet,
    ofLimitLabel,
    retryLabel,
    reviewSpendingByCategoryLabel,
    tabLabel
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function monthFigures(limit: BudgetMonthRow): BudgetFigures {
  return { spent: limit.total_spent, limit: limit.monthly_limit, remaining: limit.remaining, overBy: limit.over_by, usedBp: limit.used_bp };
}

function categoryFigures(row: BudgetCategoryRow): BudgetFigures {
  return { spent: row.spent, limit: row.limit_amount, remaining: row.remaining, overBy: row.over_by, usedBp: row.used_bp };
}

function InfoRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.infoRow} testID={testID}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MonthCard({ overview, limit, hidden }: { overview: BudgetOverview; limit: BudgetMonthRow; hidden: boolean }) {
  return (
    <View style={styles.card} testID="budget-month-card">
      <View style={styles.cardTop}>
        <Text style={styles.capLabel}>{budgetsTotalSpentLabel()}</Text>
        <Text style={styles.meta}>{budgetLimitLabel(shown(rp(limit.monthly_limit), hidden))}</Text>
      </View>
      <Amount value={limit.total_spent} variant="displayS" style={styles.hero} />
      <BudgetBar subject={monthTotalSubject(monthLabel(overview.month))} figures={monthFigures(limit)} layout="month" hidden={hidden} testID="budget-month" />
      {overview.daysLeft !== null && (
        <View style={styles.infoRows}>
          <InfoRow label={daysLeftInLabel(monthName(overview.month))} value={String(overview.daysLeft)} testID="budget-days-left" />
          {overview.availablePerDay !== null && (
            <InfoRow label={availablePerDayLabel()} value={shown(rp(overview.availablePerDay), hidden)} testID="budget-per-day" />
          )}
        </View>
      )}
    </View>
  );
}

function CategoryRow({ row, hidden, onPress }: { row: BudgetCategoryRow; hidden: boolean; onPress: () => void }) {
  const figures = categoryFigures(row);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={budgetRowAccessibilityLabel(budgetBarLabel(row.category, figures, 'category', hidden))}
      style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
      testID={`budget-row-${row.category_id}`}
    >
      <View style={styles.categoryTop}>
        <View style={styles.categoryIcon}>
          <Icon name="receipt" size={20} color={MonoColors.textSecond} />
        </View>
        <View style={styles.categoryText}>
          <Text style={styles.categoryName}>{row.category}</Text>
          <Text style={styles.meta}>{ofLimitLabel(shown(rp(row.limit_amount), hidden))}</Text>
        </View>
        <Amount value={row.spent} variant="figureRow" />
      </View>
      <BudgetBar subject={row.category} figures={figures} layout="category" hidden={hidden} testID={`budget-category-${row.category_id}`} />
    </Pressable>
  );
}

export default function BudgetsScreen() {
  const router = useRouter();
  const hidden = useHideAmounts(state => state.hidden);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useBudgetOverview(selectedMonth);
  const month = data?.month;

  // The month sheet is drawn inside this screen, under the tab bar the navigator renders
  // on its own — hide the bar while it is open (same as Transactions' Filters sheet), and
  // always restore it when leaving.
  const setTabBarHidden = useTabBarVisibility(state => state.setHidden);
  useEffect(() => {
    setTabBarHidden(monthSheetOpen);
    return () => setTabBarHidden(false);
  }, [monthSheetOpen, setTabBarHidden]);

  const chooseMonth = useCallback((next: string) => {
    setSelectedMonth(next);
    setMonthSheetOpen(false);
  }, []);

  const openLimit = useCallback(() => {
    if (month) router.push({ pathname: '/budget/edit', params: { month, mode: 'limit' } });
  }, [router, month]);
  // Without a monthly limit every category budget would be over it, so "add" starts by
  // setting the limit (the triggers require the limit to cover the budgets).
  const hasLimit = !!data?.limit;
  const openAdd = useCallback(() => {
    if (month) router.push({ pathname: '/budget/edit', params: hasLimit ? { month } : { month, mode: 'limit' } });
  }, [router, month, hasLimit]);
  const openCategory = useCallback(
    (categoryId: number) => {
      if (month) router.push({ pathname: '/budget/category/[id]', params: { id: String(categoryId), month } });
    },
    [router, month],
  );

  const header = (
    <ScreenHeader
      title={tabLabel('budgets')}
      style={styles.header}
      testID="budgets-header"
      right={
        <>
          {!!month && (
            <HeaderButton
              icon="chevron-down"
              text={monthShortLabel(month)}
              label={monthChipAccessibilityLabel(monthLabel(month))}
              onPress={() => setMonthSheetOpen(true)}
              testID="budget-month-chip"
            />
          )}
          <HeaderButton icon="pencil" label={editMonthlyLimitLabel()} onPress={openLimit} disabled={!month} testID="budget-edit-limit" />
        </>
      }
    />
  );

  if (isLoading) return <View style={styles.screen}>{header}</View>;

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{budgetsErrorMessage()}</Text>
          <Button label={retryLabel()} onPress={() => void refetch()} />
        </View>
      </View>
    );
  }

  const monthSheet = (
    <MonthSheet
      visible={monthSheetOpen}
      months={data.months}
      selected={data.month}
      onSelect={chooseMonth}
      onClose={() => setMonthSheetOpen(false)}
    />
  );

  if (data.isEmpty) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill} testID="budgets-empty">
          <Icon name="pie" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{budgetsEmptyTitle(monthLabel(data.month))}</Text>
          <Text style={styles.emptyBody}>{budgetsEmptyBody()}</Text>
          <Button label={addBudgetLabel()} icon="plus" onPress={openAdd} />
        </View>
        {monthSheet}
      </View>
    );
  }

  const topCategory = data.categories[0];

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} testID="budgets-scroll">
        {data.limit && <MonthCard overview={data} limit={data.limit} hidden={hidden} />}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{byCategoryLabel()}</Text>
          {data.categories.length > 1 && <Text style={styles.meta}>{mostUsedFirstLabel()}</Text>}
        </View>
        {data.categories.length > 0 ? (
          <View style={styles.listCard}>
            {data.categories.map((row, index) => (
              <View key={row.budget_id}>
                {index > 0 && <View style={styles.divider} />}
                <CategoryRow row={row} hidden={hidden} onPress={() => openCategory(row.category_id)} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyBody}>{noCategoryBudgetsYet()}</Text>
        )}

        <Text style={styles.footnote}>{budgetsFootnote()}</Text>
        <View style={styles.buttons}>
          <Button label={addCategoryBudgetLabel()} icon="plus" onPress={openAdd} />
          {topCategory && (
            <Button label={reviewSpendingByCategoryLabel()} variant="secondary" onPress={() => openCategory(topCategory.category_id)} />
          )}
        </View>
      </ScrollView>
      {monthSheet}
    </View>
  );
}

// Sizes mirror src/app/(tabs)/transactions.tsx and StatsSection.tsx (summary card,
// grouped rows) so the two tabs read as one app.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  // Right padding 16 for the two header buttons. The gap from the header to the Total spent
  // card is ScreenHeader's own 16, the same as Accounts' card.
  header: { paddingRight: 16 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center' },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  card: { backgroundColor: MonoColors.card, borderRadius: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, gap: 4 },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12 },
  capLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  hero: { color: MonoColors.text, marginTop: 4, marginBottom: 12 },
  infoRows: { marginTop: 12 },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
  },
  infoLabel: { ...MonoText.body, color: MonoColors.textSecond, flexShrink: 1 },
  infoValue: { ...MonoText.figureS, color: MonoColors.text },

  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, paddingTop: 8 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text },
  listCard: { backgroundColor: MonoColors.card, borderRadius: radius.md, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: MonoColors.border },
  categoryRow: { paddingVertical: 12, paddingHorizontal: 12, gap: 10 },
  pressed: { backgroundColor: MonoColors.raised },
  categoryTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: MonoColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { flex: 1, minWidth: 120, gap: 2 },
  categoryName: { ...MonoText.bodyStrong, color: MonoColors.text },

  footnote: { ...MonoText.caption, color: MonoColors.textMeta },
  buttons: { gap: 12 },
});
