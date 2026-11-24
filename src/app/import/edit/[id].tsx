// Periksa (/import/edit/[id], board N4): one detected transaction to check, change, save (Simpan) or drop (Tolak).
// The route only wires data and navigation; the screen is src/features/import/ImportEditView.tsx. Simpan stores the
// changes on the queue row, then the domain saves it like a manual transaction (source 'import').
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';

import { today as todayLocal } from '@/core/clock';
import { ImportEditView, type ImportEditChange } from '@/features/import/ImportEditView';
import { useImportQueueActions, useImportQueueItem } from '@/features/import/useImportQueue';
import { useTxFormData } from '@/features/transactions/form/useTxForm';
import { importBackLabel, importItemGone } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function ImportEditRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data: item, isLoading } = useImportQueueItem(id);
  const { data: formData } = useTxFormData();
  const actions = useImportQueueActions();
  const today = useMemo(() => todayLocal(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !formData) return <View style={styles.screen} />;
  if (!item || item.status !== 'pending') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{importItemGone()}</Text>
        <Button label={importBackLabel()} onPress={() => router.back()} />
      </View>
    );
  }

  const onSave = async (change: ImportEditChange, remember: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    await actions.update(id, {
      kind: change.kind,
      amountIdr: change.amountIdr,
      merchant: change.merchant,
      categoryId: change.categoryId,
      accountId: change.accountId,
      occurredAt: `${change.date}${item.occurred_at.slice(10)}`,
    });
    const outcome = await actions.save(id, remember ? { rememberMerchant: true } : undefined);
    setSaving(false);
    if (outcome.ok) {
      router.back();
    } else {
      setError(outcome.message);
    }
  };

  const onReject = async () => {
    await actions.reject(id);
    router.back();
  };

  return <ImportEditView item={item} data={formData} today={today} saving={saving} error={error} onBack={() => router.back()} onSave={(c, r) => void onSave(c, r)} onReject={() => void onReject()} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
