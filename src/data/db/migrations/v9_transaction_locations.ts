import type { Db } from '../types';

// Migration 8 -> 9. A location belongs to its transaction, so this child table intentionally
// uses CASCADE even though ordinary project foreign keys are RESTRICT: deleting the transaction
// must remove its private location attribute and never leave orphaned coordinates behind.
export async function addTransactionLocations(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE transaction_locations (
  transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  lat_e6 INTEGER NOT NULL CHECK (lat_e6 BETWEEN -90000000 AND 90000000),
  lng_e6 INTEGER NOT NULL CHECK (lng_e6 BETWEEN -180000000 AND 180000000),
  accuracy_m INTEGER,
  place_name TEXT CHECK (place_name IS NULL OR length(place_name) <= 60),
  captured_at TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('location_enabled', '0');
`);
}
