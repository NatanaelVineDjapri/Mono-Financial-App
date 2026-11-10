// More: a pushed screen (route /more, outside the (tabs) group), opened from the avatar on
// Overview — not a tab, so no tab bar here or on its children (Goals, Reports, Categories,
// Backup, Settings, Fixed expenses). Placeholder app bar only — real content is Phase 4.2+.
// The "Dev tools" row is the one exception: __DEV__-only, never shown in a release build.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { backLabel, backToOverviewLabel, devToolsHint, devToolsLabel, moreTitle } from '@/i18n/id';
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
      onPress={() => router.push('/dev')}
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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={backLabel()}
          hitSlop={4}
          android_ripple={undefined}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          testID="more-back"
        >
          <Icon name="chevron-left" color={MonoColors.text} />
          <Text style={styles.backText}>{backToOverviewLabel()}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {moreTitle()}
        </Text>
      </View>

      {__DEV__ && <DevToolsRow />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, paddingBottom: 16, gap: 4 },
  back: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  backPressed: { opacity: 0.7 },
  backText: { ...MonoText.body, color: MonoColors.text },
  title: { ...MonoText.titleL, color: MonoColors.text, paddingHorizontal: 8 },
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
