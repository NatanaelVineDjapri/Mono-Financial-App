import type { Db } from '../db/types';

export interface TransactionLocation {
  transaction_id: number;
  lat_e6: number;
  lng_e6: number;
  accuracy_m: number | null;
  place_name: string | null;
  captured_at: string;
}

export interface NewTransactionLocation {
  transactionId: number;
  latE6: number;
  lngE6: number;
  accuracyM: number | null;
  placeName?: string | null;
  capturedAt: string;
}

export async function insertTransactionLocation(db: Db, location: NewTransactionLocation): Promise<void> {
  await db.runAsync(
    `insert into transaction_locations (transaction_id, lat_e6, lng_e6, accuracy_m, place_name, captured_at)
     values ($transactionId, $latE6, $lngE6, $accuracyM, $placeName, $capturedAt)`,
    {
      $transactionId: location.transactionId,
      $latE6: location.latE6,
      $lngE6: location.lngE6,
      $accuracyM: location.accuracyM,
      $placeName: location.placeName?.trim().slice(0, 60) || null,
      $capturedAt: location.capturedAt,
    },
  );
}

export async function getTransactionLocation(db: Db, transactionId: number): Promise<TransactionLocation | null> {
  try {
    const exists = await db.getFirstAsync<{ x: number }>("select 1 as x from sqlite_master where type = 'table' and name = 'transaction_locations'");
    if (!exists) return null;
    return await db.getFirstAsync<TransactionLocation>('select * from transaction_locations where transaction_id = $transactionId', { $transactionId: transactionId });
  } catch (error) {
    // Compatibility for callers opening a pre-9 test/legacy database.
    if (/no such table/i.test(String(error))) return null;
    throw error;
  }
}

export async function deleteTransactionLocation(db: Db, transactionId: number): Promise<void> {
  try {
    await db.runAsync('delete from transaction_locations where transaction_id = $transactionId', { $transactionId: transactionId });
  } catch (error) {
    if (!/no such table/i.test(String(error))) throw error;
  }
}

export async function updateTransactionLocationPlace(db: Db, transactionId: number, placeName: string | null): Promise<void> {
  try {
    await db.runAsync('update transaction_locations set place_name = $placeName where transaction_id = $transactionId', {
      $transactionId: transactionId,
      $placeName: placeName?.trim().slice(0, 60) || null,
    });
  } catch (error) {
    if (!/no such table/i.test(String(error))) throw error;
  }
}
