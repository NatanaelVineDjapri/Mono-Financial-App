// Edit transaction (/tx/[id]/edit): the same form as Add, filled with the record. Save updates
// that same row (no new one), then goes back to its detail with "Changes saved." and an Undo. A
// transfer keeps being a transfer and an income or expense never becomes one. A Valas record
// cannot be edited here yet (the Valas form is separate work).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';
import { today as todayLocal } from '@/core/clock';
import { TransactionForm } from '@/features/transactions/form/TransactionForm';
import { useEditSubmit, useTxFormData } from '@/features/transactions/form/useTxForm';
import {
  backLabel,
  editTransactionTitle,
  editValasUnsupportedMessage,
  retryLabel,
  txDetailLoadError,
  txNotFoundMessage,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const { data, isLoading, isError, refetch } = useTxFormData(txId);
  const onSubmit = useEditSubmit(data?.record);
  const today = useMemo(() => todayLocal(), []);

  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{txDetailLoadError()}</Text>
        <Button label={retryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }
  if (!data.record) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{txNotFoundMessage()}</Text>
        <Button label={backLabel()} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  if (!data.record.supported) {
    return <ComingSoonScreen title={editTransactionTitle()} message={editValasUnsupportedMessage()} />;
  }

  return <TransactionForm mode="edit" data={data} today={today} onCancel={() => router.back()} onSubmit={onSubmit} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
