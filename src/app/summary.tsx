// Summary (/summary), opened from the Overview's net worth cards. "Current": a range's net total, expenses, income and
// balance corrections, the running net, where the money went and the spending calendar. "History": income against
// expenses for the last 3, 6 or 12 months, for all accounts or one.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { HeaderRow } from '@/components/HeaderRow';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { LineAreaChart } from '@/components/LineAreaChart';
import { Segmented } from '@/components/Segmented';
import { axisLabel, labelIndexes, niceRange } from '@/core/chartScale';
import { formatDayMonth, formatShortDate, monthAbbrev, monthLabel } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { HistoryMonths, HistoryRow, SummaryData, SummaryRange } from '@/domain/summary';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { CategoryBreakdown } from '@/features/summary/CategoryBreakdown';
import { SpendingCalendar } from '@/features/summary/SpendingCalendar';
import { TotalsCard } from '@/features/summary/TotalsCard';
import { TwoLineChart } from '@/features/summary/TwoLineChart';
import { useSummary, useSummaryHistory } from '@/features/summary/useSummary';
import {
  summaryAllAccounts,
  summaryBack,
  summaryCorrection,
  summaryEmpty,
  summaryExpense,
  summaryHistoryA11y,
  summaryHistoryMonthValues,
  summaryHistoryTitle,
  summaryIncome,
  summaryMonths,
  summaryPartialNote,
  summaryRangeName,
  summaryRunningA11y,
  summaryRunningTitle,
  summaryTabCurrent,
  summaryTabHistory,
  summaryTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const RANGES: SummaryRange[] = ['month', '3m', '6m', 'year'];
const HISTORY: HistoryMonths[] = [3, 6, 12];

function RunningNet({ data, hidden }: { data: SummaryData; hidden: boolean }) {
  const values = data.running.map(p => p.net);
  const axis = niceRange(Math.min(0, ...values), Math.max(0, ...values));
  const top = Math.max(Math.abs(axis.low), Math.abs(axis.high));
  const last = data.running[data.running.length - 1];
  if (data.running.length < 2) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{summaryRunningTitle()}</Text>
      <LineAreaChart
        values={values}
        axis={axis}
        yLabel={tick => (tick === 0 ? '0' : axisLabel(tick, top))}
        xLabelIndexes={labelIndexes(values.length, 4)}
        xLabel={i => formatDayMonth(data.running[i].date)}
        hideYLabels={hidden}
        accessibilityLabel={summaryRunningA11y(formatShortDate(data.start), formatShortDate(data.end), shown(rp(last.net, true), hidden))}
        testID="summary-running"
        renderTooltip={i => (
          <>
            <Text style={styles.tooltipDate}>{formatShortDate(data.running[i].date)}</Text>
            <Text style={styles.tooltipAmount}>{shown(rp(data.running[i].net, true), hidden)}</Text>
          </>
        )}
      />
    </View>
  );
}

function CurrentTab({ hidden }: { hidden: boolean }) {
  const [range, setRange] = useState<SummaryRange>('month');
  const { data } = useSummary(range);
  return (
    <View style={styles.block} testID="summary-current">
      <View style={styles.chips}>
        {RANGES.map(r => <Chip key={r} label={summaryRangeName(r)} selected={r === range} onPress={() => setRange(r)} testID={`summary-range-${r}`} />)}
      </View>
      {!data ? (
        <ActivityIndicator color={MonoColors.textSecond} />
      ) : (
        <>
          <TotalsCard totals={data} />
          {data.isEmpty ? (
            <Text style={styles.empty}>{summaryEmpty()}</Text>
          ) : (
            <>
              <RunningNet data={data} hidden={hidden} />
              <CategoryBreakdown categories={data.categories} total={data.expense} />
              <SpendingCalendar data={data} />
            </>
          )}
        </>
      )}
    </View>
  );
}

function MonthRow({ row }: { row: HistoryRow }) {
  return (
    <View style={styles.monthRow} testID={`summary-month-${row.period}`}>
      <View style={styles.monthTop}>
        <Text style={styles.monthName}>{`${monthLabel(row.period)}${row.partial ? ' *' : ''}`}</Text>
        <Amount value={row.net} sign kind={row.net < 0 ? 'expense' : row.net > 0 ? 'income' : 'transfer'} variant="figureS" />
      </View>
      <View style={styles.monthParts}>
        <View style={styles.part}>
          <Text style={styles.partLabel}>{summaryIncome()}</Text>
          <Amount value={row.income} variant="figureS" />
        </View>
        <View style={styles.part}>
          <Text style={styles.partLabel}>{summaryExpense()}</Text>
          <Amount value={row.expense} variant="figureS" />
        </View>
        {row.correction !== 0 && (
          <View style={styles.part}>
            <Text style={styles.partLabel}>{summaryCorrection()}</Text>
            <Amount value={row.correction} sign kind="transfer" variant="figureS" />
          </View>
        )}
      </View>
    </View>
  );
}

function HistoryTab({ hidden }: { hidden: boolean }) {
  const [months, setMonths] = useState<HistoryMonths>(6);
  const [accountId, setAccountId] = useState<number | null>(null);
  const accounts = useAccountsOverview().data?.accounts ?? [];
  const { data } = useSummaryHistory(months, accountId);
  return (
    <View style={styles.block} testID="summary-history">
      <View style={styles.chips}>
        {HISTORY.map(m => <Chip key={m} label={summaryMonths(m)} selected={m === months} onPress={() => setMonths(m)} testID={`summary-months-${m}`} />)}
      </View>
      {accounts.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
          <Chip label={summaryAllAccounts()} selected={accountId === null} onPress={() => setAccountId(null)} testID="summary-account-all" />
          {accounts.map(a => <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} testID={`summary-account-${a.id}`} />)}
        </ScrollView>
      )}
      {!data ? (
        <ActivityIndicator color={MonoColors.textSecond} />
      ) : (
        <>
          <Text style={styles.sectionTitle} accessibilityRole="header">{summaryHistoryTitle()}</Text>
          <TwoLineChart
            labels={data.map(r => monthAbbrev(r.period))}
            income={data.map(r => r.income)}
            expense={data.map(r => r.expense)}
            hidden={hidden}
            accessibilityLabel={summaryHistoryA11y(data.map(r => summaryHistoryMonthValues(monthLabel(r.period), shown(rp(r.income), hidden), shown(rp(r.expense), hidden))).join('; '))}
          />
          <Card style={styles.list}>
            {/* newest first: the month people look for is at the top */}
            {[...data].reverse().map((row, i) => (
              <View key={row.period} style={i > 0 && styles.divider}>
                <MonthRow row={row} />
              </View>
            ))}
          </Card>
          {data.some(r => r.partial) && <Text style={styles.empty}>{summaryPartialNote()}</Text>}
        </>
      )}
    </View>
  );
}

export default function SummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(state => state.hidden);
  const [tab, setTab] = useState<'current' | 'history'>('current');

  return (
    <View style={styles.screen} testID="summary-screen">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={summaryBack()} hitSlop={4} android_ripple={undefined} style={styles.back} testID="summary-back">
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{summaryBack()}</Text>
        </Pressable>
      </View>
      <HeaderRow title={summaryTitle()} withTopInset={false} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Segmented
          testID="summary-tabs"
          options={[
            { value: 'current', label: summaryTabCurrent() },
            { value: 'history', label: summaryTabHistory() },
          ]}
          value={tab}
          onChange={value => setTab(value as 'current' | 'history')}
        />
        {tab === 'current' ? <CurrentTab hidden={hidden} /> : <HistoryTab hidden={hidden} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  top: { paddingHorizontal: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { ...MonoText.body, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16, gap: 16 },
  block: { gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChips: { flexDirection: 'row', gap: 8 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  tooltipDate: { ...MonoText.caption, color: MonoColors.textSecond },
  tooltipAmount: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
  list: { paddingVertical: 4 },
  divider: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  monthRow: { paddingVertical: 12, gap: 8 },
  monthTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12 },
  monthName: { ...MonoText.bodyStrong, color: MonoColors.text },
  monthParts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 6 },
  part: { gap: 2 },
  partLabel: { ...MonoText.caption, color: MonoColors.textMeta },
});
