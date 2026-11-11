// The body of Account detail (Account-Detail): the balance, where it came from (opening + money
// in − money out = current balance), the Add and Transfer shortcuts, and the month's activity as
// a statement with the running balance on each row. Pure presentation of an AccountDetail from
// src/domain/accountDetail.ts: every figure arrives read from the views and passes <Amount> or
// shown() (hidden-amounts mode, CLAUDE.md rule 12).
//
// Colour follows the sign: money in is green with a plus, money out red with a minus, and a
// transfer (in or out) is neutral with no sign, labelled "Transfer out" / "Transfer in".
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryTile } from '@/components/CategoryTile';
import { Chip } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatDayMonth, formatShortDate, monthName } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { AccountDetail, ActivityFilter, ActivityItem, ActivityKind } from '@/domain/accountDetail';
import {
  accountKindCaption,
  accountTypeName,
  activityEmptyMessage,
  activityFilterEmptyMessage,
  activityFilterLabel,
  activityKindLabel,
  activityMonthTitle,
  activitySubtitle,
  addToAccountLabel,
  currentBalanceLabel,
  moneyInLabel,
  moneyInOutNote,
  moneyOutLabel,
  newestFirstLabel,
  openingBalanceOnLabel,
  transferFromAccountLabel,
  txRowAccessibilityLabel,
  viewAllForAccountLabel,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const DIVIDER = '#272728';
const FILTERS: ActivityFilter[] = ['all', 'in', 'out'];

// ---------------------------------------------------------------- balance and reconciliation

export function BalanceHero({ detail }: { detail: AccountDetail }) {
  return (
    <View style={styles.hero} testID="account-hero">
      <Text style={styles.caption}>{accountKindCaption(accountTypeName(detail.type))}</Text>
      <Amount value={detail.balance} variant="displayS" testID="account-balance" />
    </View>
  );
}

function ReconRow({ label, children, strong = false, divider = false, testID }: { label: string; children: React.ReactNode; strong?: boolean; divider?: boolean; testID?: string }) {
  return (
    <View style={[styles.reconRow, divider && styles.reconDivider]} testID={testID}>
      <Text style={[styles.reconLabel, strong && styles.reconLabelStrong]}>{label}</Text>
      {children}
    </View>
  );
}

// Opening balance + money in − money out = the current balance: the same four numbers the
// views give, laid out so the sum can be read down the card.
export function ReconCard({ detail }: { detail: AccountDetail }) {
  return (
    <View style={styles.reconWrap}>
      <Card style={styles.recon} testID="account-recon">
        <ReconRow label={openingBalanceOnLabel(formatShortDate(detail.openingDate))} testID="account-recon-opening">
          <Amount value={detail.openingBalance} variant="figureRow" />
        </ReconRow>
        <ReconRow label={moneyInLabel()} testID="account-recon-in">
          <Amount value={detail.moneyIn} sign kind="income" variant="figureRow" />
        </ReconRow>
        <ReconRow label={moneyOutLabel()} testID="account-recon-out">
          <Amount value={-detail.moneyOut} sign kind="expense" variant="figureRow" />
        </ReconRow>
        <ReconRow label={currentBalanceLabel()} strong divider testID="account-recon-current">
          <Amount value={detail.balance} variant="figureS" />
        </ReconRow>
      </Card>
      <Text style={styles.note}>{moneyInOutNote()}</Text>
    </View>
  );
}

export function ActionButtons({ onAdd, onTransfer }: { onAdd: () => void; onTransfer: () => void }) {
  return (
    <View style={styles.actions}>
      <Button label={addToAccountLabel()} icon="plus" onPress={onAdd} style={styles.action} testID="account-add" />
      <Button label={transferFromAccountLabel()} icon="transfer" variant="secondary" onPress={onTransfer} style={styles.action} testID="account-transfer" />
    </View>
  );
}

// ---------------------------------------------------------------- activity

function tileIcon(kind: ActivityKind): IconName {
  if (kind === 'income') return 'wallet';
  if (kind === 'expense') return 'receipt';
  return 'transfer';
}

function ActivityRow({ item, hidden, last, onPress }: { item: ActivityItem; hidden: boolean; last: boolean; onPress: () => void }) {
  const isTransfer = item.kind === 'transfer_out' || item.kind === 'transfer_in';
  const kindLabel = activityKindLabel(item.kind);
  const subtitle = activitySubtitle(formatDayMonth(item.date), shown(rp(item.balanceAfter), hidden));
  // A transfer is never signed or coloured; income is +green, an expense −red.
  const value = isTransfer ? Math.abs(item.delta) : item.delta;
  const formatted = rp(value, !isTransfer);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={txRowAccessibilityLabel(item.title, subtitle, kindLabel, shown(formatted, hidden))}
      android_ripple={undefined}
      style={({ pressed }) => [styles.activityRow, !last && styles.activityDivider, pressed && styles.pressed]}
      testID={`account-activity-${item.id}`}
    >
      <CategoryTile icon={tileIcon(item.kind)} size={40} radius={12} iconSize={20} />
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.activityAmount}>
        <Amount value={value} sign={!isTransfer} kind={item.kind === 'income' ? 'income' : item.kind === 'expense' ? 'expense' : undefined} variant="figureRow" />
        <Text style={styles.activityKind}>{kindLabel}</Text>
      </View>
    </Pressable>
  );
}

export interface ActivitySectionProps {
  period: string;
  filter: ActivityFilter;
  onFilter: (filter: ActivityFilter) => void;
  items: ActivityItem[] | undefined;
  onOpenTx: (id: number) => void;
  onViewAll: () => void;
}

export function ActivitySection({ period, filter, onFilter, items, onOpenTx, onViewAll }: ActivitySectionProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const month = monthName(period);
  return (
    <View style={styles.section} testID="account-activity">
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {activityMonthTitle(month)}
        </Text>
        <Text style={styles.caption2}>{newestFirstLabel()}</Text>
      </View>

      <View style={styles.filters} accessibilityRole="radiogroup">
        {FILTERS.map(f => (
          <Chip key={f} label={activityFilterLabel(f)} selected={filter === f} onPress={() => onFilter(f)} testID={`account-filter-${f}`} />
        ))}
      </View>

      {items && items.length > 0 ? (
        <Card style={styles.list}>
          {items.map((item, i) => (
            <ActivityRow key={item.id} item={item} hidden={hidden} last={i === items.length - 1} onPress={() => onOpenTx(item.id)} />
          ))}
        </Card>
      ) : (
        items && <Text style={styles.empty}>{filter === 'all' ? activityEmptyMessage(month) : activityFilterEmptyMessage()}</Text>
      )}

      <Pressable
        onPress={onViewAll}
        accessibilityRole="button"
        accessibilityLabel={viewAllForAccountLabel()}
        android_ripple={undefined}
        style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
        testID="account-view-all"
      >
        <Text style={styles.viewAllText}>{viewAllForAccountLabel()}</Text>
        <Icon name="chevron-right" size={20} color={MonoColors.textSecond} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 4 },
  caption: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  caption2: { ...MonoText.caption, color: MonoColors.textMeta },

  reconWrap: { gap: 8 },
  recon: { paddingVertical: 4, paddingHorizontal: 16 },
  reconRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reconDivider: { borderTopWidth: 1, borderTopColor: DIVIDER },
  reconLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  reconLabelStrong: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  note: { ...MonoText.caption, color: MonoColors.textMeta },

  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },

  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text, flexShrink: 1 },
  filters: { flexDirection: 'row', gap: 8 },
  list: { padding: 0, overflow: 'hidden' },
  activityRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  activityDivider: { borderBottomWidth: 1, borderBottomColor: DIVIDER },
  pressed: { opacity: 0.85 },
  activityText: { flex: 1, gap: 2 },
  activityTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  activitySubtitle: { ...MonoText.caption, color: MonoColors.textMeta },
  activityAmount: { alignItems: 'flex-end', gap: 2 },
  activityKind: { ...MonoText.caption, color: MonoColors.textMeta },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  viewAll: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: DIVIDER, backgroundColor: MonoColors.card },
  viewAllText: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text, flex: 1 },
});
