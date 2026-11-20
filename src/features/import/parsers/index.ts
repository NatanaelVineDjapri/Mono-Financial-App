// The entry of the notification parsers (docs/IMPORT_PLAN.md, section 6): a parser of the app's own first, then the
// general one. Today no app has one of its own (registry.ts: a format is never invented), so everything is read by
// the general parser and is "Ditebak". Returns null when the notification is not a transaction: the caller then
// forgets the text, which is never stored.
import { FULL_SUPPORT } from './registry';
import { parseGeneric, type ParsedNotification } from './generic';

export type { ParsedNotification } from './generic';

export interface ParsedWithLevel extends ParsedNotification {
  level: 'full' | 'generic';
}

export function parseNotification(pkg: string, title: string | null, text: string | null): ParsedWithLevel | null {
  // A dedicated parser would be looked up here by `pkg` (FULL_SUPPORT) and tried first.
  void FULL_SUPPORT;
  void pkg;
  const generic = parseGeneric(title, text);
  return generic ? { ...generic, level: 'generic' } : null;
}
