// The second line of defence for the allowlist. The real filter is native (Allowlist.kt: a
// notification from an app that is not switched on never reaches JavaScript); this one makes sure
// that, even if something upstream let one through, JavaScript drops it before anything looks at
// its text. Pure and tested.
import type { NativeSeenApp, RawNotification } from './native';

// Only a notification from a package on the allowlist passes. Anything else is refused, whatever
// else it carries.
export function acceptNotification(event: Pick<RawNotification, 'package'> | null | undefined, allowed: ReadonlySet<string>): boolean {
  return !!event && typeof event.package === 'string' && event.package.length > 0 && allowed.has(event.package);
}

export function acceptAll(events: readonly RawNotification[], allowed: ReadonlySet<string>): RawNotification[] {
  return events.filter(e => acceptNotification(e, allowed));
}

// What the "seen apps" list from native may carry into the database: the package, the name and the
// time, and nothing else. An entry with any other shape is skipped, and any extra field is dropped.
export function sanitizeSeenApps(raw: readonly unknown[]): NativeSeenApp[] {
  const out: NativeSeenApp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.package !== 'string' || e.package.trim() === '') continue;
    if (typeof e.lastSeenAt !== 'number' || !Number.isFinite(e.lastSeenAt) || e.lastSeenAt <= 0) continue;
    out.push({
      package: e.package.trim(),
      appName: typeof e.appName === 'string' && e.appName.trim() !== '' ? e.appName.trim() : e.package.trim(),
      lastSeenAt: e.lastSeenAt,
    });
  }
  return out;
}
