// The Reports period stepper (‹ October 2026 ›). The right arrow is disabled at the
// current period; the left one keeps going back through earlier periods.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { reportsNextPeriodLabel, reportsPreviousPeriodLabel } from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface PeriodStepperProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  onPressLabel?: () => void;
}

export function PeriodStepper({ label, onPrevious, onNext, nextDisabled, onPressLabel }: PeriodStepperProps) {
  return (
    <View style={styles.row} testID="reports-period">
      <Pressable
        onPress={onPrevious}
        accessibilityRole="button"
        accessibilityLabel={reportsPreviousPeriodLabel()}
        android_ripple={undefined}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
      </Pressable>
      <Pressable
        onPress={onPressLabel}
        android_ripple={undefined}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        testID="reports-month-chip"
      >
        <Text style={styles.chipText}>{label}</Text>
        <Icon name="chevron-down" size={16} color={MonoColors.textSecond} />
      </Pressable>
      <Pressable
        onPress={nextDisabled ? undefined : onNext}
        disabled={nextDisabled}
        accessibilityRole="button"
        accessibilityLabel={reportsNextPeriodLabel()}
        accessibilityState={{ disabled: nextDisabled }}
        android_ripple={undefined}
        style={({ pressed }) => [styles.arrow, pressed && !nextDisabled && styles.pressed, nextDisabled && styles.disabled]}
      >
        <Icon name="chevron-right" size={20} color={MonoColors.textSecond} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: '#151516',
    borderWidth: 1,
    borderColor: '#272728',
  },
  chipPressed: { backgroundColor: MonoColors.raised },
  chipText: { ...MonoText.bodyStrong, fontSize: 15, color: MonoColors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
