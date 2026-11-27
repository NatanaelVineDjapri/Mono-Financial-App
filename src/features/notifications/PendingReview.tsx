// The transactions read from bank notifications that still wait for the person, at the top of the notification page.
// Nothing here saves: a row opens its check screen, "Review all" opens the review list. Read from the queue itself, so
// nothing is copied into the inbox table.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/core/date';
import type { QueueRowWithNames } from '@/data/repo/importQueue';
import { importBadgeCheck, importMerchantPlaceholder, notifReviewAll, notifReviewHeader } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface PendingReviewProps {
  items: readonly QueueRowWithNames[];
  onOpen: (id: number) => void;
  onOpenAll: () => void;
}

export function PendingReview({ items, onOpen, onOpenAll }: PendingReviewProps) {
  if (items.length === 0) return null;
  return (
    <View testID="notif-review">
      <View style={styles.head}>
        <Text style={styles.header} accessibilityRole="header">
          {notifReviewHeader()}
        </Text>
        <Pressable onPress={onOpenAll} accessibilityRole="button" style={styles.all} testID="notif-review-all">
          <Text style={styles.allText}>{notifReviewAll(items.length)}</Text>
        </Pressable>
      </View>
      {items.map(item => {
        const name = item.merchant || importMerchantPlaceholder();
        const when = formatDateTime(item.occurred_at);
        return (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${item.account_name}, ${when}`}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            testID={`notif-review-${item.id}`}
          >
            <View style={styles.icon}>
              <Icon name="bell" size={18} color={MonoColors.accent} />
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              <Text style={styles.sub}>
                {item.account_name} · {when}
              </Text>
              {item.kind === null && <Text style={styles.check}>{importBadgeCheck()}</Text>}
            </View>
            {item.kind ? (
              <Amount value={item.kind === 'expense' ? -item.amount_idr : item.amount_idr} kind={item.kind} sign variant="figureRow" />
            ) : (
              <Amount value={item.amount_idr} variant="figureRow" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  header: { ...MonoText.caption, color: MonoColors.textSecond },
  all: { minHeight: 44, justifyContent: 'center' },
  allText: { ...MonoText.caption, color: MonoColors.accent },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: MonoColors.surface },
  pressed: { opacity: 0.7 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: MonoColors.card, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  check: { ...MonoText.caption, color: MonoColors.textSecond },
});
