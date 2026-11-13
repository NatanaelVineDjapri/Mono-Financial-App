// Create or change the Valas account (/account/edit?kind=valas, and /account/edit?id= for the Valas
// account). Wires data, saving and navigation; the form is ValasForm.tsx and its rules are
// formValidate.ts.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { showToast } from '@/components/toast-store';
import { today as todayLocal } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccountNames } from '@/domain/accountDetail';
import { accountNotFoundMessage, backLabel, retryLabel, txDetailLoadError, valasCreatedToast, valasPocketAddedToast, valasPocketArchivedToast, valasSavedToast } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { MINOR_FACTORS } from './currencies';
import { pocketsFromRows, type ValasFormValues } from './formValidate';
import { useValasActions, useValasDetail } from './useValas';
import { ValasForm, type ValasFormResult } from './ValasForm';

export function ValasFormScreen({ editId }: { editId?: number }) {
  const router = useRouter();
  const db = useDb();
  const actions = useValasActions();
  const today = useMemo(() => todayLocal(), []);
  const names = useQuery({
    queryKey: [...queryKeys.accounts, 'valas-form-names'],
    queryFn: () => listAccountNames(db),
    staleTime: 0,
    gcTime: 0,
  });
  // Only an existing account needs its pockets; for a new one the id is NaN and the query is unused.
  const detail = useValasDetail(editId ?? -1);

  if (names.isLoading || (editId != null && detail.isLoading)) return <View style={styles.screen} />;
  if (names.isError || !names.data || (editId != null && detail.isError)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{txDetailLoadError()}</Text>
        <Button label={retryLabel()} onPress={() => void names.refetch()} />
      </View>
    );
  }
  if (editId != null && !detail.data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>{accountNotFoundMessage()}</Text>
        <Button label={backLabel()} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const otherNames = names.data.filter(n => n.id !== editId).map(n => n.name);
  const existing = detail.data;

  const onSubmit = async (values: ValasFormValues): Promise<ValasFormResult> => {
    if (editId != null) {
      const result = await actions.rename(editId, values.name);
      if (!result.ok) return result;
      router.back();
      showToast(valasSavedToast());
      return { ok: true };
    }
    const result = await actions.create({ name: values.name, pockets: pocketsFromRows(values.rows, MINOR_FACTORS), openingDate: values.openingDate });
    if (!result.ok) return result;
    router.replace({ pathname: '/account/[id]', params: { id: String(result.value) } } as never);
    showToast(valasCreatedToast(values.name.trim()));
    return { ok: true };
  };

  const initial: ValasFormValues = existing ? { name: existing.name, rows: [], openingDate: existing.openingDate } : { name: 'Valas', rows: [], openingDate: today };

  return (
    <ValasForm
      mode={editId != null ? 'edit' : 'add'}
      initial={initial}
      today={today}
      otherNames={otherNames}
      pockets={existing?.pockets.map(p => ({ currency: p.currency, balance: p.balance, minorFactor: p.minorFactor }))}
      onAddPocket={
        editId != null
          ? async currency => {
              const result = await actions.addPocket(editId, currency);
              if (result.ok) showToast(valasPocketAddedToast(currency));
              return result.ok ? { ok: true } : result;
            }
          : undefined
      }
      onArchivePocket={
        editId != null
          ? async currency => {
              const result = await actions.archivePocket(editId, currency);
              if (result.ok) showToast(valasPocketArchivedToast(currency));
              return result.ok ? { ok: true } : result;
            }
          : undefined
      }
      onCancel={() => router.back()}
      onSubmit={onSubmit}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});
