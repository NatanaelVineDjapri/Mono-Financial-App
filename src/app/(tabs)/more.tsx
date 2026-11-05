// Lainnya (More) tab. Placeholder app bar only — real content (Backup status, Goals,
// Reports, Categories, Backup and restore, Settings) is Phase 4.2+. The "Dev tools" row
// is the one exception: __DEV__-only, never shown in a release build.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { devToolsHint, devToolsLabel, tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function DevToolsRow() {
  const label = devToolsLabel();
  const hint = devToolsHint();

  // router.push(), not <Link asChild><Pressable>: wrapping this exact Pressable (a
  // function `style` prop, accessibilityRole + accessibilityLabel) in Link's asChild
  // silently dropped its View/Text children on a real Android build — Jest/RTL couldn't
  // catch it (asChild's clone still looked right there), only a device build showed the
  // row's text and icon slot never mounting at all. Confirmed by removing asChild alone.
  return (
    <Pressable
      onPress={() => router.push('/dev/index')}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Icon name="chevron-right" color={MonoColors.textSecond} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{tabLabel('more')}</Text>
      </View>

      {__DEV__ && <DevToolsRow />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text },
  row: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
  },
  rowPressed: { backgroundColor: MonoColors.raised },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...MonoText.body, color: MonoColors.text },
  rowHint: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
