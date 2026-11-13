// Mounted once under the database provider (app/_layout.tsx). When "Perbarui otomatis" is on (the
// default; the person can switch it off), checks the rates when the app opens and each time it comes
// back to the front: the update runs only if the stored rates are older than a day and the service's
// own next-update time has passed (autoUpdateRates). It draws nothing, never blocks the app and never
// throws; on a failure the stored rates stay as they are.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { autoUpdateRates } from '@/domain/fx';
import { nowIso } from '@/core/clock';

export function FxAutoUpdate() {
  const db = useDb();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const outcome = await autoUpdateRates(db, nowIso());
        if (!cancelled && outcome.status === 'updated') await invalidateAfterWrite(queryClient);
      } catch {
        // Nothing to do: the next time the app opens it tries again.
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
