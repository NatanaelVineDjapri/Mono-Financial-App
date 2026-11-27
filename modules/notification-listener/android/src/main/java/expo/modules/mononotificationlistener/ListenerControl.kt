package expo.modules.mononotificationlistener

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService

/**
 * Getting Android to bind the listener again. After MONO is updated (an APK installed over it), or when a phone stops
 * background services, notification access still says "on" while no service is running, and nothing arrives.
 */
object ListenerControl {
  private fun component(context: Context) = ComponentName(context, NotificationListener::class.java)

  /** The polite way: ask Android to bind us. Not always honoured. */
  fun requestRebind(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
    try {
      NotificationListenerService.requestRebind(component(context))
    } catch (_: Throwable) {
      // Not allowed (access revoked): nothing to do.
    }
  }

  /** For when asking is not enough: switch the service component off and on, which makes Android look at it afresh. */
  fun restart(context: Context) {
    try {
      val pm = context.packageManager
      pm.setComponentEnabledSetting(component(context), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      pm.setComponentEnabledSetting(component(context), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
    } catch (_: Throwable) {
      // The request below is still worth making.
    }
    requestRebind(context)
  }
}

/** Runs once after MONO has been updated, so the listener comes back without the app being opened. */
class ListenerRevivalReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) ListenerControl.requestRebind(context)
  }
}
