// The rules of the account form (Account-Edit, new and existing), as one pure function: values
// and a little context in, a list of errors out. No UI, no database, no strings (src/i18n/id.ts
// words each code). The SQL guards stay the real authority — the name is unique ignoring case,
// the opening balance cannot strand a record or push the balance below zero — this runs first
// so the person sees a clean message with the real numbers.
//
// Money is a whole-rupiah integer, dates are 'YYYY-MM-DD' (CLAUDE.md rule 1).
export type PlainAccountType = 'bank' | 'cash' | 'ewallet' | 'savings';

export const MAX_NAME_LENGTH = 40;
export const MAX_OPENING_BALANCE = 10 ** 12 - 1;

export interface AccountFormValues {
  name: string;
  type: PlainAccountType;
  openingBalance: number;
  openingDate: string;
  icon: string | null;
}

export interface AccountValidationContext {
  today: string;
  // Every other account's name; a new name must differ ignoring case.
  otherNames: string[];
  // Only when editing an account that already has records.
  editing?: {
    movement: number; // money in − money out, all time
    firstRecordOn: string | null;
  };
}

export type AccountFieldKey = 'name' | 'openingBalance' | 'openingDate';

export type AccountErrorCode =
  | 'name_required'
  | 'name_too_long'
  | 'name_taken'
  | 'balance_invalid'
  | 'balance_below_zero'
  | 'future_date'
  | 'after_first_record';

export interface AccountFieldError {
  field: AccountFieldKey;
  code: AccountErrorCode;
  shortfall?: number; // balance_below_zero: how far below zero the balance would be
  firstRecordOn?: string; // after_first_record: the oldest record's date
  today?: string;
}

export function validateAccount(values: AccountFormValues, ctx: AccountValidationContext): AccountFieldError[] {
  const errors: AccountFieldError[] = [];

  const name = values.name.trim();
  if (name.length === 0) errors.push({ field: 'name', code: 'name_required' });
  else if (name.length > MAX_NAME_LENGTH) errors.push({ field: 'name', code: 'name_too_long' });
  else if (ctx.otherNames.some(other => other.trim().toLowerCase() === name.toLowerCase())) errors.push({ field: 'name', code: 'name_taken' });

  const balanceOk = Number.isSafeInteger(values.openingBalance) && values.openingBalance >= 0 && values.openingBalance <= MAX_OPENING_BALANCE;
  if (!balanceOk) {
    errors.push({ field: 'openingBalance', code: 'balance_invalid' });
  } else if (ctx.editing) {
    // The balance after the edit: the new opening balance plus what has moved since. Zero is fine.
    const after = values.openingBalance + ctx.editing.movement;
    if (after < 0) errors.push({ field: 'openingBalance', code: 'balance_below_zero', shortfall: -after });
  }

  if (values.openingDate > ctx.today) {
    errors.push({ field: 'openingDate', code: 'future_date', today: ctx.today });
  } else if (ctx.editing?.firstRecordOn && values.openingDate > ctx.editing.firstRecordOn) {
    errors.push({ field: 'openingDate', code: 'after_first_record', firstRecordOn: ctx.editing.firstRecordOn });
  }

  return errors;
}

export function accountErrorFor(errors: AccountFieldError[], field: AccountFieldKey): AccountFieldError | undefined {
  return errors.find(e => e.field === field);
}

// What shows right now: an error appears once its field was touched or Save was tapped; a fresh
// form shows none.
export function visibleAccountErrors(errors: AccountFieldError[], touched: ReadonlySet<AccountFieldKey>, submitted: boolean): AccountFieldError[] {
  return errors.filter(e => submitted || touched.has(e.field));
}
