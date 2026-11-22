import { openTestDb } from '../../openTestDb';
import { LATEST_SCHEMA_VERSION, runMigrations } from '../index';

describe('migration 8 -> 9 transaction locations', () => {
  test('keeps existing data, starts empty, and leaves location disabled', async () => {
    const db = openTestDb();
    await db.runAsync(
      "insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Old', 'cash', 1000, '2026-01-01', '2026-01-01T00:00:00+07:00')",
    );
    await runMigrations(db, 8);

    expect(await db.getFirstAsync("select value from meta where key = 'schema_version'")).toEqual({ value: String(LATEST_SCHEMA_VERSION) });
    expect(await db.getFirstAsync("select count(*) as count from accounts where name = 'Old'")).toEqual({ count: 1 });
    expect(await db.getFirstAsync('select count(*) as count from transaction_locations')).toEqual({ count: 0 });
    expect(await db.getFirstAsync("select value from settings where key = 'location_enabled'")).toEqual({ value: '0' });
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('cascades with the transaction and rejects invalid coordinates', async () => {
    const db = openTestDb();
    await runMigrations(db, 8);
    const account = await db.runAsync(
      "insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Cash', 'cash', 1000, '2026-01-01', '2026-01-01T00:00:00+07:00')",
    );
    const category = await db.getFirstAsync<{ id: number }>("select id from categories where kind = 'expense' limit 1");
    const tx = await db.runAsync(
      "insert into transactions (account_id, kind, amount, currency, amount_idr, category_id, occurred_on, note, source, created_at, updated_at) values (?, 'expense', 100, 'IDR', 100, ?, '2026-01-02', '', 'manual', '2026-01-02T00:00:00+07:00', '2026-01-02T00:00:00+07:00')",
      [account.lastInsertRowId, category!.id],
    );

    await db.runAsync(
      "insert into transaction_locations (transaction_id, lat_e6, lng_e6, accuracy_m, place_name, captured_at) values (?,  -6123456, 106812345, 25, 'Rumah', '2026-01-02T00:00:00+07:00')",
      [tx.lastInsertRowId],
    );
    await db.runAsync('delete from transactions where id = ?', [tx.lastInsertRowId]);
    expect(await db.getFirstAsync('select count(*) as count from transaction_locations')).toEqual({ count: 0 });

    await expect(
      db.runAsync(
        "insert into transaction_locations (transaction_id, lat_e6, lng_e6, captured_at) values (?, 90000001, 0, '2026-01-02T00:00:00+07:00')",
        [tx.lastInsertRowId],
      ),
    ).rejects.toThrow();
  });
});
