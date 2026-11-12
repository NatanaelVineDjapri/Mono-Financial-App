package expo.modules.mononotificationlistener

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The allowlist rule, on its own: a notification from an app that is not switched on is never
 * forwarded to JavaScript. Run with `./gradlew :notification-listener:testDebugUnitTest`.
 */
class AllowlistTest {
  private val own = "com.anonymous.monofinance"
  private val allowed = setOf("com.bca.mobile", "com.gojek.gopay")

  private fun decide(
    pkg: String,
    allowed: Set<String> = this.allowed,
    system: Boolean = false,
    ongoing: Boolean = false,
    summary: Boolean = false,
  ) = Allowlist.decide(pkg, own, allowed, system, ongoing, summary)

  @Test
  fun anAllowedAppIsForwarded() {
    assertEquals(Decision.FORWARD, decide("com.bca.mobile"))
    assertEquals(Decision.FORWARD, decide("com.gojek.gopay"))
  }

  @Test
  fun aPackageThatIsNotAllowedIsNeverForwarded() {
    assertEquals(Decision.RECORD_SEEN, decide("com.whatsapp"))
    assertEquals(Decision.RECORD_SEEN, decide("com.bca.mobile.fake"))
    assertEquals(Decision.RECORD_SEEN, decide("COM.BCA.MOBILE"))
  }

  @Test
  fun anEmptyAllowlistForwardsNothing() {
    assertEquals(Decision.RECORD_SEEN, decide("com.bca.mobile", allowed = emptySet()))
  }

  @Test
  fun anAppThatIsNotAllowedOnlyEverGetsRecordedAsSeenOrDropped() {
    val everything = listOf(false, true).flatMap { system ->
      listOf(false, true).flatMap { ongoing ->
        listOf(false, true).map { summary -> decide("com.whatsapp", system = system, ongoing = ongoing, summary = summary) }
      }
    }
    assertEquals(false, everything.contains(Decision.FORWARD))
  }

  @Test
  fun monoItselfIsDropped() {
    assertEquals(Decision.DROP, decide(own))
    assertEquals(Decision.DROP, decide(own, allowed = setOf(own)))
  }

  @Test
  fun anEmptyPackageIsDropped() {
    assertEquals(Decision.DROP, decide(""))
  }

  @Test
  fun aGroupSummaryIsDroppedEvenForAnAllowedApp() {
    assertEquals(Decision.DROP, decide("com.bca.mobile", summary = true))
  }

  @Test
  fun anOngoingNotificationIsDroppedEvenForAnAllowedApp() {
    assertEquals(Decision.DROP, decide("com.bca.mobile", ongoing = true))
  }

  @Test
  fun aSystemAppThatIsNotAllowedIsDroppedAndNotEvenListedAsSeen() {
    assertEquals(Decision.DROP, decide("com.android.systemui", system = true))
  }

  @Test
  fun anAllowedAppIsForwardedEvenIfItIsFlaggedAsASystemApp() {
    assertEquals(Decision.FORWARD, decide("com.bca.mobile", system = true))
  }
}
