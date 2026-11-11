// "Recent transactions": the five newest of the month, in one card, with "See all".
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { money, rp, shown } from '@/core/money';
import type { TxListRow } from '@/data/repo/transactions';
import { recentTransactionsLabel, seeAllLabel, txKindLabel, txRowAccessibilityLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SectionHeader } from './SectionHeader';

function txTitle(row: TxListRow): string {
  const description = row.description.trim();
  if (description) return description;
  if (row.kind === 'transfer') return txKindLabel('transfer');
  return row.category_name ?? txKindLabel(row.kind);
}

function txSubtitle(row: TxListRow): string {
  if (row.kind === 'transfer') return `${row.account_name} → ${row.to_account_name ?? ''}`;
  return `${row.category_name ?? ''} · ${row.account_name}`;
}

function TxRow({ row, hidden, onPress }: { row: TxListRow; hidden: boolean; onPress: () => void }) {
  const title = txTitle(row);
  const subtitle = txSubtitle(row);
  const value = row.kind === 'expense' ? -row.amount : row.amount;
  const sign = row.kind !== 'transfer';
  const formatted = row.currency === 'IDR' ? rp(value, sign) : money(value, row.currency, row.minor_factor, sign);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={txRowAccessibilityLabel(title, subtitle, txKindLabel(row.kind), shown(formatted, hidden))}
      style={styles.row}
      testID={`overview-tx-${row.id}`}
    >
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Amount value={value} currency={row.currency} minorFactor={row.minor_factor} sign={sign} kind={row.kind} variant="figureRow" />
    </Pressable>
  );
}

export interface RecentTransactionsCardProps {
  rows: TxListRow[];
  onOpenTx: (id: number) => void;
  onSeeAll: () => void;
}

export function RecentTransactionsCard({ rows, onOpenTx, onSeeAll }: RecentTransactionsCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  return (
    <View style={styles.section} testID="overview-recent">
      <SectionHeader title={recentTransactionsLabel()} linkLabel={seeAllLabel()} onPress={onSeeAll} />
      <Card style={styles.card}>
        {rows.map((tx, index) => (
          <View key={tx.id}>
            <TxRow row={tx} hidden={hidden} onPress={() => onOpenTx(tx.id)} />
            {index < rows.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { marginHorizontal: 16, paddingVertical: 4 },
  row: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 12 },
  left: { flex: 1, gap: 4 },
  title: { ...MonoText.bodyStrong, color: MonoColors.text },
  subtitle: { ...MonoText.bodyS, color: MonoColors.textSecond },
  divider: { height: 1, backgroundColor: MonoColors.border },
});
