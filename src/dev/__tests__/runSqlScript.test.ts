import * as fs from 'fs';
import * as path from 'path';

import { openMigratedTestDb, openTestDb } from '@/data/db/openTestDb';

import { resetDatabase } from '../resetDatabase';
import { asReplace, runSqlScript, stripOuterTransaction } from '../runSqlScript';

describe('stripOuterTransaction', () => {
  test('drops the script\'s own BEGIN; and COMMIT; and nothing else', () => {
    const sql = '-- note\nBEGIN;\nINSERT INTO a VALUES (1);\n  commit ;\n';
    const out = stripOuterTransaction(sql);
    expect(out).not.toMatch(/^\s*BEGIN/im);
    expect(out).not.toMatch(/^\s*commit/im);
    expect(out).toContain('INSERT INTO a VALUES (1);');
    expect(out).toContain('-- note');
  });

  test('leaves a BEGIN inside a statement or a trigger body alone', () => {
    const sql = 'CREATE TRIGGER t BEFORE INSERT ON x\nBEGIN\n  SELECT 1;\nEND;';
    expect(stripOuterTransaction(sql)).toBe(sql);
  });
});

describe('runSqlScript with the real seeds', () => {
  const tools = path.join(__dirname, '..', '..', '..', 'tools');

  test('the sample data loads, and loading it twice fails cleanly instead of leaving a transaction open', async () => {
    const db = openTestDb();
    const sample = fs.readFileSync(path.join(tools, 'sample_data.sql'), 'utf8');
    await runSqlScript(db, sample);
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts'))!.n).toBe(4);

    await expect(runSqlScript(db, sample)).rejects.toThrow();
    // nothing was left half done or open: the data is as before and a new transaction can start
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts'))!.n).toBe(4);
    await expect(db.execAsync('BEGIN; COMMIT;')).resolves.toBeUndefined();
  });

  test('the November transactions load on top of the sample', async () => {
    const db = openTestDb();
    await runSqlScript(db, fs.readFileSync(path.join(tools, 'sample_data.sql'), 'utf8'));
    const before = (await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n;
    await runSqlScript(db, fs.readFileSync(path.join(tools, 'november_transactions.sql'), 'utf8'));
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBeGreaterThan(before);
  });

  test('a script that fails half way rolls everything back', async () => {
    const db = openTestDb();
    const sample = fs.readFileSync(path.join(tools, 'sample_data.sql'), 'utf8');
    await expect(runSqlScript(db, `${sample}\nINSERT INTO accounts (id) VALUES (999);`)).rejects.toThrow();
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts'))!.n).toBe(0);
  });
});

describe('pressing the dev buttons again', () => {
  const tools = path.join(__dirname, '..', '..', '..', 'tools');
  const sample = () => fs.readFileSync(path.join(tools, 'sample_data.sql'), 'utf8');
  const november = () => fs.readFileSync(path.join(tools, 'november_transactions.sql'), 'utf8');
  const count = async (db: ReturnType<typeof openTestDb>, table: string) => (await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`))!.n;

  test('"Load sample data" after data exists: reset, then load, so it works every time', async () => {
    const db = await openMigratedTestDb();
    await runSqlScript(db, sample());
    const accounts = await count(db, 'accounts');
    const transactions = await count(db, 'transactions');
    await resetDatabase(db);
    expect(await count(db, 'accounts')).toBe(0);
    await runSqlScript(db, sample());
    expect(await count(db, 'accounts')).toBe(accounts);
    expect(await count(db, 'transactions')).toBe(transactions);
  });

  test('"+ Add November transactions" twice: the second time loads them again instead of failing', async () => {
    const db = openTestDb();
    await runSqlScript(db, sample());
    await runSqlScript(db, november(), { replace: true });
    const once = await count(db, 'transactions');
    await runSqlScript(db, november(), { replace: true });
    expect(await count(db, 'transactions')).toBe(once);
  });

  test('asReplace changes the INSERTs and nothing else', () => {
    expect(asReplace('INSERT INTO a VALUES (1);\n  insert into b VALUES (2);\n-- INSERT INTO in a comment is a comment\nSELECT 1;')).toBe(
      'INSERT OR REPLACE INTO a VALUES (1);\n  INSERT OR REPLACE INTO b VALUES (2);\n-- INSERT INTO in a comment is a comment\nSELECT 1;',
    );
  });
});
