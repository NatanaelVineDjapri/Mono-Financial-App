// A section title with an optional link on the right ("All accounts", "See all").
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export function SectionHeader({ title, linkLabel, onPress }: { title: string; linkLabel?: string; onPress?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {!!linkLabel && (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={linkLabel} hitSlop={8} style={styles.link}>
          <Text style={styles.linkText}>{linkLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  title: { ...MonoText.titleM, color: MonoColors.text, flexShrink: 1 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
