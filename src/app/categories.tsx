// Categories (board Categories): the active categories by kind with a "budget set" tag, the virtual
// Transfer row, and a row to the archived ones. A category is never deleted, only archived
// (CLAUDE.md rule 21). Back arrow returns to More.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import type { CategoryListRow } from '@/data/repo/categories';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { useCategoryOverview } from '@/features/categories/useCategories';
import {
  catListAdd,
  catListArchivedRow,
  catListBudgetTag,
  catListExpenseHeader,
  catListIncomeHeader,
  catListLoadError,
  catListRowLabel,
  catListRowLabelWithBudget,
  catListSystemHeader,
  catListTransferName,
  catListTransferSub,
  moreBackLabel,
  moreBackText,
  moreCategoriesTitle,
  retryLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function CategoryRow({ row, last, onPress }: { row: CategoryListRow; last: boolean; onPress: () => void }) {
  const hasBudget = row.has_budget === 1;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasBudget ? catListRowLabelWithBudget(row.name) : catListRowLabel(row.name)}
      android_ripple={undefined}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
      testID={`category-row-${row.id}`}
    >
      <View style={styles.tile}>
        <CategoryIcon iconKey={row.icon} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {row.name}
      </Text>
      {hasBudget && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{catListBudgetTag()}</Text>
        </View>
      )}
      <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
    </Pressable>
  );
}

function Section({ title, rows, onOpen, testID }: { title: string; rows: CategoryListRow[]; onOpen: (id: number) => void; testID: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <CategoryRow key={row.id} row={row} last={i === rows.length - 1} onPress={() => onOpen(row.id)} />
        ))}
      </View>
    </View>
  );
}

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isError, refetch } = useCategoryOverview();

  const open = (id: number) => router.push({ pathname: '/category/edit', params: { id: String(id) } } as never);
  const add = () => router.push('/category/edit' as never);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={moreBackLabel()}
          hitSlop={4}
          android_ripple={undefined}
          style={({ pressed }) => [styles.back, pressed && styles.rowPressed]}
          testID="categories-back"
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{moreBackText()}</Text>
        </Pressable>
      </View>
      <HeaderRow title={moreCategoriesTitle()} right={<HeaderButton icon="plus" label={catListAdd()} onPress={add} testID="categories-add" />} withTopInset={false} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} testID="categories-scroll">
        {isError && (
          <View style={styles.centered}>
            <Text style={styles.message}>{catListLoadError()}</Text>
            <Button label={retryLabel()} onPress={() => void refetch()} />
          </View>
        )}

        {data && (
          <>
            <Section title={catListExpenseHeader(data.expense.length)} rows={data.expense} onOpen={open} testID="categories-expense" />
            <Section title={catListIncomeHeader(data.income.length)} rows={data.income} onOpen={open} testID="categories-income" />

            <View style={styles.section} testID="categories-system">
              <Text style={styles.sectionLabel} accessibilityRole="header">
                {catListSystemHeader()}
              </Text>
              <View style={[styles.card, styles.systemCard]}>
                <View style={styles.row} accessible accessibilityLabel={`${catListTransferName()}. ${catListTransferSub()}`}>
                  <View style={styles.tile}>
                    <Icon name="transfer" size={20} color={MonoColors.textSecond} />
                  </View>
                  <View style={styles.systemText}>
                    <Text style={styles.nameFlat}>{catListTransferName()}</Text>
                    <Text style={styles.sub}>{catListTransferSub()}</Text>
                  </View>
                  <Icon name="lock" size={16} color={MonoColors.textMeta} />
                </View>
              </View>
            </View>

            {data.archivedCount >= 1 && (
              <Pressable
                onPress={() => router.push('/categories/archived' as never)}
                accessibilityRole="button"
                accessibilityLabel={catListArchivedRow(data.archivedCount)}
                android_ripple={undefined}
                style={({ pressed }) => [styles.card, styles.archivedRow, pressed && styles.rowPressed]}
                testID="categories-archived-row"
              >
                <Icon name="archive" size={20} color={MonoColors.textSecond} />
                <Text style={styles.archivedText}>{catListArchivedRow(data.archivedCount)}</Text>
                <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16, gap: 16 },
  centered: { alignItems: 'center', gap: 12, paddingTop: 48 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  section: { gap: 8 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', paddingHorizontal: 4 },
  card: { backgroundColor: MonoColors.card, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  systemCard: { backgroundColor: MonoColors.surface },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  rowPressed: { opacity: 0.7 },
  tile: { width: 36, height: 36, borderRadius: 12, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  name: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text, flex: 1 },
  nameFlat: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  systemText: { flex: 1, gap: 2 },
  tag: { borderWidth: 1, borderColor: MonoColors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { ...MonoText.caption, color: MonoColors.textSecond },
  archivedRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  archivedText: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.textSecond, flex: 1 },
});
