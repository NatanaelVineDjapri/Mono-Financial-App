// Mounts once at app root. Sets up Android channels, registers the notification
// response listener (tap-to-navigate), and syncs the schedule on first open.
// Budget/goal alerts are handled at write time (alerts.ts), not here.
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { useDb } from '@/data/db/DbProvider';
import { markRead } from '@/data/repo/notifications';
import { pruneNotifications } from '@/data/repo/notifications';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { scheduleSync, setupNotificationChannels, syncNotifications } from './scheduler';

// A reminder that fires while MONO is open is shown too (a banner, no sound): without a handler Android drops it silently
// and it would look as if it never came.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function NotificationsInit() {
  const db = useDb();
  const router = useRouter();
  const queryClient = useQueryClient();
  // The screens exist only once the navigator has mounted: a tap that opened the app must wait for it, or the push is lost.
  const navigationReady = useRootNavigationState()?.key != null;
  const coldStartHandled = useRef(false);

  function handleResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as { key?: string; kind?: string } | null;
    if (!data) return;
    // Navigate based on kind
    switch (data.kind) {
      case 'daily': router.push('/tx/add' as never); break;
      case 'bill_due':
      case 'bill_overdue': router.push('/recurring' as never); break;
      case 'budget_near':
      case 'budget_over': router.push('/budgets' as never); break;
      case 'goal_milestone': router.push('/goals' as never); break;
      case 'backup': router.push('/backup' as never); break;
    }
  }

  useEffect(() => {
    // Set up Android channels once.
    void setupNotificationChannels();

    // Prune old inbox items on launch.
    void pruneNotifications(db, new Date().toISOString()).then(() =>
      invalidateAfterWrite(queryClient),
    );

    // Initial schedule sync.
    void syncNotifications(db);

    // Handle taps while app is running.
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Re-check permission and re-sync when app comes to foreground.
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void syncNotifications(db);
        void pruneNotifications(db, new Date().toISOString()).then(() =>
          invalidateAfterWrite(queryClient),
        );
      }
    });

    // The text of a scheduled reminder depends on the Hide amounts mode: write them again when it changes.
    const hideSub = useHideAmounts.subscribe((state, previous) => {
      if (state.hidden !== previous.hidden) scheduleSync(db);
    });

    return () => {
      sub.remove();
      appStateSub.remove();
      hideSub();
    };
  }, [db, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps -- handleResponse only reads the router

  // Handle the tap that opened the app (it was closed), once, as soon as the navigator is there.
  useEffect(() => {
    if (!navigationReady || coldStartHandled.current) return;
    coldStartHandled.current = true;
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) handleResponse(response);
    });
  }, [navigationReady]); // eslint-disable-line react-hooks/exhaustive-deps -- handleResponse only reads the router

  return null;
}
