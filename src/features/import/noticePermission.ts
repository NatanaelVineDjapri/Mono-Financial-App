// MONO's "waiting for review" notification needs the permission to notify (asked once Android allows asking). Without
// it the import still works; only the notification is missing.
import * as Notifications from 'expo-notifications';

export async function ensureNoticePermission(): Promise<void> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // Not available in this build.
  }
}
