import {
  MAX_AMOUNT,
  balanceAfter,
  errorFor,
  validateTx,
  visibleErrors,
  type FormAccount,
  type FormCategory,
  type TxFieldKey,
  type TxFormValues,
  type ValidationContext,
} from '../validate';

const TODAY = '2026-10-28';

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, openingDate: '2026-01-01' };
const CASH: FormAccount = { id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, openingDate: '2026-01-01' };
const JAGO: FormAccount = { id: 3, name: 'Jago Pocket', type: 'savings', icon: 'jago', balance: 1275000, openingDate: '2026-03-01' };
const VALAS: FormAccount = { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, openingDate: '2026-01-01' };

const FOOD: FormCategory = { id: 1, name: 'Food & drink', kind: 'expense' };
const SALARY: FormCategory = { id: 11, name: 'Salary', kind: 'income' };

const CTX: ValidationContext = { today: TODAY, accounts: [BCA, CASH, JAGO, VALAS], categories: [FOOD, SALARY] };

function expense(overrides: Partial<TxFormValues> = {}): TxFormValues {
  return { type: 'expense', amount: 125000, categoryId: FOOD.id, accountId: BCA.id, toAccountId: null, date: TODAY, description: '', note: '', ...overrides };
}

function transfer(overrides: Partial<TxFormValues> = {}): TxFormValues {
  return { type: 'transfer', amount: 500000, categoryId: null, accountId: BCA.id, toAccountId: JAGO.id, date: TODAY, description: '', note: '', ...overrides };
}

const codes = (values: TxFormValues, ctx = CTX) => validateTx(values, ctx).map(e => e.code);

describe('a valid form has no errors', () => {
  test('expense, income and transfer', () => {
    expect(codes(expense())).toEqual([]);
    expect(codes(expense({ type: 'income', categoryId: SALARY.id, amount: 7000000 }))).toEqual([]);
    expect(codes(transfer())).toEqual([]);
  });
});

describe('amount', () => {
  test.each([0, -1, 1.5, Number.NaN, MAX_AMOUNT + 1])('%s is not an amount above Rp0', amount => {
    expect(codes(expense({ amount }))).toContain('amount_required');
  });

  test('1 and the maximum are fine', () => {
    expect(codes(expense({ amount: 1 }))).toEqual([]);
    expect(codes(expense({ type: 'income', categoryId: SALARY.id, amount: MAX_AMOUNT }))).toEqual([]);
  });

  test('a missing amount shows no balance error (there is nothing to be short by)', () => {
    expect(codes(expense({ amount: 0 }))).toEqual(['amount_required']);
  });
});

describe('category', () => {
  test('income and expense need one; a transfer does not', () => {
    expect(codes(expense({ categoryId: null }))).toEqual(['category_required']);
    expect(codes(expense({ type: 'income', categoryId: null }))).toEqual(['category_required']);
    expect(codes(transfer())).toEqual([]);
  });

  test('it must match the type (old data that does not is flagged so the form can reset it)', () => {
    expect(codes(expense({ categoryId: SALARY.id }))).toEqual(['category_kind_mismatch']);
    expect(codes(expense({ type: 'income', categoryId: FOOD.id }))).toEqual(['category_kind_mismatch']);
  });

  test('an unknown category counts as none chosen', () => {
    expect(codes(expense({ categoryId: 999 }))).toEqual(['category_required']);
  });
});

describe('balance', () => {
  test('an expense equal to the balance is allowed; one rupiah more is not', () => {
    expect(codes(expense({ accountId: CASH.id, amount: 450000 }))).toEqual([]);
    const errors = validateTx(expense({ accountId: CASH.id, amount: 450001 }), CTX);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ field: 'account', code: 'insufficient_balance', accountName: 'Cash wallet', balance: 450000, shortfall: 1, immediate: true });
  });

  test('the board: Rp1.500.000 from Cash wallet (Rp450.000) is Rp1.050.000 short', () => {
    const error = errorFor(validateTx(expense({ accountId: CASH.id, amount: 1500000 }), CTX), 'account');
    expect(error).toMatchObject({ code: 'insufficient_balance', balance: 450000, shortfall: 1050000 });
  });

  test('an income is never checked against a balance', () => {
    expect(codes(expense({ type: 'income', categoryId: SALARY.id, accountId: CASH.id, amount: 99999999 }))).toEqual([]);
  });

  test("a transfer's From account is checked; the To account is not", () => {
    expect(codes(transfer({ accountId: CASH.id, toAccountId: JAGO.id, amount: 450000 }))).toEqual([]);
    expect(codes(transfer({ accountId: CASH.id, toAccountId: JAGO.id, amount: 450001 }))).toEqual(['insufficient_balance']);
    expect(codes(transfer({ accountId: BCA.id, toAccountId: CASH.id, amount: 6842500 }))).toEqual([]);
  });

  test('the short-balance error is the one that shows immediately', () => {
    const errors = validateTx(expense({ accountId: CASH.id, amount: 1500000, categoryId: null }), CTX);
    expect(errors.find(e => e.code === 'insufficient_balance')?.immediate).toBe(true);
    expect(errors.find(e => e.code === 'category_required')?.immediate).toBe(false);
  });
});

describe('transfer accounts', () => {
  test('From and To must differ', () => {
    expect(codes(transfer({ accountId: BCA.id, toAccountId: BCA.id }))).toEqual(['same_account']);
  });

  test('both are needed', () => {
    expect(codes(transfer({ accountId: null }))).toEqual(['account_required']);
    expect(codes(transfer({ toAccountId: null }))).toEqual(['to_account_required']);
  });

  test('Valas accounts cannot be picked here yet (either side, and as the account of an expense)', () => {
    expect(codes(transfer({ toAccountId: VALAS.id }))).toEqual(['forex_not_supported']);
    expect(codes(transfer({ accountId: VALAS.id }))).toEqual(['forex_not_supported']);
    expect(codes(expense({ accountId: VALAS.id }))).toEqual(['forex_not_supported']);
  });

  test('an expense without an account asks for one', () => {
    expect(codes(expense({ accountId: null }))).toEqual(['account_required']);
  });
});

describe('date', () => {
  test('today is allowed, tomorrow is not', () => {
    expect(codes(expense({ date: TODAY }))).toEqual([]);
    const error = errorFor(validateTx(expense({ date: '2026-10-29' }), CTX), 'date');
    expect(error).toMatchObject({ code: 'future_date', today: TODAY });
  });

  test("not before the account's opening date (and for a transfer, either account's)", () => {
    expect(codes(expense({ date: '2025-12-31' }))).toEqual(['before_opening_date']);
    expect(codes(expense({ date: '2026-01-01' }))).toEqual([]); // the opening day itself is fine
    expect(codes(transfer({ date: '2026-02-15' }))).toEqual(['before_opening_date']); // Jago opened in March
    expect(codes(transfer({ date: '2026-03-01' }))).toEqual([]);
  });

  test('a future date wins over the opening date (one date error at a time)', () => {
    expect(codes(expense({ date: '2027-01-01' }))).toEqual(['future_date']);
  });
});

describe('several errors at once', () => {
  test('the board: no category and a short balance are two errors, in field order', () => {
    const errors = validateTx(expense({ accountId: CASH.id, amount: 1500000, categoryId: null }), CTX);
    expect(errors.map(e => e.field)).toEqual(['category', 'account']);
  });
});

describe('visibleErrors: nothing is shown on a fresh form', () => {
  const errors = validateTx(expense({ accountId: CASH.id, amount: 1500000, categoryId: null }), CTX);
  const none = new Set<TxFieldKey>();

  test('untouched and not submitted: only the short balance', () => {
    expect(visibleErrors(errors, none, false).map(e => e.code)).toEqual(['insufficient_balance']);
  });

  test('a field shows its error once touched', () => {
    expect(visibleErrors(errors, new Set<TxFieldKey>(['category']), false).map(e => e.code)).toEqual(['category_required', 'insufficient_balance']);
  });

  test('after Save is tapped, every error shows', () => {
    expect(visibleErrors(errors, none, true)).toHaveLength(2);
  });

  test('an empty form shows nothing until it is touched or submitted', () => {
    const empty = validateTx(expense({ amount: 0, categoryId: null }), CTX);
    expect(visibleErrors(empty, none, false)).toEqual([]);
    expect(visibleErrors(empty, none, true).map(e => e.code)).toEqual(['amount_required', 'category_required']);
  });
});

describe('balanceAfter', () => {
  test('live, from the balance without the record: an expense takes it out, an income puts it in', () => {
    expect(balanceAfter(BCA, 125000, 'out')).toBe(6717500);
    expect(balanceAfter(BCA, 125000, 'in')).toBe(6967500);
    expect(balanceAfter(JAGO, 500000, 'in')).toBe(1775000);
  });

  test('no amount yet is just the balance; no account is null', () => {
    expect(balanceAfter(BCA, 0, 'out')).toBe(6842500);
    expect(balanceAfter(undefined, 100, 'out')).toBeNull();
  });
});
