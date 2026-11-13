// The account form's reads and its two submit paths (create, change). The route stays thin: it
// picks one and hands it to <AccountForm>. Saving goes through src/core/account/save.ts; after
// it the lists refetch (an account's balance is a view, so nothing else needs touching), the
// screen closes and a snackbar says what happened.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { nowIso } from '@/core/clock';
import { rp, shown } from '@/core/money';
import { saveAccountChanges, saveNewAccount } from '@/core/account/save';
import type { AccountFormValues } from '@/core/account/validate';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getAccountEditData, listAccountNames, type AccountEditData } from '@/domain/accountDetail';
import { getForexAccountId } from '@/features/valas/forexAccount';
import { accountChangesSavedMessage, accountCreatedMessage } from '@/i18n';

import type { AccountSubmitResult } from './AccountForm';

export interface AccountFormData {
  hasValas: boolean; // the one Valas account exists: a second cannot be made
  names: { id: number; name: string }[];
  edit: AccountEditData | null;
}

export function useAccountFormData(editId?: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'form', editId ?? 'new'],
    queryFn: async (): Promise<AccountFormData> => {
      const [names, edit, valasId] = await Promise.all([listAccountNames(db), editId != null ? getAccountEditData(db, editId) : Promise.resolve(null), getForexAccountId(db)]);
      return { names, edit, hasValas: valasId != null };
    },
    // The form must open on this moment's data, not a cached copy.
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCreateAccountSubmit() {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(
    async (values: AccountFormValues): Promise<AccountSubmitResult> => {
      const result = await saveNewAccount(db, values, nowIso());
      if (!result.ok) return result;
      await invalidateAfterWrite(queryClient);
      router.back();
      showToast(accountCreatedMessage(values.name.trim(), shown(rp(values.openingBalance), useHideAmounts.getState().hidden)));
      return { ok: true };
    },
    [db, queryClient, router],
  );
}

export function useChangeAccountSubmit(edit: AccountEditData | null | undefined) {
  const db = useDb();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(
    async (values: AccountFormValues): Promise<AccountSubmitResult> => {
      if (!edit) return { ok: false, message: accountChangesSavedMessage() };
      const result = await saveAccountChanges(db, edit.id, values, { firstRecordOn: edit.firstRecordOn ?? undefined });
      if (!result.ok) return result;
      await invalidateAfterWrite(queryClient);
      router.back();
      showToast(accountChangesSavedMessage());
      return { ok: true };
    },
    [db, queryClient, router, edit],
  );
}
