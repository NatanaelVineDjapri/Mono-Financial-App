// The two CSV exports on Reports (PAGES.md H · Reports). Pure string building, with the
// device behind `io` so the same functions run under Jest with a fake — exactly the shape
// of src/features/backup/createBackup.ts. Nothing here reads React or the clock.
import type { Db } from '../../data/db/types';
import * as repo from '../../data/repo/reports';

export interface ReportIo {
  // Writes the file into the app's cache, replacing an earlier export of the same name.
  write(fileName: string, content: string): Promise<{ uri: string }>;
  // Opens the system share sheet; rejects when sharing is not possible.
  share(uri: string): Promise<void>;
}

export type ReportCsvResult =
  | { ok: true; fileName: string; rowCount: number }
  | { ok: false; reason: 'failed' };

// RFC 4180-style escaping: wrap in quotes when the value has a comma, quote or line
// break, and double any inner quote.
export function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

function transactionsFileName(start: string, end: string): string {
  return `mono-transactions-${start}-to-${end}.csv`;
}

function balancesFileName(monthEnd: string): string {
  return `mono-balances-${monthEnd}.csv`;
}

export interface TransactionsCsvInput {
  start: string;
  end: string;
}

export async function createTransactionsCsv(
  db: Db,
  io: ReportIo,
  input: TransactionsCsvInput,
): Promise<ReportCsvResult> {
  try {
    const rows = await repo.listTransactionsForRange(db, input.start, input.end);
    const body = buildCsv([
      ['Date', 'Type', 'Category', 'Account', 'Description', 'Amount', 'Currency', 'Amount (IDR)', 'To account', 'To amount', 'To currency', 'Note'],
      ...rows.map(row => [
        row.occurred_on,
        row.kind,
        row.category_name,
        row.account_name,
        row.description,
        row.amount,
        row.currency,
        row.amount_idr,
        row.to_account_name,
        row.amount_to,
        row.to_currency,
        row.note,
      ]),
    ]);
    const fileName = transactionsFileName(input.start, input.end);
    const { uri } = await io.write(fileName, body);
    await io.share(uri);
    return { ok: true, fileName, rowCount: rows.length };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export interface BalancesCsvInput {
  monthEnd: string;
}

export async function createBalancesCsv(
  db: Db,
  io: ReportIo,
  input: BalancesCsvInput,
): Promise<ReportCsvResult> {
  try {
    const rows = await repo.listAccountBalancesAtMonthEnd(db, input.monthEnd);
    const body = buildCsv([
      ['Account', 'Type', 'Currency', 'Balance', 'Value (IDR)'],
      ...rows.map(row => [row.account_name, row.account_type, row.currency, row.balance, row.value_idr]),
    ]);
    const fileName = balancesFileName(input.monthEnd);
    const { uri } = await io.write(fileName, body);
    await io.share(uri);
    return { ok: true, fileName, rowCount: rows.length };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
