package expo.modules.mononotificationlistener

/**
 * Where a forwarded notification waits for JavaScript. Memory only, never on disk.
 *
 * While JS is listening the event is delivered at once. When nobody is listening (MONO is closed
 * but the listener service is alive, which is how a banking notification usually arrives) it waits
 * in a small queue (the newest MAX_QUEUED) until JS drains it. If the process itself dies the queue
 * is gone, on purpose (the text of a message is not kept anywhere); what is still in the
 * notification shade is read again when the app opens (NotificationListener.activeAllowed).
 */
object NotificationBus {
  private const val MAX_QUEUED = 100

  private val queue = ArrayDeque<Map<String, Any?>>()

  @Volatile
  private var listener: ((Map<String, Any?>) -> Boolean)? = null

  /** True while Android has the listener service bound (false when the system stopped it). */
  @Volatile
  var connected: Boolean = false

  /** The bound service, to read what is in the shade right now. Null while it is not bound. */
  @Volatile
  var service: NotificationListener? = null

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
    if (delivered) return
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
