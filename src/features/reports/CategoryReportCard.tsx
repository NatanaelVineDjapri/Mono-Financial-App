// "Spending by category": one row per category with its exact amount, its share, and a
// bar drawn in proportion to that share. The percentages are never masked (hidden mode
// hides money only); the amounts pass through <Amount>. Shares use largest-remainder
// rounding, and the footnote says they can still not add to exactly 100%.
import { StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { pct, rp, shown } from '@/core/money';
import type { ReportCategoryRow } from '@/domain/reports';
import {
  reportsCategoryCaption,
  reportsColumnAmount,
  reportsColumnCategory,
  reportsColumnShare,
  reportsNoSpendingMessage,
  reportsSharesRoundingNote,
  reportsSpendingByCategoryTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface CategoryReportCardProps {
  rangeText: string;
  total: number;
  rows: ReportCategoryRow[];
}

export function CategoryReportCard({ rangeText, total, rows }: CategoryReportCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  return (
    <Card style={styles.card} testID="reports-categories">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{reportsSpendingByCategoryTitle()}</Text>
        <Text style={styles.caption}>{reportsCategoryCaption(rangeText, shown(rp(total), hidden))}</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>{reportsNoSpendingMessage()}</Text>
      ) : (
        <>
          <View style={styles.columnRow}>
            <Text style={[styles.column, styles.columnName]}>{reportsColumnCategory()}</Text>
            <Text style={[styles.column, styles.columnAmount]}>{reportsColumnAmount()}</Text>
            <Text style={[styles.column, styles.columnShare]}>{reportsColumnShare()}</Text>
          </View>

          <View style={styles.rows}>
            {rows.map((row, i) => (
              <View
                key={row.id}
                style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
                testID={`reports-category-${row.id}`}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.nameCell}>{row.label}</Text>
                  <View style={styles.amountCell}>
                    <Amount value={row.amount} variant="figureRow" />
                  </View>
                  <Text style={[styles.share, styles.shareCell]}>{pct(row.shareBp)}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${row.shareBp / 100}%` }]} />
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.note}>{reportsSharesRoundingNote()}</Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 2 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: MonoColors.border,
  },
  column: { ...MonoText.caption, color: MonoColors.textMeta },
  columnName: { flex: 1 },
  columnAmount: { minWidth: 92, textAlign: 'right' },
  columnShare: { minWidth: 62, textAlign: 'right' },
  rows: { gap: 0 },
  row: { gap: 6, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameCell: { flex: 1, ...MonoText.body, color: MonoColors.text },
  amountCell: { minWidth: 92, alignItems: 'flex-end' },
  share: { ...MonoText.figureRow, color: MonoColors.text },
  shareCell: { minWidth: 62, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: MonoColors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: MonoColors.accent },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
