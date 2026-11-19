// Materialises inbox items for scheduled notifications that fired while the app was closed.
// Called on app open / focus. No React, no expo deps.
import type { InboxItem, NotifPayload, PlanState, ScheduleItem } from './types';

/**
 * For each ScheduleItem whose `at` is between `lastOpenedAt` and `now`,
 * check whether the condition still applies and emit an InboxItem (once).
 */
export function materializeDue(
  now: Date,
  lastOpenedAt: Date,
  scheduled: ScheduleItem[],
  state: PlanState,
  existingKeys: Set<string>,
): InboxItem[] {
  const results: InboxItem[] = [];

  for (const item of scheduled) {
    if (item.at > now) continue;        // not yet fired
    if (item.at <= lastOpenedAt) continue; // already seen on a prior open
    if (existingKeys.has(item.key)) continue; // already in inbox

    const payload = item.payload;

    // Condition checks: skip if the trigger condition is no longer valid.
    if (payload.kind === 'daily' && state.hasTransactionToday) continue;
    if (payload.kind === 'bill_due') {
      const rec = state.activeRecurring.find(r => r.id === payload.recurringId);
      if (!rec || rec.confirmedDates.has(payload.dueDate)) continue;
    }
    if (payload.kind === 'bill_overdue') {
      const rec = state.activeRecurring.find(r => r.id === payload.recurringId);
      if (!rec || rec.confirmedDates.has(payload.dueDate)) continue;
    }
    if (payload.kind === 'backup' && state.lastBackupAt !== null) {
      // If a backup was made since the reminder fired, skip.
      const backedAt = new Date(state.lastBackupAt);
      if (backedAt >= item.at) continue;
    }

    results.push({
      kind: item.kind,
      dedupe_key: item.key,
      payload: item.payload as NotifPayload,
      created_at: item.at.toISOString(),
    });
  }

  return results;
}
