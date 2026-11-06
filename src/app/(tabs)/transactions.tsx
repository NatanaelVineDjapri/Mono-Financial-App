// Transaksi (Transactions) tab (DESIGN.md "B. Transactions", PAGES.md B1). The Filters
// sheet (Tx-Filters) is Phase 4.3b — the "Filters" button here only opens an empty stub.
// /tx/[id] and /ai-chat are stub routes until the detail and chat screens exist.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Fab } from '@/components/Fab';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented, type SegmentedOption } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { formatDayHeader, formatDayMonth, formatShortDate } from '@/core/date';
import { money, rp, shown } from '@/core/money';
import type { DailyTotalRow, TransactionsPage, TxListRow } from '@/domain/transactionsList';
import { useTransactionsList } from '@/features/transactions/useTransactionsList';
import {
  closeLabel,
  comingSoonMessage,
  filtersButtonLabel,
  filtersComingSoonMessage,
  filtersSheetTitle,
  monthExpenseLabel,
  netLabel,
  recordViaChatLabel,
  resetSearchLabel,
  searchPlaceholder,
  tabLabel,
  transactionsCountLabel,
  transactionsEmptyBody,
  transactionsEmptyTitle,
  transactionsNotCountedNote,
  txKindLabel,
  txRowAccessibilityLabel,
  txTypeChipLabel,
  type TxTypeFilter,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TYPE_OPTIONS: SegmentedOption[] = (['all', 'income', 'expense', 'transfer'] as TxTypeFilter[]).map(value => ({
  value,
  label: txTypeChipLabel(value),
}));

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function FilterButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={filtersButtonLabel()} hitSlop={4} style={styles.headerAction}>
      <Icon name="filter" color={MonoColors.text} />
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

function SummaryCard({ page, hidden }: { page: TransactionsPage; hidden: boolean }) {
  const { income, expense, net, transfer_count: transferCount, transfer_total: transferTotal } = page.summary;
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemLabel}>{txKindLabel('income')}</Text>
          <Amount value={income} sign kind="income" variant="figureM" />
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemLabel}>{txKindLabel('expense')}</Text>
          <Amount value={-expense} sign kind="expense" variant="figureM" />
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemLabel}>{netLabel()}</Text>
          <Amount value={net} sign kind={net < 0 ? 'expense' : 'income'} variant="figureM" />
        </View>
      </View>
      {transferCount > 0 && (
        <Text style={styles.transferNote}>{transactionsNotCountedNote(transferCount, shown(rp(transferTotal), hidden))}</Text>
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

function txSubtitle(row: TxListRow): string {
  const date = formatDayMonth(row.occurred_on);
  if (row.kind === 'transfer') return `${row.account_name} → ${row.to_account_name ?? ''} · ${date}`;
  return `${row.category_name ?? ''} · ${row.account_name} · ${date}`;
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
        <Text style={styles.rowSubtitle} numberOfLines={1}>
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
            reader acts on, not every running subtotal). */}
        {!!daily && <Text style={styles.dayTotal}>{shown(rp(daily.net, true), hidden)}</Text>}
      </View>
      {rows.map(row => (
        <TxRow key={row.id} row={row} hidden={hidden} onPress={() => onPressRow(row.id)} />
      ))}
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
          <Amount value={page.summary.net} sign kind={page.summary.net < 0 ? 'expense' : 'income'} variant="figureS" />
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
  const hidden = useHideAmounts(s => s.hidden);
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => new Set());

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useTransactionsList({
    type: typeFilter,
    search: debouncedSearch,
  });

  const pages = data?.pages ?? [];
  const firstPage = pages[0];

  const togglePeriod = useCallback((period: string) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }, []);

  const onPressRow = useCallback((id: number) => router.push({ pathname: '/tx/[id]', params: { id: String(id) } }), [router]);
  const resetFilters = useCallback(() => {
    setSearchInput('');
    setTypeFilter('all');
  }, []);

  if (isLoading || !firstPage) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={tabLabel('transactions')} right={<FilterButton onPress={() => setFilterSheetOpen(true)} />} />
        {isError && <Text style={styles.errorText}>{comingSoonMessage()}</Text>}
      </View>
    );
  }

  const filtered = typeFilter !== 'all' || debouncedSearch.trim() !== '';
  const noResults = filtered && pages.every(p => p.isEmpty);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tabLabel('transactions')} right={<FilterButton onPress={() => setFilterSheetOpen(true)} />} />
      <View style={styles.toolbar}>
        <Text style={styles.subtitle}>
          {transactionsCountLabel(firstPage.rows.length, `${formatShortDate(firstPage.rangeStart)}–${formatShortDate(firstPage.rangeEnd)}`)}
        </Text>
        <SearchField value={searchInput} onChangeText={setSearchInput} />
        <Segmented
          testID="tx-type-segmented"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={value => setTypeFilter(value as TxTypeFilter)}
        />
      </View>

      {noResults ? (
        <View style={styles.centerFill}>
          <Icon name="search" size={26} color={MonoColors.textDisabled} />
          <Text style={styles.emptyTitle}>{transactionsEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{transactionsEmptyBody()}</Text>
          <Button label={resetSearchLabel()} variant="secondary" onPress={resetFilters} />
        </View>
      ) : (
        <FlatList
          data={pages}
          keyExtractor={item => item.period}
          ListHeaderComponent={<SummaryCard page={firstPage} hidden={hidden} />}
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
          contentContainerStyle={styles.listContent}
        />
      )}

      <Fab label={recordViaChatLabel()} style={styles.fab} onPress={() => router.push('/ai-chat')}>
        <Icon name="plus" size={20} color={MonoColors.bg} />
      </Fab>

      <Sheet visible={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} closeLabel={closeLabel()}>
        <View style={styles.filterSheet}>
          <Text style={styles.filterTitle}>{filtersSheetTitle()}</Text>
          <Text style={styles.filterBody}>{filtersComingSoonMessage()}</Text>
        </View>
      </Sheet>
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
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center', marginTop: 24 },
  toolbar: { paddingHorizontal: 20, gap: 12, paddingBottom: 12 },
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

  summaryCard: { backgroundColor: MonoColors.card, borderRadius: 16, padding: 20, gap: 12, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { gap: 4 },
  summaryItemLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  transferNote: { ...MonoText.caption, color: MonoColors.textMeta },

  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  monthLabel: { ...MonoText.titleM, color: MonoColors.text },
  monthNet: { flexDirection: 'row', alignItems: 'baseline' },
  monthNetLabel: { ...MonoText.bodyS, color: MonoColors.textSecond },
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

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
    minHeight: 48,
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

  fab: { position: 'absolute', right: 20, bottom: 24 },

  filterSheet: { gap: 8, paddingBottom: 8 },
  filterTitle: { ...MonoText.titleM, color: MonoColors.text },
  filterBody: { ...MonoText.body, color: MonoColors.textSecond },
});
