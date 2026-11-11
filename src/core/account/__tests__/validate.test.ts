import { MAX_NAME_LENGTH, MAX_OPENING_BALANCE, accountErrorFor, validateAccount, visibleAccountErrors, type AccountFieldKey, type AccountFormValues } from '../validate';

const TODAY = '2026-10-28';

function values(overrides: Partial<AccountFormValues> = {}): AccountFormValues {
  return { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01', icon: 'bca', ...overrides };
}

const codes = (v: AccountFormValues, ctx = { today: TODAY, otherNames: [] as string[] }) => validateAccount(v, ctx).map(e => e.code);

describe('a valid account', () => {
  test('has no errors, including a zero opening balance and today as the date', () => {
    expect(codes(values())).toEqual([]);
    expect(codes(values({ openingBalance: 0 }))).toEqual([]);
    expect(codes(values({ openingDate: TODAY }))).toEqual([]);
  });
});

describe('name', () => {
  test('is required (spaces alone are not a name)', () => {
    expect(codes(values({ name: '' }))).toEqual(['name_required']);
    expect(codes(values({ name: '   ' }))).toEqual(['name_required']);
  });

  test('at most 40 characters, counted after trimming', () => {
    expect(codes(values({ name: 'a'.repeat(MAX_NAME_LENGTH) }))).toEqual([]);
    expect(codes(values({ name: `  ${'a'.repeat(MAX_NAME_LENGTH)}  ` }))).toEqual([]);
    expect(codes(values({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) }))).toEqual(['name_too_long']);
  });

  test('must differ from every other account, ignoring case and spaces at the ends', () => {
    const ctx = { today: TODAY, otherNames: ['Cash wallet', 'GoPay'] };
    expect(codes(values({ name: 'cash WALLET' }), ctx)).toEqual(['name_taken']);
    expect(codes(values({ name: ' GoPay ' }), ctx)).toEqual(['name_taken']);
    expect(codes(values({ name: 'Jago Pocket' }), ctx)).toEqual([]);
  });
});

describe('opening balance', () => {
  test.each([-1, 1.5, Number.NaN, MAX_OPENING_BALANCE + 1])('%s is not a valid opening balance', openingBalance => {
    expect(codes(values({ openingBalance }))).toEqual(['balance_invalid']);
  });

  test('the largest allowed amount is fine', () => {
    expect(codes(values({ openingBalance: MAX_OPENING_BALANCE }))).toEqual([]);
  });
});

describe('opening date', () => {
  test('today is fine, tomorrow is not', () => {
    expect(codes(values({ openingDate: '2026-10-29' }))).toEqual(['future_date']);
    expect(validateAccount(values({ openingDate: '2026-10-29' }), { today: TODAY, otherNames: [] })[0]).toMatchObject({ field: 'openingDate', today: TODAY });
  });
});

describe('editing an account that has records', () => {
  const edit = (movement: number, firstRecordOn: string | null) => ({ today: TODAY, otherNames: [], editing: { movement, firstRecordOn } });

  test('the opening date cannot move past the oldest record (the record day itself is fine)', () => {
    expect(codes(values({ openingDate: '2026-03-01' }), edit(5000, '2026-02-10'))).toEqual(['after_first_record']);
    expect(accountErrorFor(validateAccount(values({ openingDate: '2026-03-01' }), edit(5000, '2026-02-10')), 'openingDate')).toMatchObject({ firstRecordOn: '2026-02-10' });
    expect(codes(values({ openingDate: '2026-02-10' }), edit(5000, '2026-02-10'))).toEqual([]);
    expect(codes(values({ openingDate: '2026-01-01' }), edit(5000, '2026-02-10'))).toEqual([]);
  });

  test('a lower opening balance cannot push the balance below zero; reaching exactly zero is fine', () => {
    // 9.357.500 went out and 15.000.000 came in: the account can lose up to 5.642.500 of its opening balance... never below zero.
    expect(codes(values({ openingBalance: 100 }), edit(-1000, null))).toEqual(['balance_below_zero']);
    expect(accountErrorFor(validateAccount(values({ openingBalance: 100 }), edit(-1000, null)), 'openingBalance')).toMatchObject({ shortfall: 900 });
    expect(codes(values({ openingBalance: 1000 }), edit(-1000, null))).toEqual([]);
    expect(codes(values({ openingBalance: 0 }), edit(5000, null))).toEqual([]);
  });

  test('a future date wins over the first-record rule (one date error at a time)', () => {
    expect(codes(values({ openingDate: '2027-01-01' }), edit(0, '2026-02-10'))).toEqual(['future_date']);
  });
});

describe('visibleAccountErrors: nothing on a fresh form', () => {
  const errors = validateAccount(values({ name: '', openingBalance: -5 }), { today: TODAY, otherNames: [] });
  const none = new Set<AccountFieldKey>();

  test('untouched and not submitted: none', () => expect(visibleAccountErrors(errors, none, false)).toEqual([]));
  test('a touched field shows its error', () => expect(visibleAccountErrors(errors, new Set<AccountFieldKey>(['name']), false).map(e => e.code)).toEqual(['name_required']));
  test('after Save is tapped, all of them', () => expect(visibleAccountErrors(errors, none, true)).toHaveLength(2));
});
