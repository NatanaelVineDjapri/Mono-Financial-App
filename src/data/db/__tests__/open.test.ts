// initializeSchema is the decision open.ts's openDb() makes on every real launch: does
// this database have a schema yet, or not. openTestDb() can't exercise this — it always
// execs the schema unconditionally — so this uses openBareTestDb(), a connection with no
// tables at all, the same state a brand-new expo-sqlite file is in on first launch.
import * as fs from 'fs';
import * as path from 'path';

import { initializeSchema } from '../open';
import { openBareTestDb } from '../openTestDb';

const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, '../mono_schema_v1.sql'), 'utf8');
const loadSchemaSql = async () => SCHEMA_SQL;

describe('initializeSchema', () => {
  test('a database with no tables at all is not mistaken for an empty `meta` table', async () => {
    const db = openBareTestDb();
    await expect(db.getFirstAsync("select value from meta where key = 'schema_version'")).rejects.toThrow(/no such table/);
  });

  test('creates the schema on a genuinely fresh database', async () => {
    const db = openBareTestDb();
    await initializeSchema(db, loadSchemaSql);

    const version = await db.getFirstAsync<{ value: string }>("select value from meta where key = 'schema_version'");
    // Created from the v1 baseline, then brought up to date by the migrations.
    expect(version?.value).toBe('2');
  });

  test('a second call finds the existing schema and does not try to recreate it', async () => {
    const db = openBareTestDb();
    await initializeSchema(db, loadSchemaSql);

    await expect(initializeSchema(db, loadSchemaSql)).resolves.not.toThrow();
  });
});
