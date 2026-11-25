// What became of the notifications of each app the import reads, as plain counts: how many were read, how many became a row of
// the review queue, how many were the same payment again, and how many were thrown away, by reason. Only numbers: no title, no
// text, no amount ever lands here (CLAUDE.md rule 17). They let the person see WHY an app's notifications do not turn into
// transactions ("12 read, 12 without an amount"), which is otherwise invisible.
//
// Kept as one small JSON value in `settings` (key `import_stats`): no table of its own.
import type { Db } from '../db/types';
import { getSetting, setSetting } from './settings';

export const IMPORT_STATS_KEY = 'import_stats';

export type ImportOutcome =
  | 'queued'
  | 'duplicate'
  | 'no_account' // the app has no live rupiah account to send to
  | 'empty'
  | 'security'
  | 'reminder'
  | 'no_amount'
  | 'no_money_word'
  | 'promo';

export interface AppImportStats {
  read: number;
  queued: number;
  duplicate: number;
  no_account: number;
  empty: number;
  security: number;
  reminder: number;
  no_amount: number;
  no_money_word: number;
  promo: number;
}

export type ImportStats = Record<string, AppImportStats>;

const ZERO: AppImportStats = { read: 0, queued: 0, duplicate: 0, no_account: 0, empty: 0, security: 0, reminder: 0, no_amount: 0, no_money_word: 0, promo: 0 };

function parse(raw: string | null): ImportStats {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: ImportStats = {};
    for (const [pkg, counts] of Object.entries(value as Record<string, Partial<AppImportStats>>)) {
      const clean = { ...ZERO };
      for (const key of Object.keys(ZERO) as (keyof AppImportStats)[]) {
        const n = counts?.[key];
        if (typeof n === 'number' && Number.isFinite(n) && n >= 0) clean[key] = Math.floor(n);
      }
      out[pkg] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getImportStats(db: Db): Promise<ImportStats> {
  return parse(await getSetting(db, IMPORT_STATS_KEY));
}

// Counts one notification of `pkg`. Never throws: a counter must not stop an import.
export async function recordImportOutcome(db: Db, pkg: string, outcome: ImportOutcome): Promise<void> {
  try {
    const stats = await getImportStats(db);
    const row = stats[pkg] ?? { ...ZERO };
    row.read += 1;
    row[outcome] += 1;
    stats[pkg] = row;
    await setSetting(db, IMPORT_STATS_KEY, JSON.stringify(stats));
  } catch {
    // nothing to do
  }
}

export async function clearImportStats(db: Db): Promise<void> {
  await setSetting(db, IMPORT_STATS_KEY, '{}');
}
