// Dark shapes in the place of a list's rows while the list is still being read, so a tab is never an empty black screen. Same
// idea as the Overview's skeleton: no text, no figures, hidden from screen readers, static (it is on screen for a moment).
import { StyleSheet, View } from 'react-native';

import { MonoColors } from '@/theme/tokens';

export function ListSkeleton({ rows = 6, testID = 'list-skeleton' }: { rows?: number; testID?: string }) {
  return (
    <View style={styles.list} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.icon} />
          <View style={styles.lines}>
            <View style={[styles.bar, { width: '55%', height: 14 }]} />
            <View style={[styles.bar, { width: '35%', height: 11 }]} />
          </View>
          <View style={[styles.bar, { width: 64, height: 14 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: 20, marginTop: 8, borderRadius: 16, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: MonoColors.raised },
  lines: { flex: 1, gap: 8 },
  bar: { backgroundColor: MonoColors.raised, borderRadius: 6 },
});
