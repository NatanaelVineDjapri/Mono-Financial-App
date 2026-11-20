// What the More screen reads: when the last backup was made and how many transactions changed since,
// how many fixed expenses are due, how many detected transactions wait for review, and the time zone the days are counted in. Read again every time the screen gets focus, so coming back from
// /backup updates the card at once. Nothing here is stored, and there are no amounts.
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { now } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { countTransactionsChangedSince, getLastBackupAt } from '@/data/repo/backupLog';
import { countPending } from '@/data/repo/importQueue';
import { getSetting } from '@/data/repo/settings';
import { listDue } from '@/domain/recurring';

import { backupState, type BackupState } from './backupStatus';

export interface MoreData {
  backup: BackupState;
  dueCount: number;
  importPending: number; // detected transactions waiting in the review queue
}

export function useMoreData(): MoreData {
  const db = useDb();
  const { data, refetch } = useQuery({
    queryKey: [...queryKeys.settings, 'more'],
    queryFn: async () => {
      const [lastBackupAt, timezone, due, importPending] = await Promise.all([getLastBackupAt(db), getSetting(db, 'timezone'), listDue(db), countPending(db)]);
      const changedSince = lastBackupAt ? await countTransactionsChangedSince(db, lastBackupAt) : 0;
      return { lastBackupAt, changedSince, timezone, dueCount: due.length, importPending };
    },
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return {
    backup: backupState(data?.lastBackupAt ?? null, data?.changedSince ?? 0, now().getTime(), data?.timezone),
    dueCount: data?.dueCount ?? 0,
    importPending: data?.importPending ?? 0,
  };
}
