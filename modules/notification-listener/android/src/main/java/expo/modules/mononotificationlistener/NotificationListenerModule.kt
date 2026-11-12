package expo.modules.mononotificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bridge to JavaScript. JS gives it the allowlist (the apps switched on); the listener service
 * does the filtering. Everything here is about access, settings and the few fields described in
 * ImportStore; there is no function that returns the text of a notification except `drainQueue`,
 * and that only holds notifications of allowed apps.
 */
class NotificationListenerModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context lost" }

  private val store: ImportStore
    get() = ImportStore(context)

  override fun definition() = ModuleDefinition {
    Name("MonoNotificationListener")

    Events("onNotification")

    OnCreate {
      NotificationBus.setListener { event ->
        if (appContext.hasActiveReactInstance) {
          sendEvent("onNotification", event)
          true
        } else {
          false
        }
      }
    }

    OnDestroy {
      NotificationBus.setListener(null)
    }

    // ---- access and the system's own settings screens
    Function("isAccessEnabled") {
      val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      flat.split(":").mapNotNull { ComponentName.unflattenFromString(it) }.any { it.packageName == context.packageName }
    }

    Function("isConnected") { NotificationBus.connected }

    Function("openAccessSettings") { openSettings(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }

    Function("openAppInfo") {
      openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    Function("isIgnoringBatteryOptimizations") {
      val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      power?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    Function("openBatterySettings") { openSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }

    Function("requestRebind") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        NotificationListenerService.requestRebind(ComponentName(context, NotificationListener::class.java))
      }
    }

    // ---- the allowlist and what the service remembers
    // Development only (the dev sampler): treat system apps like any other app, for the emulator.
    Function("setDevAllowSystemApps") { allow: Boolean -> store.setDevAllowSystem(allow) }

    Function("getDevAllowSystemApps") { store.devAllowSystem() }

    Function("setAllowedPackages") { packages: List<String> -> store.setAllowed(packages) }

    Function("getAllowedPackages") { store.allowed().toList() }

    Function("getSeenApps") { store.seenApps() }

    Function("forgetSeenApp") { pkg: String -> store.forget(pkg) }

    Function("getLastReadAt") { store.lastReadAt().takeIf { it > 0L }?.toDouble() }

    // Keep (or stop keeping) notifications of allowed apps that arrive while JS is not listening.
    Function("setRetainWhenIdle") { retain: Boolean -> NotificationBus.retainWhenIdle = retain }

    // Notifications of allowed apps that arrived while JS was not listening (only if retained).
    Function("drainQueue") { NotificationBus.drain() }
  }

  private fun openSettings(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (_: Throwable) {
      // This phone has no such settings screen: the guide in the app says where to look.
    }
  }
}
