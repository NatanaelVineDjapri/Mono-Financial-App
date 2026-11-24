// Tinjau (/import/review, board N3): what the notification import read, waiting for Simpan or Tolak.
// The route only wires data and navigation; the screen is src/features/import/ImportReviewView.tsx.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ImportReviewView } from '@/features/import/ImportReviewView';
import { useImportQueue, useImportQueueActions } from '@/features/import/useImportQueue';

import { MonoColors } from '@/theme/tokens';

export default function ImportReviewRoute() {
  const router = useRouter();
  const { data } = useImportQueue();
  const actions = useImportQueueActions();
  const [saving, setSaving] = useState(false);

  if (!data) return <View style={{ flex: 1, backgroundColor: MonoColors.bg }} />;

  const onSaveAll = async () => {
    if (saving) return;
    setSaving(true);
    await actions.saveAll();
    setSaving(false);
  };

  return <ImportReviewView items={data} saving={saving} onBack={() => router.back()} onOpen={id => router.push(`/import/edit/${id}` as never)} onSaveAll={() => void onSaveAll()} />;
}
