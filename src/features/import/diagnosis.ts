// The "Check reading" box of Automatic import: where between the phone's notification bar and the review list things
// stop. Facts only (which apps, and what would happen to each notification): never a title, a text or an amount.
import {
  importCheckAccess,
  importCheckApps,
  importCheckRead,
  importCheckService,
  importCheckShadeEntry,
  importCheckShadeNone,
  importCheckSkipGroup,
  importCheckSkipNoText,
  importCheckSkipNotOn,
  importCheckSkipOngoing,
  importDropReason,
} from '@/i18n';

import * as native from './notifications/native';
import { explainNotification } from './parsers';

export interface Diagnosis {
  accessEnabled: boolean;
  connected: boolean;
  apps: string[]; // names of the apps switched on
  shade: (native.ShadeEntry & { dropped: string | null })[]; // dropped: why the reader would throw it away
}

export function diagnose(apps: string[]): Diagnosis {
  // The reader runs on the text here and now; only its reason for refusing is kept.
  const reasons = new Map<string, string | null>();
  for (const raw of native.getActiveAllowed()) {
    const body = raw.bigText && raw.bigText.length >= (raw.text?.length ?? 0) ? raw.bigText : raw.text;
    const outcome = explainNotification(raw.package, raw.title, body);
    reasons.set(raw.package, outcome.parsed ? null : outcome.dropped);
  }
  return {
    accessEnabled: native.isAccessEnabled(),
    connected: native.isConnected(),
    apps,
    shade: native.describeShade().map(entry => ({ ...entry, dropped: reasons.get(entry.package) ?? null })),
  };
}

export function diagnosisLines(d: Diagnosis): string[] {
  const status = (e: Diagnosis['shade'][number]) =>
    !e.allowed ? importCheckSkipNotOn() : e.groupSummary ? importCheckSkipGroup() : e.ongoing ? importCheckSkipOngoing() : !e.hasText ? importCheckSkipNoText() : e.dropped ? importDropReason(e.dropped) : importCheckRead();
  return [
    importCheckAccess(d.accessEnabled),
    importCheckService(d.connected),
    importCheckApps(d.apps.join(', ')),
    ...(d.shade.length === 0 ? [importCheckShadeNone()] : d.shade.map(e => importCheckShadeEntry(e.package, status(e)))),
  ];
}
