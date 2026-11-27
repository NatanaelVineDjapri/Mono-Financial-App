// Deleting something that may still have records (an archived account or category): when it does, first pick where they
// go (a sheet), then confirm in a dialog that says exactly what will happen. Without records, only the confirmation.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { cancelLabel, closeLabel, removeConfirmLabel, removeFailed, removeMoveSubtitle, removeMoveTitle, removeTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface RemovalTarget {
  name: string;
  needsReplacement: boolean;
  replacements: { id: number; name: string }[];
}

export interface RemovalFlowProps {
  target: RemovalTarget | null; // null: closed
  message: (replacement: { id: number; name: string } | null) => string;
  noReplacement: string; // said when there is nothing to move the records to
  onDelete: (replacementId: number | null) => Promise<boolean>; // false: nothing was changed
  onClose: () => void;
}

export function RemovalFlow({ target, message, noReplacement, onDelete, onClose }: RemovalFlowProps) {
  const [chosen, setChosen] = useState<{ id: number; name: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState(target);
  const { height } = useWindowDimensions();

  if (target !== shownFor) {
    setShownFor(target);
    setChosen(null);
    setFailed(false);
    setBusy(false);
  }

  const picking = target != null && target.needsReplacement && chosen == null;
  const confirming = target != null && !picking;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onDelete(chosen?.id ?? null);
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <>
      <Sheet visible={picking} onClose={onClose} closeLabel={closeLabel()} testID="removal-sheet">
        <SheetHeader visible={picking} icon="trash" title={removeMoveTitle()} subtitle={removeMoveSubtitle(target?.name ?? '')} onClose={onClose} />
        <ScrollView style={{ maxHeight: Math.round(height * 0.55) }}>
          {target?.replacements.length === 0 && <Text style={styles.none}>{noReplacement}</Text>}
          {target?.replacements.map(option => (
            <Pressable
              key={option.id}
              onPress={() => setChosen(option)}
              accessibilityRole="button"
              accessibilityLabel={option.name}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`removal-to-${option.id}`}
            >
              <Text style={styles.name}>{option.name}</Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <ConfirmDialog
        visible={confirming}
        icon="trash"
        title={removeTitle(target?.name ?? '')}
        message={[{ text: failed ? removeFailed() : target ? message(chosen) : '' }]}
        cancelLabel={cancelLabel()}
        confirmLabel={removeConfirmLabel()}
        busy={busy}
        onCancel={onClose}
        onConfirm={() => void confirm()}
        testID="removal-dialog"
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 8 },
  name: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  none: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingVertical: 16 },
  pressed: { backgroundColor: MonoColors.card },
});
