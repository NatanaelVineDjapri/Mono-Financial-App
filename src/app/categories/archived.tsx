// Archived categories (board Categories-Archived): restore with one tap. A category is never deleted
// (CLAUDE.md rule 21), so this is where it comes back from. When the last one is restored the screen
// returns to the list by itself.
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toast-store';
import { formatShortDate } from '@/core/date';
import type { ArchivedCategoryRow } from '@/data/repo/categories';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { useArchivedCategories, useCategoryActions } from '@/features/categories/useCategories';
import {
  backLabel,
  catArchivedFootnote,
  catArchivedIntro,
  catArchivedRestore,
  catArchivedRestoreLabel,
  catArchivedRowSub,
  catArchivedRowSubNone,
  catArchivedTitle,
  catListExpenseHeader,
  catListIncomeHeader,
  catListLoadError,
  catRestoredToast,
  moreCategoriesTitle,
  retryLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function ArchivedRow({ row, last, onRestore }: { row: ArchivedCategoryRow; last: boolean; onRestore: () => void }) {
  const sub = row.last_used_on ? catArchivedRowSub(row.transaction_count, formatShortDate(row.last_used_on)) : catArchivedRowSubNone(row.transaction_count);
  return (
    <View style={[styles.row, !last && styles.rowDivider]} testID={`archived-row-${row.id}`}>
      <View style={styles.tile}>
        <CategoryIcon iconKey={row.icon} color={MonoColors.textSecond} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {row.name}
        </Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Pressable
        onPress={onRestore}
        accessibilityRole="button"
        accessibilityLabel={catArchivedRestoreLabel(row.name)}
        hitSlop={6}
        android_ripple={undefined}
        style={({ pressed }) => [styles.restore, pressed && styles.pressed]}
        testID={`archived-restore-${row.id}`}
      >
        <Icon name="undo" size={16} color={MonoColors.text} />
        <Text style={styles.restoreText}>{catArchivedRestore()}</Text>
      </Pressable>
    </View>
  );
}

function Group({ title, rows, onRestore, testID }: { title: string; rows: ArchivedCategoryRow[]; onRestore: (id: number) => void; testID: string }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <ArchivedRow key={row.id} row={row} last={i === rows.length - 1} onRestore={() => onRestore(row.id)} />
        ))}
      </View>
    </View>
  );
}

export default function ArchivedCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isError, refetch } = useArchivedCategories();
  const actions = useCategoryActions();

  // Nothing left to restore: back to the main list.
  useEffect(() => {
    if (data && data.length === 0) router.back();
  }, [data, router]);

  const restore = async (id: number) => {
    const result = await actions.restore(id);
    if (result.ok) showToast(catRestoredToast());
  };

  const expense = (data ?? []).filter(r => r.kind === 'expense');
  const income = (data ?? []).filter(r => r.kind === 'income');

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={backLabel()}
          hitSlop={4}
          android_ripple={undefined}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          testID="archived-back"
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{moreCategoriesTitle()}</Text>
        </Pressable>
      </View>
      <HeaderRow title={catArchivedTitle()} withTopInset={false} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} testID="archived-scroll">
        <Text style={styles.intro}>{catArchivedIntro()}</Text>

        {isError && (
          <View style={styles.centered}>
            <Text style={styles.intro}>{catListLoadError()}</Text>
            <Button label={retryLabel()} onPress={() => void refetch()} />
          </View>
        )}

        <Group title={catListExpenseHeader(expense.length)} rows={expense} onRestore={id => void restore(id)} testID="archived-expense" />
        <Group title={catListIncomeHeader(income.length)} rows={income} onRestore={id => void restore(id)} testID="archived-income" />

        <View style={styles.footnote}>
          <Icon name="lock" size={16} color={MonoColors.textMeta} />
          <Text style={styles.footnoteText}>{catArchivedFootnote()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  pressed: { opacity: 0.7 },
  content: { paddingHorizontal: 16, gap: 16 },
  centered: { alignItems: 'center', gap: 12 },
  intro: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingHorizontal: 4 },
  section: { gap: 8 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', paddingHorizontal: 4 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  tile: { width: 36, height: 36, borderRadius: 12, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.textSecond },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  restore: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card },
  restoreText: { ...MonoText.bodyS, color: MonoColors.text },
  footnote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 },
  footnoteText: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 17 },
});
