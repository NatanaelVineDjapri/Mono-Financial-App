// Transactions tab (DESIGN.md "B. Transactions", PAGES.md B1). Tx-Filters applies a
// draft stored beside the Transactions statistics UI state.
// /tx/[id] and /ai-chat are stub routes until the detail and chat screens exist.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Fab } from '@/components/Fab';
import { FilterSheet } from '@/components/FilterSheet';
import { HeaderButton } from '@/components/HeaderButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented, type SegmentedOption } from '@/components/Segmented';
import { useTabBarVisibility } from '@/components/tab-bar-visibility-store';
import { TAB_BAR_ZONE_PADDING_TOP } from '@/components/TabBar';
import { formatDayHeader, formatShortDate } from '@/core/date';
import { money, rp, shown } from '@/core/money';
import { activeTransactionFilterCount } from '@/domain/transactionFilters';
import type { DailyTotalRow, TransactionsPage, TxListRow } from '@/domain/transactionsList';
import { StatsSection } from '@/features/transactions/StatsSection';
import { useStatsCollapsed } from '@/features/transactions/statsStore';
import { useTransactionFilterOptions } from '@/features/transactions/useTransactionFilterOptions';
import { useTransactionsFilterSummary, useTransactionsList } from '@/features/transactions/useTransactionsList';
import {
  comingSoonMessage,
  filtersActiveAccountLabel,
  filtersActiveBadgeLabel,
  filtersActiveCategoryLabel,
  filtersActiveDateLabel,
  filtersActiveMaxAmountLabel,
  filtersActiveMinAmountLabel,
  filtersActiveTypeLabel,
  filtersBadgeValue,
  filtersButtonAccessibilityLabel,
  monthExpenseLabel,
  netLabel,
  recordViaChatLabel,
  removeFilterAccessibilityLabel,
  resetSearchLabel,
  searchPlaceholder,
  tabLabel,
  transactionsCountLabel,
  transactionsEmptyBody,
  transactionsEmptyTitle,
  txKindLabel,
  txRowAccessibilityLabel,
  txTypeChipLabel,
  unknownFilterOptionLabel,
  type TxTypeFilter,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TYPE_OPTIONS: SegmentedOption[] = (['all', 'income', 'expense', 'transfer'] as TxTypeFilter[]).map(value => ({
  value,
  label: txTypeChipLabel(value),
}));

const FAB_SIZE = 56; // matches Fab.tsx's own (unexported) SIZE constant
const FAB_GAP = -40; // clearance between the FAB and the tab bar's visible top edge
// The FAB floats inside this screen, and the screen ends where the tab bar begins: the tab
// navigator lays the bar out below its screens instead of over them. The bar's own height
// and the bottom safe-area inset are therefore already outside this view and must not be
// added to `bottom`. What remains is the empty strip at the top of the bar's box, above its
// visible edge; it counts toward FAB_GAP. The list's end padding follows the FAB's top edge
// (FAB_SIZE + FAB_BOTTOM) so the last row can always scroll clear of the button.

const FAB_LIFT = 56;

const FAB_BOTTOM = Math.max(
  0,
  FAB_GAP + FAB_LIFT - TAB_BAR_ZONE_PADDING_TOP
);

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function FilterButton({ onPress, activeCount }: { onPress: () => void; activeCount: number }) {
  return (
    <HeaderButton
      icon="filter"
      label={filtersButtonAccessibilityLabel(activeCount)}
      badge={activeCount > 0 ? filtersBadgeValue(activeCount) : undefined}
      onPress={onPress}
      testID="transactions-filters-button"
    />
  );
}

function ActiveFilterChip({ label, onRemove, testID }: { label: string; onRemove: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityState={{ selected: true }}
      accessibilityLabel={removeFilterAccessibilityLabel(label)}
      style={styles.activeFilterChip}
      testID={testID}
    >
      <Text style={styles.activeFilterText}>{label}</Text>
      <Icon name="close" size={16} color={MonoColors.bg} />
    </Pressable>
  );
}

function SearchField({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.searchBox}>
      <Icon name="search" size={16} color={MonoColors.textSecond} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={searchPlaceholder()}
        placeholderTextColor={MonoColors.textDisabled}
        style={styles.searchInput}
        accessibilityLabel={searchPlaceholder()}
        testID="transactions-search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel={resetSearchLabel()} hitSlop={8}>
          <Icon name="close" size={16} color={MonoColors.textSecond} />
        </Pressable>
      )}
    </View>
  );
}

function txTitle(row: TxListRow): string {
  const description = row.description.trim();
  if (description) return description;
  if (row.kind === 'transfer') return txKindLabel('transfer');
  return row.category_name ?? txKindLabel(row.kind);
}

// No date here (Fase 4.3a fix): every row already sits under a day header that states
// it. A view that ever lists rows without a day header (e.g. a future ungrouped search
// view) would need its own date back in the subtitle — this one is always grouped.
function txSubtitle(row: TxListRow): string {
  if (row.kind === 'transfer') return `${row.account_name} → ${row.to_account_name ?? ''}`;
  return `${row.category_name ?? ''} · ${row.account_name}`;
}

// Generic by kind, not yet per-category (no icon library reference for the 14 category
// names yet — this is a known gap, flagged where the Transactions tab build is reported).
function txIcon(row: TxListRow): IconName {
  if (row.kind === 'transfer') return 'transfer';
  return row.kind === 'income' ? 'wallet' : 'receipt';
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.row} testID={`tx-row-${row.id}`}>
      <View style={styles.rowIcon}>
        <Icon name={txIcon(row)} size={20} color={MonoColors.textSecond} />
      </View>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Amount value={value} currency={row.currency} minorFactor={row.minor_factor} sign={sign} kind={row.kind} variant="figureRow" />
        {row.currency !== 'IDR' && <Text style={styles.approxIdr}>{`≈ ${shown(rp(row.amount_idr), hidden)}`}</Text>}
        <Text style={styles.rowKindLabel}>{kindLabel}</Text>
      </View>
    </Pressable>
  );
}

function groupByDay(rows: TxListRow[]): { date: string; rows: TxListRow[] }[] {
  const order: string[] = [];
  const byDate = new Map<string, TxListRow[]>();
  for (const row of rows) {
    if (!byDate.has(row.occurred_on)) {
      byDate.set(row.occurred_on, []);
      order.push(row.occurred_on);
    }
    byDate.get(row.occurred_on)!.push(row);
  }
  return order.map(date => ({ date, rows: byDate.get(date)! }));
}

function DaySection({
  date,
  rows,
  daily,
  hidden,
  onPressRow,
}: {
  date: string;
  rows: TxListRow[];
  daily?: DailyTotalRow;
  hidden: boolean;
  onPressRow: (id: number) => void;
}) {
  return (
    <View style={styles.daySection}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayDate}>{formatDayHeader(date)}</Text>
        {/* Neutral grey, not coloured by sign — only the month's own Net and each row's
            own amount carry income/expense colour (DESIGN.md: colour marks a figure the
            reader acts on, not every running subtotal). A day with only transfers has
            income=expense=0 (a `daily` row only exists for a day with at least one
            transaction, so this can't also mean "no transactions") — showing "Rp0" there
            would misread as an actual zero day rather than "nothing counted today". */}
        {!!daily && (daily.income !== 0 || daily.expense !== 0) && (
          <Text style={styles.dayTotal}>{shown(rp(daily.net, true), hidden)}</Text>
        )}
      </View>
      <View style={styles.dayCard}>
        {rows.map((row, index) => (
          <View key={row.id}>
            <TxRow row={row} hidden={hidden} onPress={() => onPressRow(row.id)} />
            {index < rows.length - 1 && <View style={styles.rowDivider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthSection({
  page,
  hidden,
  expanded,
  onToggle,
  onPressRow,
}: {
  page: TransactionsPage;
  hidden: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPressRow: (id: number) => void;
}) {
  const days = useMemo(() => groupByDay(page.rows), [page.rows]);
  const dailyByDate = useMemo(() => new Map(page.daily.map(d => [d.occurred_on, d])), [page.daily]);

  if (!expanded) {
    return (
      <Pressable onPress={onToggle} accessibilityRole="button" style={styles.collapsedMonth} testID={`month-${page.period}`}>
        <Text style={styles.monthLabel}>{page.monthLabel}</Text>
        <Text style={styles.collapsedExpense}>{shown(monthExpenseLabel(rp(page.summary.expense)), hidden)}</Text>
      </Pressable>
    );
  }

  return (
    <View testID={`month-${page.period}`}>
      <Pressable onPress={onToggle} accessibilityRole="button" style={styles.monthHeader}>
        <Text style={styles.monthLabel}>{page.monthLabel}</Text>
        <View style={styles.monthNet}>
          <Text style={styles.monthNetLabel}>{netLabel()} </Text>
          <Amount value={page.summary.net} sign kind={page.summary.net < 0 ? 'expense' : 'income'} variant="figureRow" style={styles.monthNetValue} />
        </View>
      </Pressable>
      {days.map(day => (
        <DaySection key={day.date} date={day.date} rows={day.rows} daily={dailyByDate.get(day.date)} hidden={hidden} onPressRow={onPressRow} />
      ))}
    </View>
  );
}

export default function TransactionsScreen() {
  const router = useRouter();
  const hidden = useHideAmounts(state => state.hidden);
  const filters = useStatsCollapsed(state => state.filters);
  const draftFilters = useStatsCollapsed(state => state.draftFilters);
  const startFilterEdit = useStatsCollapsed(state => state.startFilterEdit);
  const updateDraftFilters = useStatsCollapsed(state => state.updateDraftFilters);
  const resetDraftFilters = useStatsCollapsed(state => state.resetDraftFilters);
  const applyDraftFilters = useStatsCollapsed(state => state.applyDraftFilters);
  const discardDraftFilters = useStatsCollapsed(state => state.discardDraftFilters);
  const resetAppliedFilters = useStatsCollapsed(state => state.resetFilters);
  const updateFilters = useStatsCollapsed(state => state.updateFilters);
  const toggleCategoryFilter = useStatsCollapsed(state => state.toggleCategoryFilter);
  const removeAccountFilter = useStatsCollapsed(state => state.removeAccountFilter);
  const removeCategoryFilter = useStatsCollapsed(state => state.removeCategoryFilter);
  const removeMinAmountFilter = useStatsCollapsed(state => state.removeMinAmountFilter);
  const removeMaxAmountFilter = useStatsCollapsed(state => state.removeMaxAmountFilter);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => new Set());
  const filterOptions = useTransactionFilterOptions();

  const listFilter = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const previewFilter = useMemo(() => ({ ...draftFilters, search: debouncedSearch }), [draftFilters, debouncedSearch]);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useTransactionsList(listFilter);
  const summary = useTransactionsFilterSummary(listFilter);
  const preview = useTransactionsFilterSummary(previewFilter);
  const pages = data?.pages ?? [];
  const firstPage = pages[0];
  const activeFilterCount = activeTransactionFilterCount(filters);
  const typeFilter = filters.type;

  // The open Filter sheet (a modal overlay drawn inside this screen, not a separate
  // route) sits above this screen's own content but not above the tab bar, which the
  // navigator renders independently — so it must be hidden explicitly while picking
  // filters, and restored the moment the sheet closes and the (possibly filtered)
  // results show again, whether or not any filter is still applied. The effect's
  // cleanup always restores it too, so leaving this tab never leaves the bar hidden
  // on another one.
  const setTabBarHidden = useTabBarVisibility(state => state.setHidden);
  useEffect(() => {
    setTabBarHidden(filterSheetOpen);
    return () => setTabBarHidden(false);
  }, [filterSheetOpen, setTabBarHidden]);

  const accountsById = useMemo(() => new Map(filterOptions.accounts.map(account => [account.id, account.name])), [filterOptions.accounts]);
  const categoriesById = useMemo(() => new Map(filterOptions.categories.map(category => [category.id, category.name])), [filterOptions.categories]);

  const togglePeriod = useCallback((period: string) => {
    setExpandedPeriods(previous => {
      const next = new Set(previous);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }, []);

  const openFilterSheet = useCallback(() => {
    startFilterEdit();
    setFilterSheetOpen(true);
  }, [startFilterEdit]);
  const closeFilterSheet = useCallback(() => {
    discardDraftFilters();
    setFilterSheetOpen(false);
  }, [discardDraftFilters]);
  const applyFilters = useCallback(() => {
    applyDraftFilters();
    setFilterSheetOpen(false);
  }, [applyDraftFilters]);
  const onPressRow = useCallback((id: number) => router.push({ pathname: '/tx/[id]', params: { id: String(id) } }), [router]);
  const resetFilters = useCallback(() => {
    setSearchInput('');
    resetAppliedFilters();
  }, [resetAppliedFilters]);
  const onSelectCategory = useCallback((id: number) => {
    // "Others" is synthetic and cannot map to a transaction category_id.
    if (id > 0) toggleCategoryFilter(id);
  }, [toggleCategoryFilter]);
  const onChangeTypeFilter = useCallback((value: TxTypeFilter) => {
    updateFilters({ type: value });
  }, [updateFilters]);

  if (isLoading || summary.isLoading || !firstPage || !summary.data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('transactions')} right={<FilterButton onPress={openFilterSheet} activeCount={activeFilterCount} />} />
        {(isError || summary.isError) && <Text style={styles.errorText}>{comingSoonMessage()}</Text>}
      </View>
    );
  }

  const filtered = activeFilterCount > 0 || debouncedSearch.trim() !== '';
  const noResults = filtered && summary.data.count === 0;
  const rangeLabel = `${formatShortDate(summary.data.range.startDate)}–${formatShortDate(summary.data.range.endDate)}`;
  const selectedCategoryId = filters.categoryIds.length === 1 ? filters.categoryIds[0] : undefined;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('transactions')} right={<FilterButton onPress={openFilterSheet} activeCount={activeFilterCount} />} />
      <View style={styles.toolbar}>
        <Text style={styles.subtitle}>{transactionsCountLabel(summary.data.count, rangeLabel)}</Text>
        <SearchField value={searchInput} onChangeText={setSearchInput} />
        <Segmented
          testID="tx-type-segmented"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={value => onChangeTypeFilter(value as TxTypeFilter)}
        />
      </View>

      {activeFilterCount > 0 && (
        <View style={styles.activeFilters} accessibilityLabel={filtersActiveBadgeLabel(activeFilterCount)}>
          {filters.datePreset !== 'this-month' && (
            <ActiveFilterChip
              label={filtersActiveDateLabel(rangeLabel)}
              onRemove={() => updateFilters({ datePreset: 'this-month', customStart: undefined, customEnd: undefined })}
              testID="active-filter-date"
            />
          )}
          {filters.type !== 'all' && (
            <ActiveFilterChip
              label={filtersActiveTypeLabel(filters.type)}
              onRemove={() => updateFilters({ type: 'all' })}
              testID="active-filter-type"
            />
          )}
          {filters.accountIds.map(accountId => {
            const name = accountsById.get(accountId) ?? unknownFilterOptionLabel(accountId);
            return (
              <ActiveFilterChip
                key={`account-${accountId}`}
                label={filtersActiveAccountLabel(name)}
                onRemove={() => removeAccountFilter(accountId)}
                testID={`active-filter-account-${accountId}`}
              />
            );
          })}
          {filters.categoryIds.map(categoryId => {
            const name = categoriesById.get(categoryId) ?? unknownFilterOptionLabel(categoryId);
            return (
              <ActiveFilterChip
                key={`category-${categoryId}`}
                label={filtersActiveCategoryLabel(name)}
                onRemove={() => removeCategoryFilter(categoryId)}
                testID={`active-filter-category-${categoryId}`}
              />
            );
          })}
          {filters.minAmount != null && (
            <ActiveFilterChip
              label={filtersActiveMinAmountLabel(rp(filters.minAmount))}
              onRemove={removeMinAmountFilter}
              testID="active-filter-min-amount"
            />
          )}
          {filters.maxAmount != null && (
            <ActiveFilterChip
              label={filtersActiveMaxAmountLabel(rp(filters.maxAmount))}
              onRemove={removeMaxAmountFilter}
              testID="active-filter-max-amount"
            />
          )}
        </View>
      )}

      {noResults ? (
        <View style={styles.centerFill}>
          <Icon name="search" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{transactionsEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{transactionsEmptyBody()}</Text>
          <Button label={resetSearchLabel()} variant="secondary" onPress={resetFilters} />
        </View>
      ) : (
        <FlatList
          testID="transactions-list"
          data={pages}
          keyExtractor={item => item.period}
          ListHeaderComponent={
            <StatsSection
              summary={summary.data.summary}
              filter={summary.data.repoFilter}
              limitPeriod={summary.data.isLimitMode ? summary.data.currentPeriod : undefined}
              hidden={hidden}
              typeFilter={typeFilter}
              rangeLabel={rangeLabel}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
            />
          }
          renderItem={({ item, index }) => (
            <MonthSection
              page={item}
              hidden={hidden}
              expanded={index === 0 || expandedPeriods.has(item.period)}
              onToggle={() => togglePeriod(item.period)}
              onPressRow={onPressRow}
            />
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={[styles.listContent, { paddingBottom: FAB_SIZE + FAB_BOTTOM }]}
        />
      )}

      <View style={styles.fab}>
        <Fab label={recordViaChatLabel()} onPress={() => router.push('/ai-chat')}>
          <Icon name="plus" size={20} color={MonoColors.bg} />
        </Fab>
      </View>

      <FilterSheet
        visible={filterSheetOpen}
        filters={draftFilters}
        range={preview.data?.range ?? summary.data.range}
        accounts={filterOptions.accounts.map(account => ({ id: account.id, name: account.name }))}
        categories={filterOptions.categories.map(category => ({ id: category.id, name: category.name }))}
        resultCount={preview.data?.count ?? summary.data.count}
        resultCountLoading={preview.isLoading}
        onChange={updateDraftFilters}
        onReset={resetDraftFilters}
        onClose={closeFilterSheet}
        onApply={applyFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center', marginTop: 24 },
  toolbar: { paddingHorizontal: 20, gap: 12, paddingBottom: 12 },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  activeFilterChip: {
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: MonoColors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  activeFilterText: { ...MonoText.bodyS, color: MonoColors.bg, flexShrink: 1 },
  subtitle: { ...MonoText.bodyS, color: MonoColors.textSecond },
  searchBox: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, ...MonoText.body, color: MonoColors.text },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  listContent: { paddingHorizontal: 20, paddingBottom: 96, gap: 20 },

  summaryCard: { backgroundColor: MonoColors.card, borderRadius: 16, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  summaryLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  // 600 weight — borrows bodyStrong's font family (CLAUDE.md: one font family per
  // weight on Android, so this can't be a plain fontWeight override) while keeping
  // label's own size/tracking/case.
  summaryLabelNet: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  summaryValueWrap: { flex: 1, alignItems: 'flex-end' },
  summaryValueNet: { fontFamily: MonoText.bodyStrong.fontFamily },
  transferNote: { ...MonoText.caption, color: MonoColors.textMeta, paddingTop: 12 },

  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  monthLabel: { ...MonoText.titleM, color: MonoColors.text },
  monthNet: { flexDirection: 'row', alignItems: 'baseline' },
  monthNetLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
  // Same size as a row's own amount (figureRow, 14). Pinned here because Amount shrinks
  // long figureRow text for the narrow row column, and this header has room to spare.
  monthNetValue: { fontSize: MonoText.figureRow.fontSize },
  collapsedMonth: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
  },
  collapsedExpense: { ...MonoText.bodyS, color: MonoColors.textSecond },

  daySection: { gap: 4, marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  dayDate: { ...MonoText.bodyS, color: MonoColors.textMeta },
  dayTotal: { ...MonoText.bodyS, color: MonoColors.textMeta },
  dayCard: {
    backgroundColor: MonoColors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: 48,
  },
  rowDivider: {
    height: 1,
    backgroundColor: MonoColors.border,
    marginLeft: 64, // offset by icon + gap (40 + 12 + 12)
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: MonoColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLeft: { flex: 1, gap: 2 },
  rowTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  rowSubtitle: { ...MonoText.bodyS, color: MonoColors.textSecond },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  approxIdr: { ...MonoText.caption, color: MonoColors.textMeta },
  rowKindLabel: { ...MonoText.caption, color: MonoColors.textMeta },

  // Pinned to the screen, not inside the list: it never scrolls with the content and is
  // always shown at full size. FAB_BOTTOM is where it sits above the tab bar.
  fab: { position: 'absolute', right: 20, bottom: FAB_BOTTOM },
});
