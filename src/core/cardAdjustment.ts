// What a balance adjustment after an e-money card scan is called in the database. These two texts are stored values (the
// name of a system category and the description of a record), not a sentence on a screen, so they do not follow the
// language setting. Migration 11 -> 12 seeds the same category name (kept as its own literal there, because a migration
// never changes after it has shipped); a test keeps the two equal.
export const ADJUSTMENT_CATEGORY_NAME = 'Penyesuaian saldo';
export const ADJUSTMENT_DESCRIPTION = 'Penyesuaian saldo dari kartu';
