// __DEV__-only: replaces everything in the database with the contents of a .sql file the person picks (for example one made by
// tools/cashew_to_sql.py from a Cashew export). The file holds personal data, so it is never bundled with the app and never in
// git; it is read from wherever the person keeps it.
//
// ONE transaction: the entered data is cleared, the script runs (it may switch the guards off while it loads, like a restore), and
// v_integrity_issues is read. If anything throws or any row comes back, everything rolls back and the old data is still there.
import { File } from 'expo-file-system';

import type { Db } from '@/data/db/types';

import { clearEnteredData } from './resetDatabase';
import { stripOuterTransaction } from './runSqlScript';

export interface ImportSummary {
  accounts: number;
  transactions: number;
}

export class ImportIntegrityError extends Error {
  readonly issues: { issue: string; ref: string }[];
  constructor(issues: { issue: string; ref: string }[]) {
    super(`The data did not pass the integrity check (${issues.length} problem${issues.length === 1 ? '' : 's'}): ${issues.slice(0, 3).map(i => i.issue).join(', ')}`);
    this.name = 'ImportIntegrityError';
    this.issues = issues;
  }
}

export async function importSqlText(db: Db, sql: string): Promise<ImportSummary> {
  // A transaction left open by an earlier failed run would block this one: close it.
  try {
    await db.execAsync('ROLLBACK');
  } catch {
    // none was open
  }
  await db.withExclusiveTransactionAsync(async txn => {
    await clearEnteredData(txn);
    await txn.execAsync(stripOuterTransaction(sql));
    // The script's own guards_off must be back to 0 for the check below to mean anything.
    await txn.runAsync("update meta set value = '0' where key = 'guards_off'");
    const issues = await txn.getAllAsync<{ issue: string; ref: string }>('select issue, ref from v_integrity_issues');
    if (issues.length > 0) throw new ImportIntegrityError(issues);
  });
  const accounts = await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts');
  const transactions = await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions');
  return { accounts: accounts?.n ?? 0, transactions: transactions?.n ?? 0 };
}

// The system's file picker, then importSqlText. null when the person backed out.
export async function pickAndImportSql(db: Db): Promise<ImportSummary | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/sql', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  return importSqlText(db, await picked.result.text());
}
