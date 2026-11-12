package expo.modules.mononotificationlistener

/** What to do with one posted notification. */
enum class Decision {
  /** The app is switched on in MONO: hand the notification to JS. */
  FORWARD,

  /** Any other app: remember only that it posted something (package, name, time). No text. */
  RECORD_SEEN,

  /** Not for MONO at all: ignore it completely. */
  DROP,
}

/**
 * The allowlist rule (docs/IMPORT_PLAN.md, section 3), kept free of Android types so it can be
 * read and tested on its own. This is the filter that matters: a notification from an app that
 * is not switched on never reaches JavaScript and is never stored, in any form.
 */
object Allowlist {
  fun decide(
    packageName: String,
    ownPackage: String,
    allowed: Set<String>,
    isSystemApp: Boolean,
    isOngoing: Boolean,
    isGroupSummary: Boolean,
  ): Decision {
    if (packageName.isEmpty() || packageName == ownPackage) return Decision.DROP
    // A summary is Android's merge of several notifications: its text is not one transaction.
    if (isGroupSummary) return Decision.DROP
    // Ongoing notifications (downloads, music, navigation) are never a transaction.
    if (isOngoing) return Decision.DROP
    if (packageName in allowed) return Decision.FORWARD
    if (isSystemApp) return Decision.DROP
    return Decision.RECORD_SEEN
  }
}
