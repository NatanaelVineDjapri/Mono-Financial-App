// The spending heat map: one calendar month at a time, each day shaded by how much was spent (silver only, four steps
// against the biggest day of the range). Shade is never the only signal: tapping a day writes its date and amount, and
// each day reads them aloud.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { formatShortDate, monthLabel } from '@/core/date';
import { rp, shown } from '@/core/money';
import { calendarMonths, heatWeeks, type SummaryData } from '@/domain/summary';
import { summaryHeatDay, summaryHeatNext, summaryHeatPick, summaryHeatPrev, summaryHeatTitle, summaryWeekday } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const HEAT_FILLS = [MonoColors.surface, 'rgba(199,205,214,0.18)', 'rgba(199,205,214,0.38)', 'rgba(199,205,214,0.65)', 'rgba(199,205,214,0.95)'] as const;

export function SpendingCalendar({ data }: { data: Pick<SummaryData, 'spendByDay' | 'start' | 'end'> }) {
  const hidden = useHideAmounts(s => s.hidden);
  const months = calendarMonths(data.start, data.end);
  const [chosen, setChosen] = useState<string | null>(null); // null: the newest month
  const [day, setDay] = useState<string | null>(null);
  const index = chosen && months.includes(chosen) ? months.indexOf(chosen) : months.length - 1;
  const month = months[index];
  const weeks = heatWeeks(month, data);
  const picked = day ? weeks.flat().find(c => c?.date === day) : undefined;

  return (
    <Card style={styles.card} testID="summary-calendar">
      <Text style={styles.title} accessibilityRole="header">{summaryHeatTitle()}</Text>
      <View style={styles.monthRow}>
        <IconButton label={summaryHeatPrev()} onPress={() => setChosen(months[index - 1])} disabled={index === 0} testID="summary-calendar-prev">
          <Icon name="chevron-left" color={index === 0 ? MonoColors.textDisabled : MonoColors.text} />
        </IconButton>
        <Text style={styles.month} testID="summary-calendar-month">{monthLabel(month)}</Text>
        <IconButton label={summaryHeatNext()} onPress={() => setChosen(months[index + 1])} disabled={index === months.length - 1} testID="summary-calendar-next">
          <Icon name="chevron-right" color={index === months.length - 1 ? MonoColors.textDisabled : MonoColors.text} />
        </IconButton>
      </View>

      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={styles.weekday}>{summaryWeekday(i)}</Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((cell, i) =>
            cell === null || !cell.inRange ? (
              <View key={i} style={styles.cell}>
                {cell && <Text style={styles.outside}>{Number(cell.date.slice(8))}</Text>}
              </View>
            ) : (
              <Pressable
                key={i}
                onPress={() => setDay(cell.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: day === cell.date }}
                accessibilityLabel={summaryHeatDay(formatShortDate(cell.date), shown(rp(cell.amount), hidden))}
                android_ripple={undefined}
                style={[styles.cell, { backgroundColor: HEAT_FILLS[cell.level] }, day === cell.date && styles.picked]}
                testID={`summary-day-${cell.date}`}
              >
                <Text style={[styles.number, cell.level >= 3 && styles.numberOnFill]}>{Number(cell.date.slice(8))}</Text>
              </Pressable>
            ),
          )}
        </View>
      ))}
      <Text style={styles.note} testID="summary-calendar-note">
        {picked ? summaryHeatDay(formatShortDate(picked.date), shown(rp(picked.amount), hidden)) : summaryHeatPick()}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, paddingHorizontal: 12 },
  title: { ...MonoText.titleM, color: MonoColors.text, paddingHorizontal: 4 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { ...MonoText.bodyStrong, color: MonoColors.text, flexShrink: 1, textAlign: 'center' },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { ...MonoText.caption, flex: 1, textAlign: 'center', color: MonoColors.textMeta },
  cell: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  picked: { borderColor: MonoColors.text },
  number: { ...MonoText.caption, color: MonoColors.text },
  numberOnFill: { color: MonoColors.bg },
  outside: { ...MonoText.caption, color: MonoColors.textDisabled },
  note: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingHorizontal: 4, paddingTop: 4 },
});
