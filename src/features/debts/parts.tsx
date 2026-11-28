// The pieces the debt screens share: the header, a tappable field row and a text box.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { backLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const FIELD_FILL = '#151516';
const FIELD_BORDER = '#272728';

export function DebtHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <IconButton label={backLabel()} onPress={onBack} testID="debt-back">
        <Icon name="chevron-left" color={MonoColors.text} />
      </IconButton>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

export function PickRow({ label, value, empty, onPress, testID, children }: { label: string; value: string; empty?: boolean; onPress: () => void; testID: string; children?: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickLine}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={({ pressed }) => [styles.pick, pressed && styles.pressed]} testID={testID}>
          <Text style={[styles.value, empty && styles.empty]}>{value}</Text>
          <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
        </Pressable>
        {children}
      </View>
    </View>
  );
}

export function TextField({ label, value, onChange, placeholder, maxLength, testID }: { label: string; value: string; onChange: (text: string) => void; placeholder?: string; maxLength: number; testID: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MonoColors.textDisabled}
        selectionColor={MonoColors.text}
        accessibilityLabel={label}
        maxLength={maxLength}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  field: { gap: 8 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  pickLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pick: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL },
  pressed: { opacity: 0.85 },
  value: { ...MonoText.body, color: MonoColors.text, flexShrink: 1 },
  empty: { color: MonoColors.textDisabled },
  input: { ...MonoText.body, color: MonoColors.text, borderWidth: 1, borderColor: FIELD_BORDER, backgroundColor: FIELD_FILL, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
});
