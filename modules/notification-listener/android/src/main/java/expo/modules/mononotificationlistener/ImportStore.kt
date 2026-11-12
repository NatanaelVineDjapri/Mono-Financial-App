package expo.modules.mononotificationlistener

import android.content.Context
import org.json.JSONObject

/**
 * The little the native side remembers, in SharedPreferences (so the service works even when
 * JavaScript is not running): the allowlist JS gave it, when it last read an allowed notification,
 * and the apps that posted a notification while they were not allowed.
 *
 * What is kept about an app: package, name, last time. There is no field for a title or a text,
 * so none can be stored here.
 */
class ImportStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun allowed(): Set<String> = prefs.getStringSet(KEY_ALLOWED, emptySet())?.toSet() ?: emptySet()

  fun setAllowed(packages: Collection<String>) {
    prefs.edit().putStringSet(KEY_ALLOWED, packages.filter { it.isNotBlank() }.toSet()).apply()
  }

  /**
   * Development only: let system apps through too. An emulator has no banking apps, and
   * `adb shell cmd notification post` posts as a system package; with this on it can be seen,
   * switched on and read like any other app. JS only ever turns it on from the dev sampler.
   */
  fun devAllowSystem(): Boolean = prefs.getBoolean(KEY_DEV_SYSTEM, false)

  fun setDevAllowSystem(allow: Boolean) {
    prefs.edit().putBoolean(KEY_DEV_SYSTEM, allow).apply()
  }

  fun lastReadAt(): Long = prefs.getLong(KEY_LAST_READ, 0L)

  fun markRead(at: Long) {
    prefs.edit().putLong(KEY_LAST_READ, at).apply()
  }

  /** Remember that `pkg` posted a notification at `at`. At most once a minute per app. */
  @Synchronized
  fun recordSeen(pkg: String, appName: String, at: Long) {
    val seen = JSONObject(prefs.getString(KEY_SEEN, "{}") ?: "{}")
    val known = seen.optJSONObject(pkg)
    if (known != null && known.optString("n") == appName && at - known.optLong("t") < MIN_INTERVAL_MS) return
    seen.put(pkg, JSONObject().put("n", appName).put("t", at))
    // Keep the list short: drop the oldest beyond MAX_APPS.
    if (seen.length() > MAX_APPS) {
      val oldest = seen.keys().asSequence().minByOrNull { seen.getJSONObject(it).optLong("t") }
      if (oldest != null) seen.remove(oldest)
    }
    prefs.edit().putString(KEY_SEEN, seen.toString()).apply()
  }

  /** Newest first, at most MAX_LISTED. Each entry is {package, appName, lastSeenAt}. */
  @Synchronized
  fun seenApps(): List<Map<String, Any>> {
    val seen = JSONObject(prefs.getString(KEY_SEEN, "{}") ?: "{}")
    return seen.keys().asSequence()
      .map { pkg ->
        val entry = seen.getJSONObject(pkg)
        mapOf<String, Any>(
          "package" to pkg,
          "appName" to entry.optString("n", pkg),
          "lastSeenAt" to entry.optLong("t").toDouble(),
        )
      }
      .sortedByDescending { it["lastSeenAt"] as Double }
      .take(MAX_LISTED)
      .toList()
  }

  @Synchronized
  fun forget(pkg: String) {
    val seen = JSONObject(prefs.getString(KEY_SEEN, "{}") ?: "{}")
    if (seen.remove(pkg) != null) prefs.edit().putString(KEY_SEEN, seen.toString()).apply()
  }

  companion object {
    private const val NAME = "mono_notification_import"
    private const val KEY_ALLOWED = "allowed_packages"
    private const val KEY_LAST_READ = "last_read_at"
    private const val KEY_SEEN = "seen_apps"
    private const val KEY_DEV_SYSTEM = "dev_allow_system"
    private const val MIN_INTERVAL_MS = 60_000L
    private const val MAX_APPS = 100
    private const val MAX_LISTED = 50
  }
}
