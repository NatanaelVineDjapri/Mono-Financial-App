// "Sub-categories · optional" on the category edit screen: the optional labels inside this category (Food & drink > Alone, Together).
// Add one, rename it, archive or restore it, delete one nothing uses. A transaction picks one of them or none; nothing here changes
// a budget or a report, which stay about the category.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import {
  catSubAdd,
  catSubAddPlaceholder,
  catSubArchive,
  catSubArchivedTag,
  catSubDelete,
  catSubEmpty,
  catSubErrorEmpty,
  catSubErrorGone,
  catSubErrorInUse,
  catSubErrorTaken,
  catSubErrorTakenArchived,
  catSubErrorTooLong,
  catSubHelp,
  catSubRestore,
  catSubSaveName,
  catSubTitle,
  catSubUses,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { SUBCATEGORY_NAME_MAX, type SubcategoryError } from './subcategories';
import { useSubcategories, useSubcategoryActions } from './useSubcategories';

export function subcategoryErrorText(error: SubcategoryError): string {
  switch (error.code) {
    case 'name_empty':
      return catSubErrorEmpty();
    case 'name_too_long':
      return catSubErrorTooLong(SUBCATEGORY_NAME_MAX);
    case 'name_taken':
      return catSubErrorTaken();
    case 'name_taken_archived':
      return catSubErrorTakenArchived();
    case 'in_use':
      return catSubErrorInUse(error.count);
    default:
      return catSubErrorGone();
  }
}

export function SubcategoriesSection({ categoryId }: { categoryId: number }) {
  const { data } = useSubcategories(categoryId);
  const actions = useSubcategoryActions(categoryId);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);

  const add = async () => {
    const result = await actions.create(newName);
    if (result.ok) {
      setNewName('');
      setAddError(null);
    } else {
      setAddError(subcategoryErrorText(result.error));
    }
  };

  const open = (id: number, name: string) => {
    setEditing(editing === id ? null : id);
    setEditName(name);
    setRowError(null);
  };

  const run = async (action: () => Promise<{ ok: boolean; error?: SubcategoryError }>) => {
    const result = await action();
    if (result.ok) {
      setEditing(null);
      setRowError(null);
    } else if (result.error) {
      setRowError(subcategoryErrorText(result.error));
    }
  };

  const items = data ?? [];
  return (
    <View style={styles.section} testID="category-subcategories">
      <Text style={styles.label}>{catSubTitle()}</Text>
      <Text style={styles.help}>{catSubHelp()}</Text>

      {items.length === 0 ? (
        <Text style={styles.empty} testID="subcategories-empty">
          {catSubEmpty()}
        </Text>
      ) : (
        <View style={styles.list}>
          {items.map((sub, index) => {
            const isOpen = editing === sub.id;
            return (
              <View key={sub.id} style={[styles.row, index > 0 && styles.rowDivider]} testID={`subcategory-${sub.id}`}>
                <Pressable
                  onPress={() => open(sub.id, sub.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sub.name}, ${catSubUses(sub.uses)}${sub.archived ? `, ${catSubArchivedTag()}` : ''}`}
                  accessibilityState={{ expanded: isOpen }}
                  android_ripple={undefined}
                  style={styles.rowMain}
                  testID={`subcategory-open-${sub.id}`}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.name, sub.archived === 1 && styles.nameArchived]}>{sub.name}</Text>
                    <Text style={styles.caption}>{sub.archived ? `${catSubArchivedTag()} · ${catSubUses(sub.uses)}` : catSubUses(sub.uses)}</Text>
                  </View>
                </Pressable>
                {isOpen && (
                  <View style={styles.editor}>
                    <Field
                      value={editName}
                      onChangeText={t => {
                        setEditName(t);
                        setRowError(null);
                      }}
                      maxLength={SUBCATEGORY_NAME_MAX}
                      autoCapitalize="sentences"
                      error={rowError ?? undefined}
                      testID={`subcategory-name-${sub.id}`}
                    />
                    <View style={styles.actions}>
                      <Button label={catSubSaveName()} onPress={() => void run(() => actions.rename(sub.id, editName))} style={styles.action} testID={`subcategory-save-${sub.id}`} />
                      {sub.archived ? (
                        <Button label={catSubRestore()} variant="secondary" onPress={() => void run(() => actions.restore(sub.id))} style={styles.action} testID={`subcategory-restore-${sub.id}`} />
                      ) : (
                        <Button label={catSubArchive()} variant="secondary" onPress={() => void run(() => actions.archive(sub.id))} style={styles.action} testID={`subcategory-archive-${sub.id}`} />
                      )}
                      {sub.uses === 0 && (
                        <Button label={catSubDelete()} variant="secondary" onPress={() => void run(() => actions.remove(sub.id))} style={styles.action} testID={`subcategory-delete-${sub.id}`} />
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.addRow}>
        <View style={styles.addField}>
          <Field
            value={newName}
            onChangeText={t => {
              setNewName(t);
              setAddError(null);
            }}
            placeholder={catSubAddPlaceholder()}
            maxLength={SUBCATEGORY_NAME_MAX}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={() => void add()}
            error={addError ?? undefined}
            testID="subcategory-new-name"
          />
        </View>
        <Button label={catSubAdd()} onPress={() => void add()} disabled={newName.trim().length === 0} style={styles.addButton} testID="subcategory-add" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  help: { ...MonoText.bodyS, color: MonoColors.textSecond },
  empty: { ...MonoText.bodyS, color: MonoColors.textMeta },
  list: { borderRadius: 16, backgroundColor: MonoColors.surface, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  row: { paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  rowMain: { minHeight: 52, justifyContent: 'center', paddingVertical: 8 },
  rowText: { gap: 2 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  nameArchived: { color: MonoColors.textSecond },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  editor: { paddingBottom: 12, gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addField: { flex: 1 },
  addButton: { minWidth: 88 },
});
