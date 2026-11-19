// __DEV__-only: runs a bundled .sql seed (tools/sample_data.sql, tools/november_transactions.sql) as ONE
// atomic transaction. The files carry their own BEGIN; and COMMIT; for use with the sqlite3 shell. Run through
// execAsync as they are, a script that fails half way (a duplicate id because the data is already loaded, say)
// leaves the connection inside its BEGIN, and every later attempt fails with "cannot start a transaction within a
// transaction" until the app is restarted. Here the outer BEGIN/COMMIT are dropped and the transaction is the
// database's own, so a failure rolls everything back and leaves nothing open.
import type { Db } from '@/data/db/types';

// A line that is only BEGIN; (or BEGIN TRANSACTION;) or only COMMIT; is the script's own wrapper.
export function stripOuterTransaction(sql: string): string {
  return sql.replace(/^[ \t]*(?:BEGIN(?:[ \t]+TRANSACTION)?|COMMIT)[ \t]*;[ \t]*$/gim, '');
}

// `replace`: every INSERT becomes INSERT OR REPLACE, so a seed that is already loaded is loaded again, not refused.
export function asReplace(sql: string): string {
  return sql.replace(/^([ \t]*)INSERT[ \t]+INTO\b/gim, '$1INSERT OR REPLACE INTO');
}

export async function runSqlScript(db: Db, sql: string, options: { replace?: boolean } = {}): Promise<void> {
  // A transaction left open by an earlier failed run (before this existed) would block the new one: close it.
  try {
    await db.execAsync('ROLLBACK');
  } catch {
    // none was open: nothing to do
  }
  await db.withExclusiveTransactionAsync(async txn => {
    const script = stripOuterTransaction(sql);
    await txn.execAsync(options.replace ? asReplace(script) : script);
  });
}
