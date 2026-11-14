// The exact-value table shared by the Reports trend and net-worth cards. Values arrive
// already formatted (Rp million, one decimal) and already masked by the caller through
// shownCompact(), so hidden-amounts mode never leaks a figure here either.
import { StyleSheet, Text, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ReportTableCell {
  text: string;
  muted?: boolean; // e.g. "first record" in the change column
}

export interface ReportTableRow {
  label: string;
  cells: ReportTableCell[];
}

export interface ReportTableProps {
  columns: string[]; // first is the row label's header, then one per cell
  rows: ReportTableRow[];
  testID?: string;
}

export function ReportTable({ columns, rows, testID }: ReportTableProps) {
  return (
    <View testID={testID}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.header, styles.labelCell]}>{columns[0]}</Text>
        {columns.slice(1).map((column, i) => (
          <Text key={i} style={[styles.header, styles.valueCell]}>{column}</Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <Text style={[styles.label, styles.labelCell]}>{row.label}</Text>
          {row.cells.map((cell, j) => (
            <Text key={j} style={[styles.cell, styles.valueCell, cell.muted && styles.muted]}>{cell.text}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  headerRow: { borderBottomWidth: 1, borderBottomColor: MonoColors.border, paddingBottom: 8, paddingTop: 2 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  labelCell: { flex: 1.2 },
  valueCell: { flex: 1, textAlign: 'right' },
  header: { ...MonoText.caption, color: MonoColors.textMeta },
  label: { ...MonoText.bodyS, color: MonoColors.text },
  cell: { ...MonoText.figureRow, fontSize: 13, color: MonoColors.text },
  muted: { ...MonoText.caption, color: MonoColors.textMeta },
});
