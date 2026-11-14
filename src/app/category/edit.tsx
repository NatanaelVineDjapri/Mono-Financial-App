// Category form (boards Category-Edit and Category-Edit-Existing): a new category, or one that
// exists. The type is locked once anything uses the category; the name is unique per type (archived
// ones count); the icon is a key from the registry. Archiving is here, never deleting (CLAUDE.md
// rule 21), with a dialog that explains what happens, and a notice when it is refused.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { showToast } from '@/components/toast-store';
import { formatShortDate } from '@/core/date';
import type { CategoryKind } from '@/data/repo/categories';
import { CategoryIcon } from '@/features/categories/CategoryIcon';
import { categoryErrorText } from '@/features/categories/errorText';
import { CATEGORY_ICON_KEYS, DEFAULT_NEW_CATEGORY_ICON, resolveCategoryIcon } from '@/features/categories/icons';
import { CATEGORY_NAME_MAX, checkCategoryName, type CategoryError } from '@/features/categories/rules';
import { useCategoryActions, useCategoryFormData } from '@/features/categories/useCategories';
import {
  cancelLabel,
  catArchiveBlockedOk,
  catArchiveBlockedTitle,
  catArchiveBody,
  catArchiveConfirm,
  catArchiveRestoreHint,
  catArchiveTitle,
  catArchivedToast,
  catDiscardBody,
  catDiscardConfirm,
  catDiscardKeep,
  catDiscardTitle,
  catFormArchiveButton,
  catFormEditTitle,
  catFormIconLabel,
  catFormIconSelected,
  catFormKindExpense,
  catFormKindIncome,
  catFormKindLabel,
  catFormKindLockedLabel,
  catFormKindLockedNote,
  catFormKindLockedOther,
  catFormLoadError,
  catFormNameCount,
  catFormNameLabel,
  catFormNamePlaceholder,
  catFormNewTitle,
  catFormPreviewFallback,
  catFormPreviewSub,
  catFormRenameNote,
  catFormSave,
  catFormUsageBudget,
  catFormUsageBudgetNo,
  catFormUsageBudgetYes,
  catFormUsageLastUsed,
  catFormUsageNever,
  catFormUsageTitle,
  catFormUsageTransactions,
  catIconName,
  catSavedToast,
  closeLabel,
  retryLabel,
  undoLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const ICON_COLUMNS = 5;

export default function CategoryEditScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = idParam ? Number(idParam) : undefined;
  const { data, isLoading, isError, refetch } = useCategoryFormData(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data || (id != null && !data.category)) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.message}>{catFormLoadError()}</Text>
        {isError ? <Button label={retryLabel()} onPress={() => void refetch()} /> : <Button label={closeLabel()} variant="secondary" onPress={() => router.back()} />}
      </View>
    );
  }
  return <CategoryForm key={id ?? 'new'} id={id} data={data} />;
}

type FormData = NonNullable<ReturnType<typeof useCategoryFormData>['data']>;

function CategoryForm({ id, data }: { id: number | undefined; data: FormData }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const iconCellWidth = Math.floor((width - 32 - (ICON_COLUMNS - 1) * 8) / ICON_COLUMNS); // 5 columns inside the 16 gutters
  const actions = useCategoryActions();
  const { category, usage, all } = data;
  const isNew = id == null;

  const initialKind: CategoryKind = category?.kind ?? 'expense';
  const initialName = category?.name ?? '';
  const initialIcon = category ? resolveCategoryIcon(category.icon) : DEFAULT_NEW_CATEGORY_ICON;

  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string>(initialIcon);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<CategoryError | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [blocked, setBlocked] = useState<CategoryError | null>(null);

  const kindLocked = !isNew && !!usage?.kindLocked;
  const dirty = name !== initialName || kind !== initialKind || icon !== initialIcon;
  const check = useMemo(() => checkCategoryName(name, kind, all, id), [name, kind, all, id]);
  const nameError: CategoryError | null = saveError ?? (!check.ok && (touched || name.length > 0) ? check.error : null);
  const canSave = check.ok && (isNew || dirty) && !saving;

  // The hardware back button asks before dropping unsaved changes, like the close button.
  useEffect(() => {
    if (!dirty) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDiscardVisible(true);
      return true;
    });
    return () => sub.remove();
  }, [dirty]);

  const close = () => {
    if (dirty) setDiscardVisible(true);
    else router.back();
  };

  const save = async () => {
    setTouched(true);
    if (!check.ok || saving) return;
    setSaving(true);
    const result = isNew ? await actions.create({ kind, name, icon }) : await actions.update(id as number, { name, icon, kind: kind !== initialKind ? kind : undefined });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    showToast(catSavedToast());
    router.back();
  };

  // Archiving: ask the domain first, so a refusal is explained before any confirmation.
  const startArchive = async () => {
    const refusal = await actions.canArchive(id as number);
    if (refusal) setBlocked(refusal);
    else setArchiveVisible(true);
  };

  const archive = async () => {
    setArchiveVisible(false);
    const result = await actions.archive(id as number);
    if (!result.ok) {
      setBlocked(result.error);
      return;
    }
    const categoryId = id as number;
    showToast(catArchivedToast(), { actionLabel: undoLabel(), onAction: () => void actions.restore(categoryId) });
    router.back();
  };

  const kindLabel = (k: CategoryKind) => (k === 'expense' ? catFormKindExpense() : catFormKindIncome());
  const previewName = name.trim() || catFormPreviewFallback();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <IconButton label={closeLabel()} onPress={close} testID="category-close">
            <Icon name="close" color={MonoColors.text} />
          </IconButton>
          <Text style={styles.title} accessibilityRole="header">
            {isNew ? catFormNewTitle() : catFormEditTitle()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="category-scroll">
        <Text style={styles.label}>{catFormKindLabel()}</Text>
        <View style={styles.kindRow}>
          {(['expense', 'income'] as const).map(k => {
            const selected = kind === k;
            const dimmed = kindLocked && !selected;
            return (
              <Pressable
                key={k}
                onPress={kindLocked ? undefined : () => setKind(k)}
                disabled={kindLocked}
                accessibilityRole="button"
                accessibilityLabel={kindLocked && selected ? catFormKindLockedLabel(kindLabel(k)) : kindLabel(k)}
                accessibilityState={{ selected, disabled: kindLocked }}
                android_ripple={undefined}
                style={[styles.kindTile, selected && styles.selected, dimmed && styles.dimmed]}
                testID={`category-kind-${k}`}
              >
                <Text style={[styles.kindText, selected && styles.kindTextSelected]}>{kindLabel(k)}</Text>
                {kindLocked && selected && <Icon name="lock" size={16} color={MonoColors.textSecond} />}
              </Pressable>
            );
          })}
        </View>
        {kindLocked && usage && (
          <Text style={styles.note} testID="category-kind-locked-note">
            {usage.transactionCount > 0 ? catFormKindLockedNote(usage.transactionCount) : catFormKindLockedOther()}
          </Text>
        )}

        <Field
          label={catFormNameLabel()}
          value={name}
          onChangeText={t => {
            setName(t);
            setSaveError(null);
          }}
          onBlur={() => setTouched(true)}
          placeholder={catFormNamePlaceholder()}
          maxLength={CATEGORY_NAME_MAX}
          autoCapitalize="sentences"
          error={nameError ? categoryErrorText(nameError) : undefined}
          testID="category-name"
        />
        <Text style={styles.count}>
          {catFormNameCount(name.length, CATEGORY_NAME_MAX)}
        </Text>
        {!isNew && <Text style={styles.note}>{catFormRenameNote()}</Text>}

        <Text style={styles.label}>{catFormIconLabel()}</Text>
        <View style={styles.iconGrid} testID="category-icons">
          {CATEGORY_ICON_KEYS.map(key => {
            const selected = icon === key;
            const label = catIconName(key);
            return (
              <Pressable
                key={key}
                onPress={() => setIcon(key)}
                accessibilityRole="button"
                accessibilityLabel={selected ? catFormIconSelected(label) : label}
                accessibilityState={{ selected }}
                android_ripple={undefined}
                style={[styles.iconCell, { width: iconCellWidth }, selected && styles.iconCellSelected]}
                testID={`category-icon-${key}`}
              >
                <CategoryIcon iconKey={key} color={selected ? MonoColors.text : MonoColors.textSecond} />
              </Pressable>
            );
          })}
        </View>

        {isNew ? (
          <View style={styles.previewCard} testID="category-preview">
            <View style={styles.previewTile}>
              <CategoryIcon iconKey={icon} />
            </View>
            <View style={styles.previewText}>
              <Text style={[styles.previewName, !name.trim() && styles.previewEmpty]} numberOfLines={2}>
                {previewName}
              </Text>
              <Text style={styles.sub}>{catFormPreviewSub()}</Text>
            </View>
          </View>
        ) : (
          usage && (
            <View style={styles.usageCard} testID="category-usage">
              <Text style={styles.label}>{catFormUsageTitle()}</Text>
              <UsageRow label={catFormUsageTransactions()} value={String(usage.transactionCount)} />
              <UsageRow label={catFormUsageLastUsed()} value={usage.lastUsedOn ? formatShortDate(usage.lastUsedOn) : catFormUsageNever()} />
              <UsageRow label={catFormUsageBudget()} value={usage.hasBudgetThisMonth ? catFormUsageBudgetYes() : catFormUsageBudgetNo()} last />
            </View>
          )
        )}

        {!isNew && (
          <Pressable
            onPress={() => void startArchive()}
            accessibilityRole="button"
            accessibilityLabel={catFormArchiveButton()}
            android_ripple={undefined}
            style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed]}
            testID="category-archive"
          >
            <Icon name="archive" size={20} color={MonoColors.text} />
            <Text style={styles.archiveText}>{catFormArchiveButton()}</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 16 + insets.bottom }]}>
        <Button label={cancelLabel()} variant="secondary" onPress={close} style={styles.cancel} testID="category-cancel" />
        <Button label={catFormSave()} onPress={() => void save()} disabled={!canSave} loading={saving} style={styles.save} testID="category-save" />
      </View>

      <ConfirmDialog
        visible={discardVisible}
        icon="alert"
        iconColor={MonoColors.textSecond}
        title={catDiscardTitle()}
        message={[{ text: catDiscardBody() }]}
        cancelLabel={catDiscardKeep()}
        confirmLabel={catDiscardConfirm()}
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          setDiscardVisible(false);
          router.back();
        }}
        testID="category-discard"
      />
      <ConfirmDialog
        visible={archiveVisible}
        icon="archive"
        iconColor={MonoColors.textSecond}
        title={catArchiveTitle(name.trim() || initialName)}
        message={[{ text: catArchiveBody(usage?.transactionCount ?? 0) }, { text: ` ${catArchiveRestoreHint()}`, strong: false }]}
        cancelLabel={cancelLabel()}
        confirmLabel={catArchiveConfirm()}
        onCancel={() => setArchiveVisible(false)}
        onConfirm={() => void archive()}
        testID="category-archive-dialog"
      />
      <ConfirmDialog
        visible={blocked != null}
        icon="info"
        iconColor={MonoColors.textSecond}
        title={catArchiveBlockedTitle()}
        message={[{ text: blocked ? categoryErrorText(blocked) : '' }]}
        cancelLabel={catArchiveBlockedOk()}
        confirmLabel={catArchiveBlockedOk()}
        hideCancel
        onCancel={() => setBlocked(null)}
        onConfirm={() => setBlocked(null)}
        testID="category-blocked-dialog"
      />
    </KeyboardAvoidingView>
  );
}

function UsageRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.usageRow, !last && styles.usageDivider]}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  header: { paddingHorizontal: 12 },
  headerRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  note: { ...MonoText.bodyS, color: MonoColors.textSecond },
  count: { ...MonoText.caption, color: MonoColors.textMeta, alignSelf: 'flex-end', marginTop: -8 },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  pressed: { opacity: 0.8 },
  kindRow: { flexDirection: 'row', gap: 12 },
  kindTile: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  selected: { borderWidth: 1.5, borderColor: MonoColors.text, backgroundColor: MonoColors.raised },
  dimmed: { opacity: 0.4 },
  kindText: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  kindTextSelected: { color: MonoColors.text },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card, alignItems: 'center', justifyContent: 'center' },
  iconCellSelected: { borderWidth: 1.5, borderColor: MonoColors.text, backgroundColor: MonoColors.raised },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border },
  previewTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: MonoColors.raised, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, gap: 2 },
  previewName: { ...MonoText.bodyStrong, fontSize: 14, color: MonoColors.text },
  previewEmpty: { color: MonoColors.textMeta },
  usageCard: { borderRadius: 16, backgroundColor: MonoColors.surface, borderWidth: 1, borderColor: MonoColors.border, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  usageRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  usageDivider: { borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  usageLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  usageValue: { ...MonoText.bodyStrong, color: MonoColors.text },
  archiveButton: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: MonoColors.textSecond, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  archiveText: { ...MonoText.bodyStrong, color: MonoColors.text },
  bottom: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: MonoColors.border, backgroundColor: MonoColors.bg },
  cancel: { width: 104 },
  save: { flex: 1 },
});
