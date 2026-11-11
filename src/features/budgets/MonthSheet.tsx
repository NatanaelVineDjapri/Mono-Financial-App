// The calendar the Budgets header's month chip opens: a year with its twelve months in a
// 3 × 4 grid and a pager to move between years. Only months with data (the oldest one up
// to the current month) can be picked; the rest are dimmed and disabled. Built like the
// Transactions Filters sheet: a draft-only bottom sheet. Tapping a month only moves the
// draft; the screen's month changes from Confirm alone, so Cancel, the close button, a
// scrim tap and a swipe down all leave the month as it was. The selected month has a
// check mark and accessibilityState.selected, never colour alone. Cells are 48 high and
// grow with text scale.
import { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { monthLabel, monthShortLabel } from '@/core/date';
import {
    cancelLabel,
    chooseMonthSubtitle,
    chooseMonthTitle,
    closeLabel,
    confirmLabel,
    nextYearLabel,
    previousYearLabel,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// Same reasoning as FilterSheet: Sheet's panel is content-sized, so the sheet needs an
// absolute bound for the grid to scroll inside at a large text scale.
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.75;
const COLUMNS = 3;

const yearOf = (month: string) => month.slice(0, 4);
// "Nov" from monthShortLabel's "Nov 2026".
const shortName = (month: string) => monthShortLabel(month).split(' ')[0];

// The twelve 'YYYY-MM' periods of a year, in rows of three.
function monthRows(year: number): string[][] {
  const all = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
  return Array.from({ length: all.length / COLUMNS }, (_, row) => all.slice(row * COLUMNS, (row + 1) * COLUMNS));
}

export interface MonthSheetProps {
  visible: boolean;
  months: string[]; // every month that can be picked, newest first
  selected: string;
  onSelect: (month: string) => void; // Confirm only
  onClose: () => void;
}

export function MonthSheet({ visible, months, selected, onSelect, onClose }: MonthSheetProps) {
  const [draft, setDraft] = useState(selected);
  const [year, setYear] = useState(Number(yearOf(selected)));
  const [prevVisible, setPrevVisible] = useState(visible);

  // Every opening starts from the screen's month (and its year), so a draft that was
  // never confirmed does not survive a close. Derived during render, not an effect, per
  // React's "adjusting state when a prop changes" recipe (same as Sheet.tsx).
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setDraft(selected);
      setYear(Number(yearOf(selected)));
    }
  }

  const available = new Set(months);
  const newestYear = yearOf(months[0] ?? selected);
  const oldestYear = yearOf(months[months.length - 1] ?? selected);

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="budget-month-sheet">
      <View style={styles.sheet}>
        <SheetHeader
          visible={visible}
          icon="calendar"
          title={chooseMonthTitle()}
          subtitle={chooseMonthSubtitle(newestYear, oldestYear)}
          onClose={onClose}
          closeTestID="budget-month-close"
        />

        <View style={styles.yearRow}>
          <HeaderButton
            icon="chevron-left"
            label={previousYearLabel()}
            disabled={year <= Number(oldestYear)}
            onPress={() => setYear(year - 1)}
            testID="budget-month-year-prev"
          />
          <Text style={styles.year} accessibilityLiveRegion="polite" testID="budget-month-year">
            {year}
          </Text>
          <HeaderButton
            icon="chevron-right"
            label={nextYearLabel()}
            disabled={year >= Number(newestYear)}
            onPress={() => setYear(year + 1)}
            testID="budget-month-year-next"
          />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {monthRows(year).map(row => (
            <View key={row[0]} style={styles.gridRow}>
              {row.map(month => {
                const isSelected = month === draft;
                const enabled = available.has(month);
                return (
                  <Pressable
                    key={month}
                    onPress={enabled ? () => setDraft(month) : undefined}
                    disabled={!enabled}
                    accessibilityRole="button"
                    accessibilityLabel={monthLabel(month)}
                    accessibilityState={{ selected: isSelected, disabled: !enabled }}
                    style={({ pressed }) => [
                      styles.cell,
                      isSelected ? styles.cellSelected : styles.cellIdle,
                      pressed && enabled && !isSelected && styles.cellPressed,
                      !enabled && styles.cellDisabled,
                    ]}
                    testID={`budget-month-option-${month}`}
                  >
                    {isSelected && <Icon name="check" size={16} color={MonoColors.bg} />}
                    <Text style={isSelected ? styles.monthSelected : styles.month}>{shortName(month)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={cancelLabel()} variant="secondary" onPress={onClose} style={styles.cancelButton} testID="budget-month-cancel" />
          <Button label={confirmLabel()} onPress={() => onSelect(draft)} style={styles.confirmButton} testID="budget-month-confirm" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Extra inset on top of Sheet.tsx's own 16px panel padding, the same as FilterSheet.
  sheet: { maxHeight: SHEET_MAX_HEIGHT, paddingHorizontal: 20 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16 },
  year: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center' },
  // flexShrink + minHeight 0 so the grid shrinks into the sheet's maxHeight and scrolls,
  // instead of pushing the footer out (see FilterSheet's note on the same pair).
  scroll: { flexShrink: 1, minHeight: 0 },
  grid: { gap: 8, paddingVertical: 16 },
  gridRow: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  // The sheet itself is `raised`, so an idle month takes the darker `card` fill with a
  // hairline, and the selected one the light fill with a check: a Chip, in a grid.
  cellIdle: { backgroundColor: MonoColors.card, borderColor: MonoColors.border },
  cellSelected: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  cellPressed: { backgroundColor: MonoColors.surface },
  cellDisabled: { opacity: 0.4 },
  month: { ...MonoText.body, color: MonoColors.text },
  monthSelected: { ...MonoText.bodyStrong, color: MonoColors.bg },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 12 },
  // Same overrides as FilterSheet: the shared secondary Button is transparent, which
  // would read as a hole in the sheet, so only here it gets a real fill.
  cancelButton: { flex: 1, backgroundColor: MonoColors.card },
  confirmButton: { flex: 1.3 },
});
