// __DEV__-only: schedules ONE real system notification a few seconds from now, written exactly like the ones the scheduler plans
// (same copy, same channel, same `data`, so a tap goes where a real one would), to try delivery, the banner, the tap and the
// Hide amounts mode without waiting for a due date. Not part of a release build: the Dev tools screen that calls it redirects away.
import * as Notifications from 'expo-notifications';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { renderNotification } from '@/features/notifications/copy';
import { setupNotificationChannels } from '@/features/notifications/scheduler';
import type { NotifPayload } from '@/domain/notify/types';

export type TestNotificationKind = 'daily' | 'bill_due';

const PAYLOADS: Record<TestNotificationKind, NotifPayload> = {
  daily: { kind: 'daily' },
  bill_due: { kind: 'bill_due', recurringId: 0, name: 'Internet', accountName: 'Bank BCA', amount: 385_000, amountVaries: 0, dueDate: '2026-11-25' },
};

export async function scheduleTestNotification(kind: TestNotificationKind, seconds = 10): Promise<'scheduled' | 'no_permission'> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'no_permission';
  await setupNotificationChannels();
  const hide = useHideAmounts.getState().hidden;
  const rendered = renderNotification(PAYLOADS[kind], { hideAmounts: hide });
  await Notifications.scheduleNotificationAsync({
    identifier: `dev-test:${kind}`,
    content: {
      title: rendered.title,
      body: rendered.body,
      data: { key: `dev-test:${kind}`, kind, hide },
    },
    // The Android channel belongs to the trigger, not to the content.
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: kind === 'bill_due' ? 'tagihan' : 'pengingat' },
  });
  return 'scheduled';
}
