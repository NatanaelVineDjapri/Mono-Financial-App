// The foreign currencies a Valas pocket can hold (DESIGN.md section M): every real currency the Exchange
// Rate API serves, besides the rupiah (src/core/currencyList.ts has the list and why some are left out).
// Order is the order the Add currency sheet lists them in: the twelve most used first, then the rest.
import { CURRENCY_CODES, MINOR_FACTORS as FACTORS } from '../../core/currencyList';

export const SUPPORTED_FOREX_CURRENCIES: readonly string[] = CURRENCY_CODES;

export type ForexCurrency = string;

export function isSupportedForexCurrency(code: string): code is ForexCurrency {
  return SUPPORTED_FOREX_CURRENCIES.includes(code);
}

// Minor units per major unit, as seeded in the `currencies` table. Only for typing amounts before anything
// is saved; every saved figure reads `currencies.minor_factor` through the views. A test keeps this equal
// to the seed.
export const MINOR_FACTORS: Readonly<Record<string, number>> = FACTORS;
