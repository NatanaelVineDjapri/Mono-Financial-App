// Migration 4 -> 5: every real foreign currency the rate service serves can be held in a Valas pocket,
// not only the first twelve. The `currencies` table is a static reference list (seeded, not part of a
// backup), so this only adds the missing rows; the ones already there are left exactly as they are.
// The list, with each currency's ISO minor unit, is src/core/currencyList.ts.
import { CURRENCY_LIST } from '../../../core/currencyList';
import type { Db } from '../types';

export async function addMoreCurrencies(db: Db): Promise<void> {
  for (const currency of CURRENCY_LIST) {
    await db.runAsync('insert or ignore into currencies (code, name, minor_factor) values ($code, $name, $factor)', {
      $code: currency.code,
      $name: currency.name,
      $factor: currency.minorFactor,
    });
  }
}
