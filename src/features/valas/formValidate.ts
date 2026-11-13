// The rules of the Valas form (create and edit), pure and tested; the schema stays the real guard.
import { parseCurrencyText } from './amountText';

export interface ValasFormRow {
  currency: string;
  text: string; // the opening balance as typed; empty means 0
}

export interface ValasFormValues {
  name: string;
  rows: readonly ValasFormRow[]; // create only: the new account's first pockets
  openingDate: string;
}

export interface ValasFormContext {
  today: string;
  otherNames: readonly string[]; // names of the other accounts (unique ignoring case)
  minorFactors: Readonly<Record<string, number>>;
  requirePockets: boolean; // create: at least one currency
}

export type ValasFieldError =
  | { field: 'name'; code: 'name_invalid' | 'name_taken' }
  | { field: 'rows'; code: 'no_pockets' }
  | { field: 'row'; currency: string; code: 'amount_invalid' }
  | { field: 'openingDate'; code: 'future_date' };

export function validateValasForm(values: ValasFormValues, ctx: ValasFormContext): ValasFieldError[] {
  const errors: ValasFieldError[] = [];
  const name = values.name.trim();
  if (name.length < 1 || name.length > 40) errors.push({ field: 'name', code: 'name_invalid' });
  else if (ctx.otherNames.some(n => n.trim().toLowerCase() === name.toLowerCase())) errors.push({ field: 'name', code: 'name_taken' });

  if (ctx.requirePockets && values.rows.length === 0) errors.push({ field: 'rows', code: 'no_pockets' });
  for (const row of values.rows) {
    const text = row.text.trim();
    if (text === '') continue;
    const minor = parseCurrencyText(text, ctx.minorFactors[row.currency] ?? 100);
    if (minor == null) errors.push({ field: 'row', currency: row.currency, code: 'amount_invalid' });
  }
  if (values.openingDate > ctx.today) errors.push({ field: 'openingDate', code: 'future_date' });
  return errors;
}

// The rows as pockets with an opening balance in minor units. Call only after validation passed.
export function pocketsFromRows(rows: readonly ValasFormRow[], minorFactors: Readonly<Record<string, number>>): { currency: string; openingMinor: number }[] {
  return rows.map(row => ({
    currency: row.currency,
    openingMinor: row.text.trim() === '' ? 0 : (parseCurrencyText(row.text, minorFactors[row.currency] ?? 100) ?? 0),
  }));
}
