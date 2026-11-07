// The month list the Budgets header's month chip opens: every month with data, current
// first. The selected one has a check mark and accessibilityState.selected, never colour
// alone. Rows are 48 high and grow with text scale.
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { monthLabel } from '@/core/date';
import { chooseMonthTitle, closeLabel } from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// Same reasoning as FilterSheet: Sheet's panel is content-sized, so the list needs an
// absolute bound to scroll inside.
const LIST_MAX_HEIGHT = Dimensions.get('window').height * 0.6;

export interface MonthSheetProps {
  visible: boolean;
  months: string[];
  selected: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}

export function MonthSheet({ visible, months, selected, onSelect, onClose }: MonthSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="budget-month-sheet">
      <Text style={styles.title} accessibilityRole="header">
        {chooseMonthTitle()}
      </Text>
      <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }}>
        {months.map(month => {
          const isSelected = month === selected;
          return (
            <Pressable
              key={month}
              onPress={() => onSelect(month)}
              accessibilityRole="button"
              accessibilityLabel={monthLabel(month)}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`budget-month-option-${month}`}
            >
              <Text style={isSelected ? styles.rowTextSelected : styles.rowText}>{monthLabel(month)}</Text>
              <View style={styles.check}>{isSelected && <Icon name="check" size={20} color={MonoColors.text} />}</View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...MonoText.titleM, color: MonoColors.text, marginBottom: 8 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.md },
  pressed: { backgroundColor: MonoColors.card },
  rowText: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  rowTextSelected: { ...MonoText.bodyStrong, color: MonoColors.text, flexShrink: 1 },
  check: { width: 20, height: 20 },
});
