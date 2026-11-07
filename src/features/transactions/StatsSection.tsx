// Transactions tab, Fase 4.3c: the statistics area above the row list, below the type
// chips. Card 1 — a collapsible header, the ring chart and the same three Income/
// Expense/Net rows the old standalone summary card showed (now absorbed here) — and
// Card 2, a per-category breakdown switched between Income and Expense. Hidden entirely
// when the type chip is "Transfer" (there is nothing to break down). CLAUDE.md rule 2:
// every number here comes from page.summary (already SQL-derived) or useCategoryStats
// (src/domain/categoryStats.ts) — nothing is computed in this component.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Segmented } from '@/components/Segmented';
import { Icon, type IconName } from '@/components/Icon';
import { RingChart } from '@/components/RingChart';
import type { CategoryStat } from '@/domain/categoryStats';
import { pct, rp, shown } from '@/core/money';
import type { TransactionsPage } from '@/domain/transactionsList';
import {
  categoryRowAccessibilityLabel,
  hideStatsLabel,
  netLabel,
  ofLimitLabel,
  othersLabel,
  overLimitLabel,
  ringAccessibilityLabel,
  showStatsLabel,
  spentLabel,
  statsCardTitle,
  transactionsNotCountedNote,
  txKindLabel,
  type TxTypeFilter,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { useStatsCollapsed } from './statsStore';
import { useCategoryStats } from './useCategoryStats';

export interface StatsSectionProps {
  page: TransactionsPage;
  hidden: boolean;
  typeFilter: TxTypeFilter;
  rangeLabel: string;
  selectedCategoryId?: number;
  onSelectCategory: (id: number) => void;
}

function SummaryRow({
  label,
  value,
  kind,
  bordered,
  net,
  testID,
}: {
  label: string;
  value: number;
  kind: 'income' | 'expense';
  bordered?: boolean;
  net?: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.summaryRow, bordered && styles.summaryRowBorder]} testID={testID}>
      <Text style={[styles.summaryLabel, net && styles.summaryLabelNet]}>{label}</Text>
      <View style={styles.summaryValueWrap}>
        <Amount value={value} sign kind={kind} variant="figureS" style={net ? styles.summaryValueNet : undefined} />
      </View>
    </View>
  );
}

// Generic by kind, not yet per-category — category_icon is null in every category row
// today (same known gap as transactions.tsx's own txIcon()).
function categoryIcon(kind: 'income' | 'expense'): IconName {
  return kind === 'income' ? 'wallet' : 'receipt';
}

function CategoryRow({
  stat,
  kind,
  selected,
  onPress,
}: {
  stat: CategoryStat;
  kind: 'income' | 'expense';
  selected: boolean;
  onPress: (id: number) => void;
}) {
  const label = stat.label || othersLabel();
  const percentFormatted = pct(stat.shareBp);
  return (
    <Pressable
      onPress={() => onPress(stat.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={categoryRowAccessibilityLabel(label, percentFormatted, rp(stat.amountIdr))}
      style={[styles.categoryRow, selected && styles.categoryRowSelected]}
      testID={`stats-category-row-${stat.id}`}
    >
      <View style={styles.categoryIcon}>
        <Icon name={categoryIcon(kind)} size={16} color={MonoColors.textSecond} />
      </View>
      <View style={styles.categoryMain}>
        <View style={styles.categoryTopLine}>
          <Text style={styles.categoryName} numberOfLines={2}>
            {label}
          </Text>
          <Text style={styles.categoryPercent}>{percentFormatted}</Text>
        </View>
        <View style={styles.shareTrack}>
          <View style={[styles.shareFill, { width: `${stat.shareBp / 100}%`, backgroundColor: stat.color }]} />
        </View>
      </View>
    </Pressable>
  );
}

export function StatsSection({ page, hidden, typeFilter, rangeLabel, selectedCategoryId, onSelectCategory }: StatsSectionProps) {
  const collapsed = useStatsCollapsed(s => s.collapsed);
  const toggle = useStatsCollapsed(s => s.toggle);
  // "Saklar mengikuti chip tipe": the outer type chip drives the switch whenever it names
  // a kind; only "All" leaves the switch free to toggle on its own (defaulting to expense).
  const [ownKind, setOwnKind] = useState<'income' | 'expense'>('expense');
  const forcedKind = typeFilter === 'income' || typeFilter === 'expense' ? typeFilter : undefined;
  const effectiveKind = forcedKind ?? ownKind;

  const stats = useCategoryStats(page.period, effectiveKind, page.isCurrent);

  if (typeFilter === 'transfer') return null;

  const { income, expense, net, transfer_count: transferCount, transfer_total: transferTotal } = page.summary;
  const categories = stats.data?.categories ?? [];
  const total = stats.data?.total ?? 0;
  const limitIdr = stats.data?.limitIdr;
  const isOverLimit = limitIdr != null && total > limitIdr;

  const centerLabel = effectiveKind === 'expense' ? spentLabel() : txKindLabel('income');
  const centerSub = limitIdr != null ? `${ofLimitLabel(shown(rp(limitIdr), hidden))}${isOverLimit ? ` · ${overLimitLabel()}` : ''}` : undefined;
  const accessibilityLabel = ringAccessibilityLabel(txKindLabel(effectiveKind), shown(rp(total), hidden), centerSub);

  return (
    <View testID="stats-section">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>{statsCardTitle(rangeLabel)}</Text>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: !collapsed }}
            accessibilityLabel={collapsed ? showStatsLabel() : hideStatsLabel()}
            style={styles.toggle}
            testID="stats-toggle"
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {!collapsed && (
          <>
            <View style={styles.ringWrap}>
              <RingChart
                segments={categories.map(c => ({ id: c.id, label: c.label || othersLabel(), valueIdr: c.amountIdr, color: c.color }))}
                limitIdr={limitIdr}
                centerLabel={centerLabel}
                centerValue={shown(rp(total), hidden)}
                centerSub={centerSub && shown(centerSub, false)}
                selectedId={selectedCategoryId}
                onSegmentPress={onSelectCategory}
                accessibilityLabel={accessibilityLabel}
                testID="stats-ring"
              />
            </View>

            <SummaryRow label={txKindLabel('income')} value={income} kind="income" testID="summary-row-income" />
            <SummaryRow label={txKindLabel('expense')} value={-expense} kind="expense" bordered testID="summary-row-expense" />
            <SummaryRow label={netLabel()} value={net} kind={net < 0 ? 'expense' : 'income'} bordered net testID="summary-row-net" />
            {transferCount > 0 && (
              <Text style={styles.transferNote}>{transactionsNotCountedNote(transferCount, shown(rp(transferTotal), hidden))}</Text>
            )}
          </>
        )}
      </View>

      {!collapsed && (
        <View style={styles.card2}>
          <Segmented
            testID="stats-kind-segmented"
            options={[
              { value: 'income', label: txKindLabel('income') },
              { value: 'expense', label: txKindLabel('expense') },
            ]}
            value={effectiveKind}
            onChange={value => setOwnKind(value as 'income' | 'expense')}
            disabled={forcedKind != null}
          />
          <View style={styles.categoryList}>
            {categories.map(stat => (
              <CategoryRow
                key={stat.id}
                stat={stat}
                kind={effectiveKind}
                selected={selectedCategoryId === stat.id}
                onPress={onSelectCategory}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: MonoColors.card, borderRadius: 16, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  cardTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  ringWrap: { alignItems: 'center', paddingVertical: 12 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  summaryLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  summaryLabelNet: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  summaryValueWrap: { flex: 1, alignItems: 'flex-end' },
  summaryValueNet: { fontFamily: MonoText.bodyStrong.fontFamily },
  transferNote: { ...MonoText.caption, color: MonoColors.textMeta, paddingTop: 12 },

  card2: { backgroundColor: MonoColors.card, borderRadius: 16, padding: 16, marginBottom: 20, gap: 16 },
  categoryList: { gap: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44, borderRadius: radius.md },
  categoryRowSelected: { backgroundColor: MonoColors.surface },
  categoryIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: MonoColors.surface, alignItems: 'center', justifyContent: 'center' },
  categoryMain: { flex: 1, gap: 6 },
  categoryTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  categoryName: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  categoryPercent: { ...MonoText.bodyS, color: MonoColors.textSecond },
  shareTrack: { height: 4, borderRadius: 2, backgroundColor: MonoColors.surface, overflow: 'hidden' },
  shareFill: { height: 4, borderRadius: 2 },
});
