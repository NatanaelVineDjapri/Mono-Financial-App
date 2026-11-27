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
    NotificationBus.service = this
    // What arrived while we were not bound and is still in the bar. Marked "again": it may have been handled before.
    for (event in activeAllowed()) NotificationBus.push(event + ("again" to true))
  }

  override fun onListenerDisconnected() {
    NotificationBus.connected = false
    NotificationBus.service = null
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
      val now = System.currentTimeMillis()
      when (decide(sbn, notification, info, store)) {
        Decision.FORWARD -> {
          NotificationBus.push(eventOf(sbn, notification))
          store.markRead(now)
        }
        Decision.RECORD_SEEN -> store.recordSeen(sbn.packageName, appLabel(sbn.packageName, info), now)
        Decision.DROP -> Unit
      }
    } catch (_: Throwable) {
      // The service must never crash, and nothing about a notification may be logged.
    }
  }

  /**
   * The notifications of switched-on apps that are in the shade right now: what arrived while the
   * process was not running. The same decision as for a new one, so no other app's text is read.
   */
  fun activeAllowed(): List<Map<String, Any?>> = try {
    val store = ImportStore(applicationContext)
    (activeNotifications ?: emptyArray()).mapNotNull { sbn ->
      val notification = sbn.notification ?: return@mapNotNull null
      val decision = decide(sbn, notification, applicationInfoOf(notification), store)
      if (decision == Decision.FORWARD) eventOf(sbn, notification) else null
    }
  } catch (_: Throwable) {
    emptyList()
  }

  private fun decide(sbn: StatusBarNotification, notification: Notification, info: ApplicationInfo?, store: ImportStore): Decision =
    Allowlist.decide(
      packageName = sbn.packageName ?: "",
      ownPackage = packageName,
      allowed = store.allowed(),
      isSystemApp = (info?.let { isSystem(it) } ?: false) && !store.devAllowSystem(),
      isOngoing = (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0,
      isGroupSummary = (notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0,
    )

  private fun eventOf(sbn: StatusBarNotification, notification: Notification): Map<String, Any?> {
    return mapOf(
      "package" to sbn.packageName,
      "title" to titleOf(notification),
      "text" to textOf(notification),
      "bigText" to notification.extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      "postedAt" to sbn.postTime.toDouble(),
    )
  }

  private fun titleOf(notification: Notification): String? =
    notification.extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()
      ?: notification.extras?.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()

  // The plain text, or for a list-style notification its lines.
  private fun textOf(notification: Notification): String? {
    val extras = notification.extras ?: return null
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    if (!text.isNullOrBlank() || !extras.getCharSequence(Notification.EXTRA_BIG_TEXT).isNullOrBlank()) return text
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES) ?: return text
    return lines.joinToString("\n").ifBlank { text }
  }

  /**
   * For the "Check reading" box: which notifications of switched-on apps and of BCA's apps are in the bar, and what
   * MONO would do with each. Facts about the notification only, never its title or text.
   */
  fun describeShade(): List<Map<String, Any>> = try {
    val store = ImportStore(applicationContext)
    val allowed = store.allowed()
    (activeNotifications ?: emptyArray())
      .filter { it.packageName in allowed || it.packageName.startsWith("com.bca") }
      .mapNotNull { sbn ->
        val notification = sbn.notification ?: return@mapNotNull null
        mapOf<String, Any>(
          "package" to sbn.packageName,
          "allowed" to (sbn.packageName in allowed),
          "ongoing" to ((notification.flags and Notification.FLAG_ONGOING_EVENT) != 0),
          "groupSummary" to ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0),
          "hasText" to (!textOf(notification).isNullOrBlank() || !notification.extras?.getCharSequence(Notification.EXTRA_BIG_TEXT).isNullOrBlank()),
        )
      }
  } catch (_: Throwable) {
    emptyList()
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
