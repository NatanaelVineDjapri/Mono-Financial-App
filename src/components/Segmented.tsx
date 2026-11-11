// DESIGN.md section 8/16: a row of Pressable, role="radio". 48 tall. `value` is a single
// string, so exactly one option is selected by construction (a controlled single-select).
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MonoColors, radius } from "@/theme/tokens";
import { MonoText } from "@/theme/typography";

export interface SegmentedOption {
  value: string;
  label: string;
  // This one option cannot be chosen (the edit form locks Transfer): dimmed, announced as
  // disabled, with `hint` saying why.
  disabled?: boolean;
  hint?: string;
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
        const optionDisabled = disabled || !!option.disabled;
        return (
          <Pressable
            key={option.value}
            onPress={optionDisabled ? undefined : () => onChange(option.value)}
            disabled={optionDisabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            accessibilityState={{ selected, disabled: optionDisabled }}
            android_ripple={undefined}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && !optionDisabled && !selected && styles.pressed,
              optionDisabled && styles.disabled,
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
    paddingHorizontal:0
  },
  segmentText: {
  textAlign: "center",
  // width: "100%",
},
  selected: { backgroundColor: MonoColors.raised },
  pressed: { backgroundColor: MonoColors.surface },
  disabled: { opacity: 0.4 },
  selectedText: { color: MonoColors.text },
  unselectedText: { color: MonoColors.textSecond },
});
