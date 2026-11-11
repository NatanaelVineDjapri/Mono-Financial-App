// Create or edit an account (Account-Edit), at /account/edit (new) and /account/edit?id= (an
// existing account; the pencil on Account detail). The route only wires data and navigation: the
// form is src/features/accounts/form/AccountForm.tsx and its rules are
// src/core/account/validate.ts. A Valas account has its own form, built later.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ComingSoonScreen } from '@/components/ComingSoonScreen';
import { today as todayLocal } from '@/core/clock';
import type { AccountFormValues, AccountValidationContext, PlainAccountType } from '@/core/account/validate';
import { AccountForm } from '@/features/accounts/form/AccountForm';
import { useAccountFormData, useChangeAccountSubmit, useCreateAccountSubmit } from '@/features/accounts/form/useAccountForm';
import { accountNotFoundMessage, backLabel, editAccountLabel, retryLabel, txDetailLoadError, valasDetailComingLater } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function AccountEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : undefined;
  const { data, isLoading, isError, refetch } = useAccountFormData(editId);
  const create = useCreateAccountSubmit();
  const change = useChangeAccountSubmit(data?.edit);
  // The date is read once per visit: the form judges "later than today" against one fixed day.
  const today = useMemo(() => todayLocal(), []);

  const initial = useMemo<AccountFormValues | null>(() => {
    if (!data) return null;
    if (data.edit) {
      const e = data.edit;
      return { name: e.name, type: e.type as PlainAccountType, openingBalance: e.openingBalance, openingDate: e.openingDate, icon: e.icon };
    }
    return { name: '', type: 'bank', openingBalance: 0, openingDate: today, icon: null };
  }, [data, today]);

  const context = useMemo<AccountValidationContext | null>(() => {
    if (!data) return null;
    return {
      today,
      otherNames: data.names.filter(n => n.id !== editId).map(n => n.name),
      editing: data.edit ? { movement: data.edit.movement, firstRecordOn: data.edit.firstRecordOn } : undefined,
    };
  }, [data, today, editId]);

  if (isLoading) return <View style={styles.screen} />;
  if (isError || !data || !initial || !context) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{txDetailLoadError()}</Text>
        <Button label={retryLabel()} onPress={() => void refetch()} />
      </View>
    );
  }
  if (editId != null && !data.edit) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{accountNotFoundMessage()}</Text>
        <Button label={backLabel()} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  if (data.edit?.type === 'forex') {
    return <ComingSoonScreen title={editAccountLabel()} message={valasDetailComingLater()} />;
  }

  return <AccountForm mode={editId != null ? 'edit' : 'add'} initial={initial} context={context} onCancel={() => router.back()} onSubmit={editId != null ? change : create} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
