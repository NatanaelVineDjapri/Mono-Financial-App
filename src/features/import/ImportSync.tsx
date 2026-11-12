// Mounted once under the database provider (app/_layout.tsx). Brings the database and the native
// listener in step when the app opens and every time it comes back to the front: the apps the
// listener has seen become rows of import_app_settings, and the apps that are switched on become
// its allowlist (syncImportApps). Draws nothing. Never throws: the listener may not be in this build.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';

import { syncImportApps } from './notifications/sync';

export function ImportSync() {
  const db = useDb();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { recorded } = await syncImportApps(db);
        if (!cancelled && recorded > 0) await invalidateAfterWrite(queryClient);
      } catch {
        // Nothing to do: the next sync tries again.
      }
    };
    void run();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [db, queryClient]);

  return null;
}
