// Reads and writes of the per-app import settings, for the screens. Every change goes through the
// domain (src/domain/importApps.ts), which refuses a switch-on without a rupiah account, and then
// hands the native listener the new allowlist at once.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { listImportApps, type ImportAppRow } from '@/data/repo/importApps';
import { getImportStats, type ImportStats } from '@/data/repo/importStats';
import { activateImportApp, deactivateImportApp, ImportAppError, pendingReviewCount, setImportAppAccount, type ImportAppErrorCode } from '@/domain/importApps';

import { createIngestor } from './ingest';
import { getActiveAllowed } from './notifications/native';
import { pushAllowlist } from './notifications/sync';

export const importAppsKey = [...queryKeys.settings, 'import-apps'] as const;

export interface ImportAppsData {
  apps: ImportAppRow[];
  pending: number;
  stats: ImportStats; // per app: how many notifications were read and what became of them (counts only)
}

export function useImportApps() {
  const db = useDb();
  return useQuery({
    queryKey: importAppsKey,
    queryFn: async (): Promise<ImportAppsData> => ({ apps: await listImportApps(db), pending: await pendingReviewCount(db), stats: await getImportStats(db) }),
    staleTime: 0,
  });
}

export type ImportActionResult = { ok: true } | { ok: false; code: ImportAppErrorCode | 'unexpected' };

export function useImportAppActions() {
  const db = useDb();
  const queryClient = useQueryClient();

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<ImportActionResult> => {
      try {
        await action();
        await pushAllowlist(db);
        await invalidateAfterWrite(queryClient);
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error instanceof ImportAppError ? error.code : 'unexpected' };
      }
    },
    [db, queryClient],
  );

  // What a just switched-on app still shows in the bar goes to the review list at once, not at the next opening.
  const readBar = useCallback(
    async (pkg: string) => {
      const ingestor = createIngestor(db, () => void invalidateAfterWrite(queryClient));
      for (const raw of getActiveAllowed()) if (raw.package === pkg) void ingestor.push(raw);
      await ingestor.idle();
    },
    [db, queryClient],
  );

  return {
    // Switch an app on, to `accountId` (or the account it already has).
    activate: async (pkg: string, accountId: number | null) => {
      const result = await run(() => activateImportApp(db, pkg, accountId));
      if (result.ok) await readBar(pkg);
      return result;
    },
    deactivate: (pkg: string) => run(() => deactivateImportApp(db, pkg)),
    setAccount: (pkg: string, accountId: number | null) => run(() => setImportAppAccount(db, pkg, accountId)),
  };
}
