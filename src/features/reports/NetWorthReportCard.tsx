// "Net worth": the last six calendar month-ends in Rp million, the exact change each month,
// and one line of exact-today arithmetic. The table is the source of truth; the footnote
// explains why its rounded columns can differ by 0,1 from the exact values.
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { millionsFixed } from '@/core/chartScale';
import { calendarMonthEnd, formatShortDate, monthAbbrev, monthName } from '@/core/date';
import { pct, rp, shown, shownCompact } from '@/core/money';
import { reportChangeBp, type ReportNetWorthRow } from '@/domain/reports';
import {
  netWorthIncompleteNote,
  reportsColumnChange,
  reportsColumnMonth,
  reportsColumnValue,
  reportsFirstRecordLabel,
  reportsNetWorthCaption,
  reportsNetWorthDown,
  reportsNetWorthExactFirstNote,
  reportsNetWorthExactNote,
  reportsNetWorthFlat,
  reportsNetWorthTitle,
  reportsNetWorthUp,
  reportsTodayWord,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { ReportTable } from './ReportTable';

function signedMillions(value: number): string {
  return value > 0 ? `+${millionsFixed(value)}` : millionsFixed(value);
}

export interface NetWorthReportCardProps {
  rows: ReportNetWorthRow[];
  netWorth: number;
  incomplete: boolean;
  today: string;
}

export function NetWorthReportCard({ rows, netWorth, incomplete, today }: NetWorthReportCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const last = rows[rows.length - 1] ?? null;
  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;
  const isCurrentMonth = last != null && last.month === today.slice(0, 7);
  const exact = isCurrentMonth ? netWorth : (last?.netWorth ?? netWorth);
  const change = previous ? exact - previous.netWorth : null;
  const changeBp = previous ? reportChangeBp(exact, previous.netWorth) : null;
  const whenText = isCurrentMonth ? reportsTodayWord() : last ? formatShortDate(calendarMonthEnd(last.month)) : reportsTodayWord();
  // "up Rp3.243.000" / "down Rp…" / "unchanged" — the sign lives in the word, as on the board.
  const changeText = change == null || change === 0
    ? reportsNetWorthFlat()
    : change > 0
      ? reportsNetWorthUp(shown(rp(change), hidden))
      : reportsNetWorthDown(shown(rp(-change), hidden));

  return (
    <Card style={styles.card} testID="reports-net-worth">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{reportsNetWorthTitle()}</Text>
        <Text style={styles.caption}>{reportsNetWorthCaption()}</Text>
      </View>

      <ReportTable
        columns={[reportsColumnMonth(), reportsColumnValue(), reportsColumnChange()]}
        rows={rows.map(row => ({
          label: `${monthAbbrev(row.month)}${row.partial ? ' *' : ''}`,
          cells: [
            { text: shownCompact(millionsFixed(row.netWorth), hidden) },
            {
              text: row.change == null ? reportsFirstRecordLabel() : shownCompact(signedMillions(row.change), hidden),
              muted: row.change == null,
            },
          ],
        }))}
        testID="reports-net-worth-table"
      />

      {incomplete && <Text style={styles.incomplete}>{netWorthIncompleteNote()}</Text>}

      <Text style={styles.note}>
        {previous && change != null && changeBp != null
          ? reportsNetWorthExactNote(
              whenText,
              changeText,
              shown(rp(exact), hidden),
              pct(changeBp, true),
              monthName(previous.month),
            )
          : reportsNetWorthExactFirstNote(whenText, shown(rp(exact), hidden))}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 2 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  note: { ...MonoText.caption, color: MonoColors.textMeta },
  incomplete: { ...MonoText.caption, color: MonoColors.textSecond },
});
