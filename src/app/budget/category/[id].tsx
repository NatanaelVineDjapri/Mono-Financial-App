// Category spending review (DESIGN.md "F. Budgets" Category review, PAGES.md F3,
// docs/screens "F · Category spending review"): the category's spending in the chosen
// month, its bar against the allocation, and the expenses behind it. Figures come from
// getCategoryBudgetDetail (v_budget_status, v_category_spend, v_month_budget). A row tap
// opens /tx/[id] (still a stub until Phase 5).
//
// Not built here (outside Fase 4.4's scope): the September comparison, the four-month bar
// chart (needs victory-native, not installed yet) and "Open in Transactions".
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { today } from '@/core/clock';
import { formatDayMonth, monthLabel } from '@/core/date';
import { money, rp, shown } from '@/core/money';
import type { BudgetCategoryRow } from '@/domain/budget';
import type { TxListRow } from '@/domain/transactionsList';
import { BudgetBar } from '@/features/budgets/BudgetBar';
import { useCategoryBudgetDetail } from '@/features/budgets/useBudgets';
import {
    addNamedBudgetLabel,
    backLabel,
    budgetLimitLabel,
    budgetsErrorMessage,
    categoryNotFoundMessage,
    categoryReviewTitle,
    editNamedBudgetLabel,
    expensesInCategoryLabel,
    itemsCountLabel,
    noBudgetForCategoryMessage,
    noExpensesInCategoryMessage,
    raiseBudgetNote,
    retryLabel,
    spentLabel,
    txKindLabel,
    txRowAccessibilityLabel,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function TxRow({ row, hidden, onPress }: { row: TxListRow; hidden: boolean; onPress: () => void }) {
  const title = row.description.trim() || row.category_name || txKindLabel('expense');
  const subtitle = `${row.account_name} · ${formatDayMonth(row.occurred_on)}`;
  const formatted = row.currency === 'IDR' ? rp(-row.amount, true) : money(-row.amount, row.currency, row.minor_factor, true);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={txRowAccessibilityLabel(title, subtitle, txKindLabel('expense'), shown(formatted, hidden))}
      style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
      testID={`category-tx-${row.id}`}
    >
      <View style={styles.txIcon}>
        <Icon name="receipt" size={20} color={MonoColors.textSecond} />
      </View>
      <View style={styles.txText}>
        <Text style={styles.txTitle}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>
      <View style={styles.txRight}>
        <Amount value={-row.amount} currency={row.currency} minorFactor={row.minor_factor} sign kind="expense" />
        {row.currency !== 'IDR' && <Text style={styles.caption}>{`≈ ${shown(rp(row.amount_idr), hidden)}`}</Text>}
        <Text style={styles.caption}>{txKindLabel('expense')}</Text>
      </View>
    </Pressable>
  );
}

function figuresOf(budget: BudgetCategoryRow) {
  return { spent: budget.spent, limit: budget.limit_amount, remaining: budget.remaining, overBy: budget.over_by, usedBp: budget.used_bp };
}

export default function CategoryReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(state => state.hidden);
  const params = useLocalSearchParams<{ id?: string; month?: string }>();
  const categoryId = Number(params.id);
  // Budgets always passes the month it shows; the fallback only covers a bare deep link.
  const month = params.month && MONTH_RE.test(params.month) ? params.month : today().slice(0, 7);
  const validId = Number.isInteger(categoryId) && categoryId > 0;
  const { data, isLoading, isError, refetch } = useCategoryBudgetDetail(validId ? categoryId : 0, month);

  const name = data?.category?.name;
  const openEdit = () => router.push({ pathname: '/budget/edit', params: { month, categoryId: String(categoryId) } });

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <IconButton label={backLabel()} onPress={() => router.back()} testID="category-back">
        <Icon name="chevron-left" color={MonoColors.text} />
      </IconButton>
      <Text style={styles.title} accessibilityRole="header">
        {name ? categoryReviewTitle(name, monthLabel(month)) : monthLabel(month)}
      </Text>
      {data?.budget && name && (
        <IconButton label={editNamedBudgetLabel(name)} onPress={openEdit} testID="category-edit">
          <Icon name="pencil" color={MonoColors.text} />
        </IconButton>
      )}
    </View>
  );

  if (isLoading) return <View style={styles.screen}>{header}</View>;

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Text style={styles.body}>{budgetsErrorMessage()}</Text>
          <Button label={retryLabel()} onPress={() => void refetch()} />
        </View>
      </View>
    );
  }

  if (!validId || !data.category || data.category.kind !== 'expense') {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Text style={styles.body}>{categoryNotFoundMessage()}</Text>
        </View>
      </View>
    );
  }

  const categoryName = data.category.name;
  const budget = data.budget;
  const raise = data.raise;
  const count = data.transactions.length;
  const m = (v: number) => shown(rp(v), hidden);

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.card} testID="category-summary">
          <View style={styles.cardTop}>
            <Text style={styles.capLabel}>{spentLabel()}</Text>
            {budget && <Text style={styles.meta}>{budgetLimitLabel(m(budget.limit_amount))}</Text>}
          </View>
          {/* The one serif moment on this screen: the title above is sans (titleM). */}
          <Amount value={data.spent} variant="displayS" style={styles.hero} />
          {budget ? (
            <BudgetBar subject={categoryName} figures={figuresOf(budget)} layout="category" hidden={hidden} testID="category-budget" />
          ) : (
            <Text style={styles.body}>{noBudgetForCategoryMessage(categoryName, monthLabel(month))}</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{expensesInCategoryLabel()}</Text>
          <Text style={styles.meta}>{itemsCountLabel(count)}</Text>
        </View>
        {count > 0 ? (
          <View style={styles.listCard}>
            {data.transactions.map((row, index) => (
              <View key={row.id}>
                {index > 0 && <View style={styles.divider} />}
                <TxRow row={row} hidden={hidden} onPress={() => router.push({ pathname: '/tx/[id]', params: { id: String(row.id) } })} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body} testID="category-no-expenses">
            {noExpensesInCategoryMessage(monthLabel(month))}
          </Text>
        )}

        <Button
          label={budget ? editNamedBudgetLabel(categoryName) : addNamedBudgetLabel(categoryName)}
          icon={budget ? 'pencil' : 'plus'}
          onPress={openEdit}
          testID="category-edit-button"
        />
        {raise && (
          <Text style={styles.note} testID="category-raise-note">
            {raiseBudgetNote(categoryName, m(raise.by), m(raise.total), m(raise.monthlyLimit), raise.exceedsLimit)}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: { paddingHorizontal: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  // Sizes mirror the Transactions tab (gutter 20, card radius 16, titleM section title,
  // grouped rows with 40 icons, bodyStrong/bodyS text, figureRow amounts).
  content: { paddingHorizontal: 20, gap: 16 },
  body: { ...MonoText.body, color: MonoColors.textSecond },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  note: { ...MonoText.caption, color: MonoColors.textMeta },

  card: { backgroundColor: MonoColors.card, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, gap: 4 },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12 },
  capLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  hero: { color: MonoColors.text, marginTop: 4, marginBottom: 12 },

  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, paddingTop: 8 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text },
  listCard: { backgroundColor: MonoColors.card, borderRadius: radius.md, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: MonoColors.border, marginLeft: 64 },
  txRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 12, minHeight: 48 },
  pressed: { backgroundColor: MonoColors.raised },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: MonoColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txText: { flex: 1, gap: 2 },
  txTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  txRight: { alignItems: 'flex-end', gap: 2 },
});
