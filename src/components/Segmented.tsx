// DESIGN.md section 8/16: a row of Pressable, role="radio". 48 tall. `value` is a single
// string, so exactly one option is selected by construction (a controlled single-select).
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MonoColors, radius } from "@/theme/tokens";
import { MonoText } from "@/theme/typography";

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function Segmented({
  options,
  value,
  onChange,
  disabled = false,
  testID,
}: SegmentedProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={disabled ? undefined : () => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            android_ripple={undefined}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && !disabled && !selected && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                MonoText.bodyStrong,
                selected ? styles.selectedText : styles.unselectedText,
                styles.segmentText,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    height: 48,
    borderRadius: radius.md,
    backgroundColor: MonoColors.card,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
  textAlign: "center",
  width: "100%",
},
  selected: { backgroundColor: MonoColors.raised },
  pressed: { backgroundColor: MonoColors.surface },
  disabled: { opacity: 0.4 },
  selectedText: { color: MonoColors.text },
  unselectedText: { color: MonoColors.textSecond },
});
