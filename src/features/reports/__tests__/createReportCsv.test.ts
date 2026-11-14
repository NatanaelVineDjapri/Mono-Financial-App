// The two Reports CSV exports: real database, fake device. Same shape as createBackup's
// own test — the `io` seam is the only thing replaced.
import { createAccount } from '../../../domain/accounts';
import { addExpense, addIncome, addTransfer } from '../../../domain/transactions';
import { listCategories } from '../../../data/repo/categories';
import { openTestDb } from '../../../data/db/openTestDb';
import type { Db } from '../../../data/db/types';
import {
  buildCsv,
  createBalancesCsv,
  createTransactionsCsv,
  csvEscape,
  type ReportIo,
} from '../createReportCsv';

const NOW = '2026-10-28T12:41:09+07:00';

async function fixture(): Promise<Db> {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const byName = (name: string) => categories.find(c => c.name === name)!.id;

  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: byName('Salary'), amount: 7000000, occurredOn: '2026-10-25' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: byName('Freelance'), amount: 500000, occurredOn: '2026-10-26' }, NOW);
  await addExpense(
    db,
    { accountId: bca, currency: 'IDR', categoryId: byName('Food & drink'), amount: 1425000, occurredOn: '2026-10-20', description: 'Makan, "enak"' },
    NOW,
  );
  await addExpense(
    db,
    { accountId: bca, currency: 'IDR', categoryId: byName('Bills'), amount: 1150000, occurredOn: '2026-10-21', description: 'Listrik' },
    NOW,
  );
  await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: cash, amount: 200000, occurredOn: '2026-10-27' }, NOW);
  return db;
}

function fakeIo(over: Partial<ReportIo> = {}): ReportIo & { written: { fileName: string; content: string }[]; shared: string[] } {
  const written: { fileName: string; content: string }[] = [];
  const shared: string[] = [];
  return {
    written,
    shared,
    write: async (fileName, content) => {
      written.push({ fileName, content });
      return { uri: `file:///cache/${fileName}` };
    },
    share: async uri => {
      shared.push(uri);
    },
    ...over,
  };
}

describe('csvEscape / buildCsv', () => {
  test('null and undefined become an empty cell, numbers stay plain', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape('BCA')).toBe('BCA');
  });

  test('commas, quotes and line breaks are quoted, inner quotes doubled', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  test('rows are CRLF separated and the file ends with one', () => {
    expect(buildCsv([['a', 'b'], [1, null]])).toBe('a,b\r\n1,\r\n');
  });
});

describe('createTransactionsCsv', () => {
  test('writes every record in the range, header first, then shares the file', async () => {
    const db = await fixture();
    const io = fakeIo();
    const result = await createTransactionsCsv(db, io, { start: '2026-10-01', end: '2026-10-31' });

    expect(result).toEqual({ ok: true, fileName: 'mono-transactions-2026-10-01-to-2026-10-31.csv', rowCount: 5 });
    expect(io.written.map(entry => entry.fileName)).toEqual(['mono-transactions-2026-10-01-to-2026-10-31.csv']);
    expect(io.shared).toEqual(['file:///cache/mono-transactions-2026-10-01-to-2026-10-31.csv']);

    const lines = io.written[0].content.split('\r\n');
    expect(lines[0]).toBe('Date,Type,Category,Account,Description,Amount,Currency,Amount (IDR),To account,To amount,To currency,Note');
    // A description with a comma and quotes survives RFC 4180 escaping.
    expect(lines.find(line => line.includes('Makan'))).toBe('2026-10-20,expense,Food & drink,BCA,"Makan, ""enak""",1425000,IDR,1425000,,,,');
    // A transfer names its destination account.
    expect(lines.find(line => line.startsWith('2026-10-27'))).toBe('2026-10-27,transfer,,BCA,,200000,IDR,200000,Cash,200000,IDR,');
  });

  test('only records inside the given dates are exported', async () => {
    const db = await fixture();
    const io = fakeIo();
    const result = await createTransactionsCsv(db, io, { start: '2026-10-25', end: '2026-10-31' });
    expect(result.ok && result.rowCount).toBe(3); // two income rows and the transfer
    expect(io.written[0].content).not.toContain('Listrik');
  });

  test('a failed write reports failed and never opens the share sheet', async () => {
    const db = await fixture();
    const io = fakeIo({
      write: async () => {
        throw new Error('disk full');
      },
    });
    expect(await createTransactionsCsv(db, io, { start: '2026-10-01', end: '2026-10-31' })).toEqual({ ok: false, reason: 'failed' });
    expect(io.shared).toEqual([]);
  });

  test('a share sheet that cannot open also reports failed', async () => {
    const db = await fixture();
    const io = fakeIo({
      share: async () => {
        throw new Error('sharing_unavailable');
      },
    });
    expect(await createTransactionsCsv(db, io, { start: '2026-10-01', end: '2026-10-31' })).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('createBalancesCsv', () => {
  test('one row per account, valued at the given calendar month end', async () => {
    const db = await fixture();
    const io = fakeIo();
    const result = await createBalancesCsv(db, io, { monthEnd: '2026-10-31' });

    expect(result).toEqual({ ok: true, fileName: 'mono-balances-2026-10-31.csv', rowCount: 2 });
    const lines = io.written[0].content.split('\r\n');
    expect(lines[0]).toBe('Account,Type,Currency,Balance,Value (IDR)');
    // BCA: 1.200.000 opening + 7.500.000 income − 1.425.000 − 1.150.000 − 200.000 transfer out.
    expect(lines).toContain('BCA,bank,IDR,5925000,5925000');
    expect(lines).toContain('Cash,cash,IDR,200000,200000');
  });

  test('a month end before the activity values the accounts as they were then', async () => {
    const db = await fixture();
    const io = fakeIo();
    await createBalancesCsv(db, io, { monthEnd: '2026-09-30' });
    const lines = io.written[0].content.split('\r\n');
    expect(lines).toContain('BCA,bank,IDR,1200000,1200000');
    expect(lines).toContain('Cash,cash,IDR,0,0');
  });
});