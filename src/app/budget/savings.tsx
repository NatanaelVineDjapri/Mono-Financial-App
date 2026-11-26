// Set, change or remove the savings target (one amount for every month). Laid out like the budget
// form (src/app/budget/edit.tsx). Nothing is written before Save or Remove.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { setSavingsTarget } from '@/domain/savings';
import { useSavingsTarget } from '@/features/budgets/useSavings';
import {
  budgetSaveFailedMessage,
  budgetsErrorMessage,
  cancelLabel,
  closeLabel,
  retryLabel,
  savingsEditTitle,
  savingsFieldLabel,
  savingsHelper,
  savingsRemoveButton,
  savingsSaveButton,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function SavingsTargetScreen() {
  const { data, isLoading, isError, refetch } = useSavingsTarget();

  if (isLoading) return <View style={styles.screen} />;
  if (isError || data === undefined) {
    return (
      <View style={[styles.screen, styles.centerFill]}>
        <Text style={styles.body}>{budgetsErrorMessage()}</Text>
        <Button label={retryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }
  return <SavingsForm current={data} />;
}

function SavingsForm({ current }: { current: number | null }) {
  const router = useRouter();
  const db = useDb();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(current ?? 0);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function write(target: number | null) {
    setFailed(false);
    setSaving(true);
    try {
      await setSavingsTarget(db, target);
      await invalidateAfterWrite(queryClient);
      router.back();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton label={closeLabel()} onPress={() => router.back()} testID="savings-close">
          <Icon name="close" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {savingsEditTitle()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AmountField
          label={savingsFieldLabel()}
          helperText={savingsHelper()}
          value={amount}
          onChangeValue={value => {
            setAmount(value);
            setFailed(false);
          }}
          testID="savings-amount"
        />
        {current !== null && (
          <Button label={savingsRemoveButton()} icon="trash" variant="secondary" onPress={() => void write(null)} disabled={saving} testID="savings-remove" />
        )}
        {failed && (
          <View style={styles.messageRow} accessibilityLiveRegion="assertive" testID="savings-error">
            <Icon name="alert" size={16} color={MonoColors.negative} />
            <Text style={styles.errorText}>{budgetSaveFailedMessage()}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={cancelLabel()} variant="secondary" onPress={() => router.back()} style={styles.cancel} />
        <Button
          label={savingsSaveButton()}
          onPress={() => void write(amount)}
          disabled={amount <= 0}
          loading={saving}
          style={styles.save}
          testID="savings-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  centerFill: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: { paddingHorizontal: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  body: { ...MonoText.body, color: MonoColors.textSecond },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { ...MonoText.bodyS, color: MonoColors.negative, flexShrink: 1 },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: MonoColors.border,
    backgroundColor: MonoColors.bg,
  },
  cancel: { flex: 1 },
  save: { flex: 2 },
});
