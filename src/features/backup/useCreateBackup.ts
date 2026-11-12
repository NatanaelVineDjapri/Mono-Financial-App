// The hook behind every "Buat cadangan" button: runs createBackup once (a second tap while it runs
// does nothing), then tells the person with a snackbar and refreshes what shows the backup status.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { showToast } from '@/components/toast-store';
import { sha256Hex } from '@/core/sha256';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { backupFailedToast, backupSavedToast } from '@/i18n';

import { createBackup } from './createBackup';
import { deviceBackupIo } from './deviceBackupIo';

export function useCreateBackup(): { create: () => Promise<boolean>; busy: boolean } {
  const db = useDb();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async (): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    try {
      const result = await createBackup(db, deviceBackupIo, sha256Hex);
      if (result.ok) {
        await invalidateAfterWrite(queryClient);
        showToast(backupSavedToast());
      } else {
        showToast(backupFailedToast());
      }
      return result.ok;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [db, queryClient]);

  return { create, busy };
}
