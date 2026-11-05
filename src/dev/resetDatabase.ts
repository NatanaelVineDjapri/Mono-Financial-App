// __DEV__-only: clears every entered-data table so the app starts empty again, without
// touching the schema's own reference/default rows (currencies, settings, categories).
// Order matches src/data/backup/restore.ts's DELETE_ORDER (children before parents, so
// every delete is FK-safe), minus the three tables a reset deliberately keeps.
import type { Db } from '@/data/db/types';

const DELETE_ORDER = [
  'recurring_events',
  'transactions',
  'recurring',
  'account_currencies',
  'budgets',
  'goals',
  'fx_rates',
  'monthly_limits',
  'accounts',
] as const;

export async function resetDatabase(db: Db): Promise<void> {
  await db.withExclusiveTransactionAsync(async txn => {
    await txn.runAsync("update meta set value = '1' where key = 'guards_off'");
    for (const table of DELETE_ORDER) {
      await txn.execAsync(`delete from ${table}`);
    }
    await txn.runAsync("update meta set value = '0' where key = 'guards_off'");
  });
}
