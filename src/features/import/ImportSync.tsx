// Mounted once under the database provider (app/_layout.tsx). Brings the database and the native
// listener in step when the app opens and every time it comes back to the front: the apps the
// listener has seen become rows of import_app_settings, and the apps that are switched on become
// its allowlist (syncImportApps). It also carries the notifications of the allowed apps into the
// review queue: the ones the service kept while the app was closed (drained at start and on every
// return to the front) and the live ones while it is open. Draws nothing. Never throws: the
// listener may not be in this build.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';

import { createIngestor, prune } from './ingest';
import { addNotificationListener, drainQueue } from './notifications/native';
import { syncImportApps } from './notifications/sync';

export function ImportSync() {
  const db = useDb();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) void invalidateAfterWrite(queryClient);
    };
    const ingestor = createIngestor(db, refresh);

    const run = async () => {
      try {
        const { recorded } = await syncImportApps(db);
        if (!cancelled && recorded > 0) await invalidateAfterWrite(queryClient);
        // What arrived while the app was closed.
        for (const raw of drainQueue()) void ingestor.push(raw);
      } catch {
        // Nothing to do: the next sync tries again.
      }
    };
    void prune(db);
    void run();
    const live = addNotificationListener(raw => void ingestor.push(raw));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      live?.remove();
      subscription.remove();
    };
  }, [db, queryClient]);

  return null;
}
