import { openTestDb } from '../../openTestDb';
import { migrations, runMigrations } from '../index';

// The real migration is put back after each test that swaps in its own.
const real = migrations[1];

describe('runMigrations', () => {
  test('a database already at the newest version is left alone', async () => {
    const db = openTestDb();
    await expect(runMigrations(db, 5)).resolves.toBe(6);
  });

  test('the real migrations take a v1 database to the newest version', async () => {
    const db = openTestDb();
    await expect(runMigrations(db, 1)).resolves.toBe(6);
    expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '6' });
  });

  test('runs a registered migration, bumps schema_version, and commits', async () => {
    const db = openTestDb();
    let ran = false;
    migrations[1] = async txn => {
      ran = true;
      await txn.runAsync(
        "insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Migrated', 'cash', 0, '2026-01-01', '2026-01-01T00:00:00+07:00')",
      );
    };
    try {
      const finalVersion = await runMigrations(db, 1);
      expect(finalVersion).toBe(6); // the swapped-in 1 -> 2, then the real 2 -> 3, 3 -> 4, 4 -> 5 and 5 -> 6
      expect(ran).toBe(true);
      expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '6' });
      expect(await db.getFirstAsync("select 1 from accounts where name = 'Migrated'")).not.toBeNull();
    } finally {
      migrations[1] = real;
    }
  });

  test('a migration that throws leaves the version and its changes rolled back', async () => {
    const db = openTestDb();
    migrations[1] = async txn => {
      await txn.runAsync(
        "insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Should roll back', 'cash', 0, '2026-01-01', '2026-01-01T00:00:00+07:00')",
      );
      throw new Error('migration failed');
    };
    try {
      await expect(runMigrations(db, 1)).rejects.toThrow('migration failed');
      expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: '1' });
      expect(await db.getFirstAsync("select 1 from accounts where name = 'Should roll back'")).toBeNull();
    } finally {
      migrations[1] = real;
    }
  });
});
