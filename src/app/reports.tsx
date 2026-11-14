// Reports (PAGES.md H · Reports): period selector, cash flow, six-month trend, spending by
// category, net worth month-ends, and the two CSV exports. Every figure comes from
// src/domain/reports through src/features/reports; the screen only formats and composes.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderButton } from '@/components/HeaderButton';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast-store';
import { today } from '@/core/clock';
import { formatDateRangeCompact, monthLabel, monthShortLabel, periodOfDate, previousPeriod } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import type { ReportRange } from '@/domain/reports';
import { MonthSheet } from '@/features/budgets/MonthSheet';
import { CashFlowReportCard } from '@/features/reports/CashFlowReportCard';
import { CategoryReportCard } from '@/features/reports/CategoryReportCard';
import { createBalancesCsv, createTransactionsCsv } from '@/features/reports/createReportCsv';
import { deviceReportIo } from '@/features/reports/deviceReportIo';
import { ExportCsvCard, type ExportKind } from '@/features/reports/ExportCsvCard';
import { NetWorthReportCard } from '@/features/reports/NetWorthReportCard';
import { RangeSelector } from '@/features/reports/RangeSelector';
import { TrendReportCard } from '@/features/reports/TrendReportCard';
import { useMonthStartDay, useReport } from '@/features/reports/useReport';
import {
  monthChipAccessibilityLabel,
  moreReportsTitle,
  moreScreenTitle,
  reportsBackLabel,
  reportsCsvFailedToast,
  reportsCsvReadyToast,
  reportsEmptyBody,
  reportsEmptyTitle,
  reportsFooterNote,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function ReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const startDay = useMonthStartDay();
  const [range, setRange] = useState<ReportRange>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const currentPeriod = periodOfDate(today(), startDay);
  const period = selectedPeriod ?? currentPeriod;
  const reportQuery = useReport(period, range);
  const report = reportQuery.data;
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const months = useMemo(() => {
    const list: string[] = [];
    let p = currentPeriod;
    for (let i = 0; i < 36; i++) {
      list.push(p);
      p = previousPeriod(p, startDay);
    }
    return list;
  }, [currentPeriod, startDay]);

  const chooseMonth = (next: string) => {
    setSelectedPeriod(next);
    setMonthSheetOpen(false);
  };

  const exportTransactions = async () => {
    if (!report || busy) return;
    setBusy('transactions');
    try {
      const result = await createTransactionsCsv(db, deviceReportIo, { start: report.rangeStart, end: report.rangeEnd });
      showToast(result.ok ? reportsCsvReadyToast() : reportsCsvFailedToast());
    } finally {
      setBusy(null);
    }
  };

  const exportBalances = async () => {
    if (!report || busy) return;
    setBusy('balances');
    try {
      const result = await createBalancesCsv(db, deviceReportIo, { monthEnd: report.balanceMonthEnd });
      showToast(result.ok ? reportsCsvReadyToast() : reportsCsvFailedToast());
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.backRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={reportsBackLabel()}
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{moreScreenTitle()}</Text>
        </Pressable>
      </View>

      <HeaderRow
        title={moreReportsTitle()}
        withTopInset={false}
        right={
          <HeaderButton
            icon="chevron-down"
            text={monthShortLabel(period)}
            label={monthChipAccessibilityLabel(monthLabel(period))}
            onPress={() => setMonthSheetOpen(true)}
            testID="reports-month-chip"
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {report == null ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={MonoColors.textSecond} />
          </View>
        ) : !report.hasData ? (
          <View style={styles.empty} testID="reports-empty">
            <Icon name="info" size={28} color={MonoColors.textDisabled} />
            <Text style={styles.emptyTitle}>{reportsEmptyTitle()}</Text>
            <Text style={styles.emptyBody}>{reportsEmptyBody()}</Text>
          </View>
        ) : (
          <>
            <RangeSelector value={range} onChange={setRange} />

            <CashFlowReportCard
              flow={report.flow}
              rangeText={formatDateRangeCompact(report.rangeStart, report.rangeEnd)}
            />
            <TrendReportCard rows={report.trend} today={report.today} partialPeriod={report.partialTrendPeriod} />
            <CategoryReportCard
              rangeText={range === 'month' ? monthLabel(report.period) : formatDateRangeCompact(report.rangeStart, report.rangeEnd)}
              total={report.categoryTotal}
              rows={report.categories}
            />
            <NetWorthReportCard
              rows={report.netWorthRows}
              netWorth={report.netWorth}
              incomplete={report.netWorthIncomplete}
              today={report.today}
            />
            <ExportCsvCard busy={busy} onExportTransactions={exportTransactions} onExportBalances={exportBalances} />
            <Text style={styles.footer}>{reportsFooterNote()}</Text>
          </>
        )}
      </ScrollView>

      <MonthSheet
        visible={monthSheetOpen}
        months={months}
        selected={period}
        onSelect={chooseMonth}
        onClose={() => setMonthSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  backRow: { paddingHorizontal: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backPressed: { opacity: 0.7 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16, gap: 12 },
  centerFill: { paddingTop: 48, alignItems: 'center' },
  empty: { paddingTop: 64, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  emptyTitle: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  footer: { ...MonoText.caption, color: MonoColors.textMeta, paddingTop: 4 },
});
