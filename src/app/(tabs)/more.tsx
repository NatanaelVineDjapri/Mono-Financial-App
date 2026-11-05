// Lainnya (More) tab. Placeholder app bar only — real content (Backup status, Goals,
// Reports, Categories, Backup and restore, Settings) is Phase 4.2+. The "Dev tools" row
// is the one exception: __DEV__-only, never shown in a release build.
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { devToolsHint, devToolsLabel, tabLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{tabLabel('more')}</Text>
      </View>

      {__DEV__ && (
        <Link href="/dev/index" asChild>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={devToolsLabel()}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{devToolsLabel()}</Text>
              <Text style={styles.rowHint}>{devToolsHint()}</Text>
            </View>
            <Icon name="chevron-right" color={MonoColors.textSecond} />
          </Pressable>
        </Link>
      )}
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
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
  },
  rowPressed: { backgroundColor: MonoColors.raised },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...MonoText.body, color: MonoColors.text },
  rowHint: { ...MonoText.bodyS, color: MonoColors.textSecond },
});
