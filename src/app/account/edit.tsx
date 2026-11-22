// Create or edit an account (Account-Edit), at /account/edit (new) and /account/edit?id= (an
// existing account; the pencil on Account detail). The route only wires data and navigation: the
// form is src/features/accounts/form/AccountForm.tsx and its rules are
// src/core/account/validate.ts. The Valas account has its own form (src/features/valas): ?kind=valas
// creates it, ?id= of the Valas account changes it.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { showToast } from '@/components/toast-store';
import { today as todayLocal } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { unlinkCard } from '@/domain/cards/links';
import type { AccountFormValues, AccountValidationContext, PlainAccountType } from '@/core/account/validate';
import { AccountForm } from '@/features/accounts/form/AccountForm';
import { useAccountFormData, useChangeAccountSubmit, useCreateAccountSubmit } from '@/features/accounts/form/useAccountForm';
import { useAccountCardLink, useNfcAvailable } from '@/features/nfc/useNfcEntry';
import { ValasFormScreen } from '@/features/valas/ValasFormScreen';
import { accountNotFoundMessage, backLabel, cancelLabel, nfcUnlinkBody, nfcUnlinkConfirm, nfcUnlinkTitle, nfcUnlinked, retryLabel, txDetailLoadError } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function AccountEditRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return kind === 'valas' ? <ValasFormScreen /> : <AccountEditScreen />;
}

function AccountEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : undefined;
  const { data, isLoading, isError, refetch } = useAccountFormData(editId);
  const create = useCreateAccountSubmit();
  const change = useChangeAccountSubmit(data?.edit);
  const db = useDb();
  const queryClient = useQueryClient();
  const nfcAvailable = useNfcAvailable();
  const { data: cardLink } = useAccountCardLink(editId);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
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
    return <ValasFormScreen editId={editId} />;
  }

  return (
    <>
      <AccountForm
        mode={editId != null ? 'edit' : 'add'}
        initial={initial}
        context={context}
        valasExists={data.hasValas}
        onChooseValas={editId == null ? () => router.replace({ pathname: '/account/edit', params: { kind: 'valas' } } as never) : undefined}
        onFillFromCard={editId == null && nfcAvailable ? () => router.replace('/nfc/scan' as never) : undefined}
        linkedCard={editId != null && cardLink ? { last4: cardLink.last4, onUnlink: () => setUnlinkOpen(true) } : undefined}
        onCancel={() => router.back()}
        onSubmit={editId != null ? change : create}
      />
      <ConfirmDialog
        visible={unlinkOpen}
        icon="info"
        iconColor={MonoColors.text}
        title={nfcUnlinkTitle()}
        message={[{ text: nfcUnlinkBody(cardLink?.last4 ?? '') }]}
        cancelLabel={cancelLabel()}
        confirmLabel={nfcUnlinkConfirm()}
        onCancel={() => setUnlinkOpen(false)}
        onConfirm={() => {
          setUnlinkOpen(false);
          if (editId == null) return;
          void unlinkCard(db, editId).then(async () => {
            await invalidateAfterWrite(queryClient);
            showToast(nfcUnlinked());
          });
        }}
        testID="account-unlink-dialog"
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
