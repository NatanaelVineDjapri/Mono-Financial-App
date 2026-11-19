// Mounts once at app root. Sets up Android channels, registers the notification
// response listener (tap-to-navigate), and syncs the schedule on first open.
// Budget/goal alerts are handled at write time (alerts.ts), not here.
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { markRead } from '@/data/repo/notifications';
import { pruneNotifications } from '@/data/repo/notifications';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { setupNotificationChannels, syncNotifications } from './scheduler';

export function NotificationsInit() {
  const db = useDb();
  const router = useRouter();
  const queryClient = useQueryClient();

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

    // Handle cold-start tap (app was closed).
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) handleResponse(response);
    });

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

    return () => {
      sub.remove();
      appStateSub.remove();
    };
  }, [db, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps -- handleResponse only reads the router

  return null;
}
