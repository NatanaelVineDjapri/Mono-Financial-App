// Add transaction (/tx/add), the Manual choice of the + menu: Income, Expense or Transfer in one
// form. `?type=income|expense|transfer` picks the starting segment. A static route, so it wins
// over /tx/[id]. The route only wires data and navigation; the form is
// src/features/transactions/form/TransactionForm.tsx and the rules are src/core/tx/validate.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { today as todayLocal } from '@/core/clock';
import type { TxType } from '@/core/tx/validate';
import { aiEntryRoute, useAiConfigured } from '@/features/ai_chat/aiEntry';
import { TransactionForm } from '@/features/transactions/form/TransactionForm';
import { useAddSubmit, useTxFormData } from '@/features/transactions/form/useTxForm';
import { retryLabel, txDetailLoadError } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TYPES: TxType[] = ['income', 'expense', 'transfer'];

export default function AddTransactionScreen() {
  const router = useRouter();
  const { type, account } = useLocalSearchParams<{ type?: string; account?: string }>();
  const initialType = TYPES.find(t => t === type);
  const aiConfigured = useAiConfigured();
  const { data, isLoading, isError, refetch } = useTxFormData();
  const onSubmit = useAddSubmit(data);
  // The date is read once per visit: the form judges "later than today" against one fixed day.
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

  return (
    <TransactionForm
      mode="add"
      data={data}
      today={today}
      initialType={initialType}
      initialAccountId={account ? Number(account) : undefined}
      onCancel={() => router.back()}
      onChat={() => router.replace(aiEntryRoute(aiConfigured) as never)}
      onScan={() => router.replace('/tx/scan' as never)}
      onSubmit={onSubmit}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
