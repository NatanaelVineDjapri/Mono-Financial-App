// Turns a thrown SQLite error (from either backend — both surface the trigger's
// RAISE(ABORT, 'code') text in their Error#message) into a typed DomainError for one of
// the 13 named guard codes (CLAUDE.md rule 4), or an UnexpectedDbError for anything
// else. The domain layer pre-checks for friendly messages with real numbers; this is
// the fallback when a pre-check was skipped, raced, or simply didn't exist yet.
export const GUARD_CODES = [
  'future_date',
  'before_opening_date',
  'category_kind_mismatch',
  'insufficient_balance',
  'budget_needs_expense_category',
  'over_monthly_limit',
  'budgets_exist_for_month',
  'currency_not_in_account',
  'missing_fx_rate',
  'pocket_needs_forex_account',
  'pocket_not_empty',
  'account_type_locked',
  'recurring_needs_idr_account',
] as const;

export type GuardCode = (typeof GUARD_CODES)[number];

export class DomainError extends Error {
  readonly code: GuardCode;

  constructor(code: GuardCode, cause?: unknown) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    this.cause = cause;
  }
}

// A database error whose message didn't match any known guard code — still a real
// error, just not one the domain layer recognises. Never silently dropped.
export class UnexpectedDbError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'UnexpectedDbError';
    this.cause = cause;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Wraps and rethrows: a recognised guard code becomes a DomainError, anything else
// becomes an UnexpectedDbError. Call from a catch block: `catch (err) { throwDomainError(err); }`.
export function throwDomainError(err: unknown): never {
  const message = errorMessage(err);
  const code = GUARD_CODES.find(c => message.includes(c));
  if (code) throw new DomainError(code, err);
  throw new UnexpectedDbError(err);
}
