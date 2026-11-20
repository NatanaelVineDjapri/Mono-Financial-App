// Tinjau (board N3, screen 26): the transactions read from notifications, waiting for the person. Each card shows
// what was read (merchant, amount, kind, category, account, time), tagged "Ditebak" (the general parser read it)
// and "Perlu dicek" when it could not tell income from expense. Tap a card to check or change it; "Simpan N yang
// lengkap" saves every card that already has a kind and a category. Nothing here saves on its own.
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { formatDateTime } from '@/core/date';
import type { QueueRowWithNames } from '@/data/repo/importQueue';
import { isComplete } from '@/domain/importQueue';
import {
  importBackLabel,
  importBadgeCheck,
  importBadgeGuessed,
  importMerchantPlaceholder,
  importPickCategory,
  importReviewEmptyBody,
  importReviewEmptyTitle,
  importReviewIntro,
  importReviewTitle,
  importSaveAll,
  importSaving,
  txKindLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface ImportReviewViewProps {
  items: readonly QueueRowWithNames[];
  saving: boolean;
  onBack: () => void;
  onOpen: (id: number) => void;
  onSaveAll: () => void;
}

export function ImportReviewView({ items, saving, onBack, onOpen, onSaveAll }: ImportReviewViewProps) {
  const insets = useSafeAreaInsets();
  const complete = items.filter(isComplete).length;

  return (
    <View style={styles.screen} testID="import-review">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={importBackLabel()} onPress={onBack} testID="import-review-back">
          <Icon name="chevron-left" size={24} color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {importReviewTitle()}
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty} testID="import-review-empty">
          <Icon name="bell" size={26} color={MonoColors.textSecond} />
          <Text style={styles.emptyTitle}>{importReviewEmptyTitle()}</Text>
          <Text style={styles.emptyBody}>{importReviewEmptyBody()}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          ListHeaderComponent={<Text style={styles.intro}>{importReviewIntro()}</Text>}
          renderItem={({ item }) => <QueueCard item={item} onPress={() => onOpen(item.id)} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {complete > 0 && (
        <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
          <Button label={saving ? importSaving() : importSaveAll(complete)} onPress={onSaveAll} disabled={saving} testID="import-save-all" />
        </View>
      )}
    </View>
  );
}

function QueueCard({ item, onPress }: { item: QueueRowWithNames; onPress: () => void }) {
  const name = item.merchant || importMerchantPlaceholder();
  const needsKind = item.kind === null;
  const when = formatDateTime(item.occurred_at);
  const kindText = item.kind ? txKindLabel(item.kind) : '';
  const categoryText = item.category_name ?? importPickCategory();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${kindText}, ${categoryText}, ${item.account_name}, ${when}`}
      android_ripple={undefined}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`import-card-${item.id}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {item.kind ? (
          <Amount value={item.kind === 'expense' ? -item.amount_idr : item.amount_idr} kind={item.kind} sign variant="figureRow" testID={`import-amount-${item.id}`} />
        ) : (
          <Amount value={item.amount_idr} variant="figureRow" testID={`import-amount-${item.id}`} />
        )}
      </View>

      <Text style={styles.caption}>
        {item.app_name} · {when}
      </Text>

      <View style={styles.tags}>
        {needsKind && (
          <View style={[styles.tag, styles.tagStrong]} testID={`import-check-${item.id}`}>
            <Icon name="alert" size={16} color={MonoColors.text} />
            <Text style={styles.tagTextStrong}>{importBadgeCheck()}</Text>
          </View>
        )}
        {item.guessed === 1 && (
          <View style={styles.tag} testID={`import-guessed-${item.id}`}>
            <Text style={styles.tagText}>{importBadgeGuessed()}</Text>
          </View>
        )}
        <View style={styles.tag}>
          <Text style={[styles.tagText, !item.category_name && styles.tagPlaceholder]}>{categoryText}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.account_name}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  intro: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingBottom: 4 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 10 },

  card: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: '#272728', borderRadius: 16, padding: 14, gap: 6 },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text, flex: 1 },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { minHeight: 26, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2A2A2B', borderRadius: 13 },
  tagStrong: { borderColor: MonoColors.textDisabled },
  tagText: { ...MonoText.caption, color: MonoColors.textSecond },
  tagTextStrong: { ...MonoText.caption, color: MonoColors.text },
  tagPlaceholder: { color: MonoColors.textMeta },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },

  bar: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#272728', backgroundColor: MonoColors.bg },
});
