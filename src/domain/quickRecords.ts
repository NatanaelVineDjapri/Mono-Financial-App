// "Catat cepat" (Overview): the five things the person records most often, named either by the
// place they were at ("Kantor", "Rumah") or by the category they filed it under ("Transport",
// "Food & drink") — whichever repeats — so the form opens already filled in. Frequency is the
// number of records carrying that place or category over the last 90 days (what you do now, not
// what you did a year ago); ties go to the one used most recently.
// Read-only: it never changes a balance or a report.
import { today as clockToday } from '../core/clock';
import { addDays } from '../core/date';
import type { Db } from '../data/db/types';
import { listQuickRecordSources } from '../data/repo/transactions';

export const QUICK_RECORD_LIMIT = 5;
// Only the last 90 days count towards "most often", today included.
export const QUICK_RECORD_WINDOW_DAYS = 90;

export type QuickRecordSource = 'place' | 'category';

export interface QuickRecord {
  source: QuickRecordSource;
  label: string; // the place name or the category name, shown on the card
  placeName: string | null; // set on a place shortcut, so the form reuses it
  kind: 'income' | 'expense';
  accountId: number;
  accountName: string;
  categoryId: number | null;
  categoryName: string | null;
  amount: number; // rupiah, taken from the newest record of this shortcut
  count: number;
  lastOn: string;
}

export async function getQuickRecords(db: Db, limit = QUICK_RECORD_LIMIT, today = clockToday()): Promise<QuickRecord[]> {
  // The card is a five-item row by design; asking for more never widens it. The query already
  // drops a place that repeats a category's name, so the limit applies to distinct labels.
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), QUICK_RECORD_LIMIT);
  const since = addDays(today, -(QUICK_RECORD_WINDOW_DAYS - 1));
  const rows = await listQuickRecordSources(db, safeLimit, since);
  return rows.map(row => ({
    source: row.source,
    label: row.label.trim(),
    placeName: row.place_name,
    kind: row.kind,
    accountId: row.account_id,
    accountName: row.account_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    amount: row.amount,
    count: row.use_count,
    lastOn: row.last_on,
  }));
}
