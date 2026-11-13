import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { cancelLabel, closeLabel, confirmLabel, goalChooseMonthSubtitle, goalChooseMonthTitle, nextYearLabel, previousYearLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function periods(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

/** Target-date picker: the same year/month sheet pattern as Budgets. */
export function GoalMonthSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(selected);
  const [year, setYear] = useState(Number(selected.slice(0, 4)));
  const [previousVisible, setPreviousVisible] = useState(visible);
  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) {
      setDraft(selected);
      setYear(Number(selected.slice(0, 4)));
    }
  }
  const rows = Array.from({ length: 4 }, (_, row) => periods(year).slice(row * 3, row * 3 + 3));
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="goal-month-sheet">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="calendar" title={goalChooseMonthTitle()} subtitle={goalChooseMonthSubtitle()} onClose={onClose} />
        <View style={styles.yearRow}>
          <HeaderButton icon="chevron-left" label={previousYearLabel()} onPress={() => setYear(year - 1)} />
          <Text style={styles.year}>{year}</Text>
          <HeaderButton icon="chevron-right" label={nextYearLabel()} onPress={() => setYear(year + 1)} />
        </View>
        <View style={styles.grid}>
          {rows.map(row => <View key={row[0]} style={styles.gridRow}>{row.map(month => {
            const selectedMonth = month === draft;
            const monthIndex = Number(month.slice(5, 7)) - 1;
            return <Pressable key={month} onPress={() => setDraft(month)} accessibilityRole="button" accessibilityState={{ selected: selectedMonth }} style={[styles.cell, selectedMonth && styles.cellSelected]}>
              {selectedMonth && <Icon name="check" size={16} color={MonoColors.bg} />}
              <Text style={selectedMonth ? styles.monthSelected : styles.month}>{MONTHS[monthIndex]}</Text>
            </Pressable>;
          })}</View>)}
        </View>
        <View style={styles.footer}>
          <Button label={cancelLabel()} variant="secondary" onPress={onClose} style={styles.cancelButton} />
          <Button label={confirmLabel()} onPress={() => onSelect(draft)} style={styles.confirmButton} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 20 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16 },
  year: { ...MonoText.titleM, color: MonoColors.text },
  grid: { gap: 8, paddingVertical: 16 },
  gridRow: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card },
  cellSelected: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  month: { ...MonoText.body, color: MonoColors.text },
  monthSelected: { ...MonoText.bodyStrong, color: MonoColors.bg },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 12 },
  cancelButton: { flex: 1, backgroundColor: MonoColors.card },
  confirmButton: { flex: 1.3 },
});
