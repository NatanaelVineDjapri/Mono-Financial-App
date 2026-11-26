// Analysis (boards Analyze, Analyze-States): the financial health score of a period, from a formula on this phone
// (src/domain/health). No AI, no network, nothing stored: every figure and sentence is derived from the records
// each time, like a balance. The screen only composes what src/features/analysis hands it.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatDateRangeCompact, formatDayMonth, monthLabel, monthName, monthShortLabel, previousPeriod } from '@/core/date';
import { rp, shown } from '@/core/money';
import { countedNote, goodSentence, improvementCard, partRows, summarySentence, watchCard, type CopyCtx, type LinkTarget } from '@/features/analysis/copy';
import type { AnalysisData } from '@/features/analysis/data';
import {
  GoodList,
  ImprovementList,
  NotReady,
  PartsCard,
  ScoreCard,
  SectionHeader,
  TrendCard,
  WatchCardView,
} from '@/features/analysis/sections';
import { AiAnalysisSection } from '@/features/analysis/ai/AiAnalysisSection';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { MonthSheet } from '@/features/budgets/MonthSheet';
import { useMonthStartDay } from '@/features/reports/useReport';
import {
  analysisLoadError,
  analysisLoading,
  analysisPeriodRange,
  analysisRetry,
  analysisSectionGood,
  analysisSectionImprove,
  analysisSectionImproveSub,
  analysisSectionParts,
  analysisSectionPartsSub,
  analysisSectionTrend,
  analysisTitle,
  monthChipAccessibilityLabel,
  analysisTrendUntil,
  analysisDelta,
  moreBackLabel,
  moreBackText,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Body({ data, hidden, onGo, onHow, onAdd }: { data: AnalysisData; hidden: boolean; onGo: (t: LinkTarget) => void; onHow: () => void; onAdd: () => void }) {
  const ctx = useMemo<CopyCtx>(() => ({ money: n => shown(rp(n), hidden) }), [hidden]);
  const { analysis } = data;
  const { result, insights, input } = analysis;

  if (!result.eligible || !insights) return <NotReady checks={result.eligible ? [] : result.checks} onAdd={onAdd} />;

  const rows = partRows(result.components, insights.weakestId, input);
  const delta = data.previousScore === null ? null : (() => {
    const diff = result.score - data.previousScore;
    return { text: analysisDelta(diff, monthName(data.previousPeriod)), sign: (diff > 0 ? 1 : diff < 0 ? -1 : 0) as -1 | 0 | 1 };
  })();
  const summary = summarySentence({ band: result.band, running: data.running, period: data.period, components: result.components, insights, overBudgets: analysis.overBudgets });
  const improvements = insights.improvements.map(i => improvementCard(i, ctx, data.period));
  const watch = insights.watch ? watchCard(insights.watch, ctx) : null;
  const good = insights.good.map(g => goodSentence(g, ctx, monthName(data.previousPeriod)));
  const partial = data.trend.some(p => p.partial);

  return (
    <View testID="analysis-body">
      <ScoreCard score={result.score} band={result.band} delta={delta} summary={summary} countedNote={countedNote(result.components, result.countedOf)} onHow={onHow} />

      <SectionHeader title={analysisSectionParts()} sub={analysisSectionPartsSub(result.score)} />
      <PartsCard rows={rows} drop={result.drop} onGo={onGo} />

      <View style={styles.aiGap}>
        <AiAnalysisSection data={data} />
      </View>

      {(improvements.length > 0 || watch) && (
        <>
          <SectionHeader title={analysisSectionImprove()} sub={improvements.length > 0 ? analysisSectionImproveSub() : undefined} />
          <View style={styles.stack}>
            {improvements.length > 0 && <ImprovementList cards={improvements} onGo={onGo} />}
            {watch && <WatchCardView card={watch} onGo={onGo} />}
          </View>
        </>
      )}

      {good.length > 0 && (
        <>
          <SectionHeader title={analysisSectionGood()} />
          <GoodList sentences={good} />
        </>
      )}

      <SectionHeader title={analysisSectionTrend()} />
      <TrendCard points={data.trend} untilText={partial ? analysisTrendUntil(formatDayMonth(data.today)) : null} />
    </View>
  );
}

export default function AnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hidden = useHideAmounts(state => state.hidden);
  const startDay = useMonthStartDay();
  const [selected, setSelected] = useState<string | null>(null); // null = the running period
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const query = useAnalysis(selected);
  const data = query.data;

  // The months the calendar offers: from the running period back to the first one with a record.
  const months = useMemo(() => {
    if (!data) return [];
    const list = [data.currentPeriod];
    while (data.earliestPeriod && list[list.length - 1] > data.earliestPeriod && list.length < 120) list.push(previousPeriod(list[list.length - 1], startDay));
    return list;
  }, [data, startDay]);

  const go = (target: LinkTarget) => router.push((target.params ? { pathname: target.pathname, params: target.params } : target.pathname) as never);

  return (
    <View style={styles.screen} testID="analysis-screen">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={moreBackLabel()} hitSlop={4} android_ripple={undefined} style={styles.back} testID="analysis-back">
          <Icon name="chevron-left" color={MonoColors.text} />
          <Text style={styles.backText}>{moreBackText()}</Text>
        </Pressable>
      </View>
      <HeaderRow
        title={analysisTitle()}
        withTopInset={false}
        right={
          data ? (
            <HeaderButton
              icon="chevron-down"
              text={monthShortLabel(data.period)}
              label={monthChipAccessibilityLabel(monthLabel(data.period))}
              onPress={() => setMonthSheetOpen(true)}
              testID="analysis-month-chip"
            />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {data ? (
          <>
            <Text style={styles.range} accessibilityLabel={`${monthLabel(data.period)}. ${analysisPeriodRange(formatDateRangeCompact(data.rangeStart, data.rangeEnd), data.running)}`} testID="analysis-period-range">
              {analysisPeriodRange(formatDateRangeCompact(data.rangeStart, data.rangeEnd), data.running)}
            </Text>
            <Body data={data} hidden={hidden} onGo={go} onHow={() => router.push('/analysis/how' as never)} onAdd={() => router.push('/tx/add' as never)} />
          </>
        ) : query.isError ? (
          <View style={styles.center} testID="analysis-error">
            <Text style={styles.muted}>{analysisLoadError()}</Text>
            <Button label={analysisRetry()} variant="secondary" onPress={() => void query.refetch()} />
          </View>
        ) : (
          <View style={styles.center} testID="analysis-loading">
            <ActivityIndicator color={MonoColors.textSecond} />
            <Text style={styles.muted}>{analysisLoading()}</Text>
          </View>
        )}
      </ScrollView>

      {data && (
        <MonthSheet
          visible={monthSheetOpen}
          months={months}
          selected={data.period}
          onSelect={month => {
            setSelected(month === data.currentPeriod ? null : month);
            setMonthSheetOpen(false);
          }}
          onClose={() => setMonthSheetOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  top: { paddingHorizontal: 12, paddingBottom: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  backText: { ...MonoText.body, color: MonoColors.text },
  content: { paddingHorizontal: 16 },
  range: { ...MonoText.caption, color: MonoColors.textMeta, marginBottom: 12, paddingHorizontal: 4 },
  stack: { gap: 12 },
  aiGap: { marginTop: 16 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  muted: { ...MonoText.bodyS, color: MonoColors.textSecond, textAlign: 'center' },
});
