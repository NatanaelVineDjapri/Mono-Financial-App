// DESIGN.md section 7/8/16, CLAUDE.md rule 7: the exact-value table every chart must
// have beneath it. Rows are a label plus one nominal per column, through <Amount> —
// CLAUDE.md rule 12's one gate for hidden-amounts mode — right-aligned, tabular.
// Percentages use pct() directly on basis points and are never masked: hidden mode only
// hides money (DESIGN.md section 6), never a percentage. No numberOfLines and no fixed
// row height anywhere, so rows grow and figures never truncate at 200% text scale (rule
// 7) — cells use minWidth, never width, as their floor.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Amount } from '@/components/Amount';
import { pct } from '@/core/money';
import { chartTableToggleLabel } from '@/i18n/id';
import { MonoColors, type AmountKind } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ChartTableColumn {
  label?: string; // optional header, e.g. "Pemasukan" — shown only if some column has one
  format?: 'amount' | 'percent'; // default 'amount'
  kind?: AmountKind; // colour for 'amount' cells in this column; ignored for 'percent'
}

export interface ChartTableRow {
  label: string;
  values: number[]; // whole rupiah for an 'amount' column, basis points for 'percent'
}

export interface ChartTableProps {
  columns?: ChartTableColumn[]; // omit for a single, unlabeled amount column
  rows: ChartTableRow[];
  totalRow?: ChartTableRow;
  collapsedByDefault?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const DEFAULT_COLUMNS: ChartTableColumn[] = [{ format: 'amount' }];
const VALUE_CELL_MIN_WIDTH = 88; // guessed: enough for "Rp1.800.000" without wrapping

function Cell({ value, column, strong }: { value: number; column: ChartTableColumn; strong: boolean }) {
  if (column.format === 'percent') {
    return <Text style={strong ? styles.cellTextStrong : styles.cellText}>{pct(value)}</Text>;
  }
  return <Amount value={value} kind={column.kind} variant={strong ? 'figureS' : 'figureRow'} />;
}

export function ChartTable({ columns, rows, totalRow, collapsedByDefault = false, style, testID }: ChartTableProps) {
  const [expanded, setExpanded] = useState(!collapsedByDefault);
  const cols = columns ?? DEFAULT_COLUMNS;
  const hasHeader = cols.some(c => c.label);

  return (
    <View style={style} testID={testID}>
      <Pressable onPress={() => setExpanded(e => !e)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle}>
        <Text style={styles.toggleText}>{chartTableToggleLabel(expanded)}</Text>
      </Pressable>
      {expanded && (
        <View>
          {hasHeader && (
            <View style={styles.row}>
              <View style={styles.labelCell} />
              {cols.map((c, i) => (
                <View key={i} style={styles.valueCell}>
                  <Text style={styles.headerText}>{c.label}</Text>
                </View>
              ))}
            </View>
          )}
          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.labelText}>{row.label}</Text>
              {cols.map((col, j) => (
                <View key={j} style={styles.valueCell}>
                  <Cell value={row.values[j]} column={col} strong={false} />
                </View>
              ))}
            </View>
          ))}
          {totalRow && (
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.labelTextStrong}>{totalRow.label}</Text>
              {cols.map((col, j) => (
                <View key={j} style={styles.valueCell}>
                  <Cell value={totalRow.values[j]} column={col} strong />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { paddingVertical: 8 },
  toggleText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  totalRow: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  labelCell: { flex: 1 },
  labelText: { flex: 1, ...MonoText.body, color: MonoColors.text },
  labelTextStrong: { flex: 1, ...MonoText.bodyStrong, color: MonoColors.text },
  valueCell: { minWidth: VALUE_CELL_MIN_WIDTH, alignItems: 'flex-end' },
  headerText: { ...MonoText.caption, color: MonoColors.textSecond },
  cellText: { ...MonoText.figureRow, color: MonoColors.text },
  cellTextStrong: { ...MonoText.figureS, color: MonoColors.text },
});
