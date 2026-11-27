// Mounted once under the database provider (app/_layout.tsx). Brings the database and the native
// listener in step when the app opens and every time it comes back to the front: the apps the
// listener has seen become rows of import_app_settings, and the apps that are switched on become
// its allowlist (syncImportApps). It also carries the notifications of the allowed apps into the
// review queue: the live ones while the app is open, and at start and on every return to the front
// the ones the service kept while the app was closed, then whatever is still in the notification
// shade (for when Android had killed the process). The queue's fingerprint keeps them from being
// added twice. Draws nothing. Never throws: the listener may not be in this build.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { runAfterReady } from '@/core/appReady';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';

import { createIngestor, prune } from './ingest';
import { addNotificationListener, drainQueue, getActiveAllowed, isAccessEnabled, isConnected, requestRebind } from './notifications/native';
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
    let retry: ReturnType<typeof setTimeout> | undefined;
    const sweep = () => {
      for (const raw of getActiveAllowed()) void ingestor.push(raw, { seenAgain: true });
    };

    const run = async () => {
      try {
        const { recorded } = await syncImportApps(db);
        if (!cancelled && recorded > 0) await invalidateAfterWrite(queryClient);
        // What arrived while the app was closed.
        for (const raw of drainQueue()) void ingestor.push(raw);
        // The service can be unbound (an update was installed, or Android stopped it): ask for it
        // again and read the shade once it is back.
        if (isAccessEnabled() && !isConnected()) {
          requestRebind();
          clearTimeout(retry);
          retry = setTimeout(sweep, 1500);
        } else {
          sweep();
        }
      } catch {
        // Nothing to do: the next sync tries again.
      }
    };
    // The live listener below is attached at once, so no notification is lost; reading what the service kept while the app was
    // closed, and syncing the apps, start once the first screen has settled.
    const cancelStartupWork = runAfterReady(() => {
      void prune(db);
      void run();
    }, 800);
    const live = addNotificationListener(raw => void ingestor.push(raw));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      clearTimeout(retry);
      cancelStartupWork();
      live?.remove();
      subscription.remove();
    };
  }, [db, queryClient]);

  return null;
}
