package expo.modules.mononotificationlistener

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * MONO's own notification saying a transaction is waiting for review. Posted from here, not from JavaScript, because a
 * bank notification usually arrives while MONO is closed. It names the app only: never an amount or the message.
 * Nothing is saved by it; tapping it opens the review list, where the text is read (src/features/import).
 */
object ReviewNotice {
  private const val CHANNEL = "mono_import_review"
  private const val REPEAT_MS = 2 * 60 * 1000L

  // A cheap first look, so a one-time code or an advert does not ring. The real reader is the JavaScript parser.
  private val amount = Regex("(rp\\.?|idr)\\s*\\d", RegexOption.IGNORE_CASE)
  private val money = Regex(
    "pemasukan|pengeluaran|transfer|bayar|pembayaran|pembelian|qris|debit|kredit|dana (masuk|keluar)|uang (masuk|keluar)|top ?up|diterima|menerima|tarik|payment|received",
    RegexOption.IGNORE_CASE,
  )
  private val never = Regex("\\botp\\b|kode (verifikasi|otp|rahasia|keamanan)|verification code|password|kata sandi|jatuh tempo", RegexOption.IGNORE_CASE)
  private val advert = Regex("promo|diskon|voucher|undian|hadiah|s\\.d\\.|hingga", RegexOption.IGNORE_CASE)
  private val done = Regex("pemasukan|pengeluaran|berhasil|telah", RegexOption.IGNORE_CASE)

  private val recent = HashMap<String, Long>()

  fun looksLikeMoney(message: String): Boolean =
    amount.containsMatchIn(message) && money.containsMatchIn(message) && !never.containsMatchIn(message) &&
      (!advert.containsMatchIn(message) || done.containsMatchIn(message))

  /** `key` identifies one posting, so an app updating its notification does not ring twice. */
  @Synchronized
  fun post(context: Context, store: ImportStore, packageName: String, appName: String, key: String) {
    val words = store.reviewNotice() ?: return // JavaScript has not given the sentences yet
    val now = System.currentTimeMillis()
    recent.entries.removeAll { now - it.value > REPEAT_MS }
    if (recent.put(key, now) != null) return

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL, words.channel, NotificationManager.IMPORTANCE_DEFAULT))
      Notification.Builder(context, CHANNEL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    val open = Intent(Intent.ACTION_VIEW, Uri.parse("monofinance://import/review"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon

    builder
      .setSmallIcon(icon)
      .setContentTitle(words.title)
      .setContentText(words.body.replace("{app}", appName))
      .setContentIntent(PendingIntent.getActivity(context, 0, open, flags))
      .setAutoCancel(true)

    // One per bank app: a newer one replaces the older. Without the permission (Android 13+) this does nothing.
    manager.notify(("review:" + packageName).hashCode(), builder.build())
  }
}

data class ReviewWords(val title: String, val body: String, val channel: String)
