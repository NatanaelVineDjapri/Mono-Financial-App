package expo.modules.mononotificationlistener

/**
 * Where a forwarded notification waits for JavaScript. Memory only, never on disk: if the process
 * dies, whatever was waiting is gone, on purpose (the text of a message is not kept anywhere).
 *
 * While JS is listening the event is delivered at once and nothing is queued. When nobody is
 * listening the event is DROPPED, unless `retainWhenIdle` is on (a consumer that wants what it
 * missed turns it on); then it waits in a small queue (the newest MAX_QUEUED) until JS drains it.
 * Nothing consumes notifications yet, so it starts off.
 */
object NotificationBus {
  private const val MAX_QUEUED = 100

  private val queue = ArrayDeque<Map<String, Any?>>()

  @Volatile
  private var listener: ((Map<String, Any?>) -> Boolean)? = null

  /** Keep events for a JS that is not listening right now. Off by default. */
  @Volatile
  var retainWhenIdle: Boolean = false

  /** True while Android has the listener service bound (false when the system stopped it). */
  @Volatile
  var connected: Boolean = false

  /** `deliver` returns true when JS took the event. */
  fun setListener(deliver: ((Map<String, Any?>) -> Boolean)?) {
    listener = deliver
  }

  fun push(event: Map<String, Any?>) {
    val delivered = try {
      listener?.invoke(event) == true
    } catch (_: Throwable) {
      false
    }
    if (delivered || !retainWhenIdle) return
    synchronized(queue) {
      if (queue.size >= MAX_QUEUED) queue.removeFirst()
      queue.addLast(event)
    }
  }

  fun drain(): List<Map<String, Any?>> = synchronized(queue) {
    val all = queue.toList()
    queue.clear()
    all
  }
}
