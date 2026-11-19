// "Catat cepat": the five things the person records most often, as one card. Each item is a
// circular initial (the same avatar language as the header) with the place or category that
// names it. Tapping opens the add form already filled in — type, account, category, amount and
// place — so a coffee recorded every morning takes one tap and one Save.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import type { QuickRecord } from '@/domain/quickRecords';
import { quickRecordAccessibilityLabel, quickRecordTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SectionHeader } from './SectionHeader';

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function QuickRecordItem({ item, hidden, onPress }: { item: QuickRecord; hidden: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={quickRecordAccessibilityLabel(item.label, shown(rp(item.amount), hidden))}
      android_ripple={undefined}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      testID={`quick-record-${item.source}-${item.label}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{initial(item.label)}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {item.label}
      </Text>
    </Pressable>
  );
}

export interface QuickRecordCardProps {
  items: QuickRecord[];
  onOpenRecord: (item: QuickRecord) => void;
}

export function QuickRecordCard({ items, onOpenRecord }: QuickRecordCardProps) {
  const hidden = useHideAmounts(s => s.hidden);
  if (items.length === 0) return null;
  return (
    <View style={styles.section} testID="overview-quick-record">
      <SectionHeader title={quickRecordTitle()} />
      <Card style={styles.card}>
        <View style={styles.row}>
          {items.map((item, index) => (
            <QuickRecordItem
              // The label is already unique per card, but the index keeps two items that only
              // differ in case from ever sharing a React key.
              key={`${index}-${item.source}-${item.label.toLowerCase()}`}
              item={item}
              hidden={hidden}
              onPress={() => onOpenRecord(item)}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 8 },
  // Up to five equal shares fit one row on a 390dp screen without scrolling; fewer items
  // stay left-aligned instead of stretching across the whole card.
  item: { flexGrow: 1, flexBasis: 0, maxWidth: 72, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MonoColors.raised,
    borderWidth: 1,
    borderColor: MonoColors.border,
  },
  initial: { ...MonoText.bodyStrong, color: MonoColors.text },
  name: { ...MonoText.caption, color: MonoColors.textSecond, maxWidth: '100%', textAlign: 'center' },
});
