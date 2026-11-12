package expo.modules.mononotificationlistener

import android.app.Notification
import android.content.ComponentName
import android.content.pm.ApplicationInfo
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Hears every notification Android posts, and lets almost all of them go by. The decision is
 * Allowlist.decide, made before anything is read from the notification:
 *   - an app that is switched on in MONO: its package, title, text and time go to JS;
 *   - any other app: only {package, app name, time} is remembered (ImportStore.recordSeen);
 *   - everything else is dropped.
 * Nothing in this class logs, and nothing is written to disk but the three fields above.
 */
class NotificationListener : NotificationListenerService() {
  override fun onListenerConnected() {
    NotificationBus.connected = true
  }

  override fun onListenerDisconnected() {
    NotificationBus.connected = false
    // Ask Android to bind us again (the system may have stopped us to save battery).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        requestRebind(ComponentName(this, NotificationListener::class.java))
      } catch (_: Throwable) {
        // Not allowed (access revoked): nothing to do.
      }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      val notification = sbn.notification ?: return
      val store = ImportStore(applicationContext)
      val info = applicationInfoOf(notification)
      val decision = Allowlist.decide(
        packageName = sbn.packageName ?: "",
        ownPackage = packageName,
        allowed = store.allowed(),
        isSystemApp = info?.let { isSystem(it) } ?: false,
        isOngoing = (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0,
        isGroupSummary = (notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0,
      )
      val now = System.currentTimeMillis()
      when (decision) {
        Decision.FORWARD -> {
          val extras = notification.extras
          NotificationBus.push(
            mapOf(
              "package" to sbn.packageName,
              "title" to extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
              "text" to extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
              "bigText" to extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
              "postedAt" to sbn.postTime.toDouble(),
            ),
          )
          store.markRead(now)
        }
        Decision.RECORD_SEEN -> store.recordSeen(sbn.packageName, appLabel(sbn.packageName, info), now)
        Decision.DROP -> Unit
      }
    } catch (_: Throwable) {
      // The service must never crash, and nothing about a notification may be logged.
    }
  }

  // The posting app's own ApplicationInfo travels inside the notification, which gives its name
  // without needing permission to list installed apps.
  @Suppress("DEPRECATION")
  private fun applicationInfoOf(notification: Notification): ApplicationInfo? = try {
    if (Build.VERSION.SDK_INT >= 33) {
      notification.extras?.getParcelable("android.appInfo", ApplicationInfo::class.java)
    } else {
      notification.extras?.getParcelable<ApplicationInfo>("android.appInfo")
    }
  } catch (_: Throwable) {
    null
  }

  private fun isSystem(info: ApplicationInfo): Boolean =
    (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0 && (info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0

  private fun appLabel(pkg: String, info: ApplicationInfo?): String {
    val fromInfo = try {
      info?.loadLabel(packageManager)?.toString()
    } catch (_: Throwable) {
      null
    }
    if (!fromInfo.isNullOrBlank()) return fromInfo
    return try {
      packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (_: Throwable) {
      pkg
    }
  }
}
