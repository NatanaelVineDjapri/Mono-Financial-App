// What the More screen reads: when the last backup was made, how many fixed expenses are due, and
// the time zone to show it in. Read again every time the screen gets focus, so coming back from
// /backup updates the card at once. Nothing here is stored, and there are no amounts.
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { now } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getLastBackupAt } from '@/data/repo/backupLog';
import { getSetting } from '@/data/repo/settings';
import { listRecurringDue } from '@/domain/recurring';
import { useLanguage } from '@/i18n/lang';

import { backupState, type BackupState } from './backupStatus';

export interface MoreData {
  backup: BackupState;
  dueCount: number;
}

export function useMoreData(): MoreData {
  const db = useDb();
  const language = useLanguage(s => s.language);
  const { data, refetch } = useQuery({
    queryKey: [...queryKeys.settings, 'more'],
    queryFn: async () => {
      const [lastBackupAt, timezone, due] = await Promise.all([getLastBackupAt(db), getSetting(db, 'timezone'), listRecurringDue(db)]);
      return { lastBackupAt, timezone, dueCount: due.length };
    },
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return {
    backup: backupState(data?.lastBackupAt ?? null, now().getTime(), data?.timezone, language),
    dueCount: data?.dueCount ?? 0,
  };
}
