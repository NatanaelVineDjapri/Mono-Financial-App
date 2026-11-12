// Hasil scan (/tx/scan/review, board Receipt-Review): the draft a scan produced, to check and save.
// The route only wires the data and navigation; the screen is src/features/receipt/ReceiptReview.tsx.
// Leaving without saving throws the draft away.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { today as todayLocal } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getLastUsedAccountId } from '@/data/repo/transactions';
import { useAiConfigured } from '@/features/ai_chat/aiEntry';
import { tidyReceipt } from '@/features/ai_chat/receiptTidy';
import { ReceiptReview } from '@/features/receipt/ReceiptReview';
import { useReceiptStore } from '@/features/receipt/store';
import { useTxFormData } from '@/features/transactions/form/useTxForm';
import { receiptLoadError, receiptNothingToReview, receiptScanAgainLabel, retryLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function ReceiptReviewScreen() {
  const router = useRouter();
  const db = useDb();
  const parsed = useReceiptStore(s => s.result);
  const imageUri = useReceiptStore(s => s.imageUri);
  const lines = useReceiptStore(s => s.lines);
  const aiConfigured = useAiConfigured();
  const { data, isLoading, isError, refetch } = useTxFormData();
  const last = useQuery({
    queryKey: [...queryKeys.transactions, 'last-used-account'],
    queryFn: () => getLastUsedAccountId(db),
    staleTime: 0,
    gcTime: 0,
  });
  // The date is read once per visit: the form judges "later than today" against one fixed day.
  const today = useMemo(() => todayLocal(), []);

  if (__DEV__ && parsed) console.warn('[receipt] review opened, thumbnail:', imageUri ?? 'none (no picture reached the review)');

  // A draft that is not saved is gone when the screen is.
  useEffect(() => () => useReceiptStore.getState().clear(), []);

  if (!parsed) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{receiptNothingToReview()}</Text>
        <Button label={receiptScanAgainLabel()} onPress={() => router.replace('/tx/scan' as never)} />
      </View>
    );
  }
  if (isLoading || last.isLoading) return <View style={styles.screen} />;
  if (isError || last.isError || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{receiptLoadError()}</Text>
        <Button
          label={retryLabel()}
          onPress={() => {
            void refetch();
            void last.refetch();
          }}
        />
      </View>
    );
  }

  return <ReceiptReview
      parsed={parsed}
      imageUri={imageUri}
      data={data}
      lastAccountId={last.data ?? null}
      today={today}
      onBack={() => router.back()}
      lines={lines}
      aiConfigured={aiConfigured}
      tidy={tidyReceipt}
      onOpenAiSetup={() => router.push('/ai-setup' as never)}
    />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
