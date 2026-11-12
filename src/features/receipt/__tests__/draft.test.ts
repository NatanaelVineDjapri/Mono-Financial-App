import type { FormAccount, FormCategory } from '../../../core/tx/validate';
import { applyTidy, defaultAccountId, draftErrors, guessCategoryId, similarWindow, toDraft, toFormValues } from '../draft';
import type { ParsedReceipt } from '../parse';
import type { TidyField } from '../draft';

const TODAY = '2026-10-28';

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: null, balance: 6842500, openingDate: '2026-01-01' };
const CASH: FormAccount = { id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, openingDate: '2026-01-01' };
const VALAS: FormAccount = { id: 3, name: 'Valas', type: 'forex', icon: null, balance: 6312500, openingDate: '2026-01-01' };
const ACCOUNTS = [VALAS, BCA, CASH];

const NAMES = ['Food & drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Leisure', 'Housing', 'Education', 'Gifts', 'Other'];
const CATEGORIES: FormCategory[] = [
  ...NAMES.map((name, i) => ({ id: i + 1, name, kind: 'expense' as const })),
  { id: 11, name: 'Salary', kind: 'income' as const },
];
const FOOD = 1;
const TRANSPORT = 2;
const SHOPPING = 3;
const BILLS = 4;
const HEALTH = 5;

const PARSED: ParsedReceipt = {
  merchant: 'Toko Sumber Rejeki',
  date: '2026-10-28',
  dateFromReceipt: true,
  totals: [
    { amount: 48000, score: 113 },
    { amount: 50000, score: 100 },
  ],
  foreignCurrency: false,
};

describe('guessCategoryId', () => {
  test.each([
    ['Warung Makan Bu Tini', FOOD],
    ['Kopi Kenangan', FOOD],
    ['Warung Pasta @ Kemang', FOOD],
    ['RM Padang Sederhana', FOOD],
    ['Apotek K24', HEALTH],
    ['SPBU Pertamina 31.123', TRANSPORT],
    ['Indomaret Ciputat', SHOPPING],
    ['Toko Sumber Rejeki', SHOPPING],
    ['PLN Prepaid', BILLS],
  ])('%s', (merchant, expected) => {
    expect(guessCategoryId(merchant, CATEGORIES)).toBe(expected);
  });

  test('no rule fits, no merchant, or the person has no such category: empty, never a guess', () => {
    expect(guessCategoryId('Zzz Corner', CATEGORIES)).toBeNull();
    expect(guessCategoryId(null, CATEGORIES)).toBeNull();
    expect(guessCategoryId('Toko Sumber Rejeki', CATEGORIES.filter(c => c.name !== 'Shopping'))).toBeNull();
  });

  test('an income category is never picked, and names match in any case', () => {
    expect(guessCategoryId('Gaji Bulanan Toko', [{ id: 9, name: 'SHOPPING', kind: 'income' }])).toBeNull();
    expect(guessCategoryId('Toko Maju', [{ id: 9, name: 'shopping', kind: 'expense' }])).toBe(9);
  });

  test('a Groceries category is preferred to Shopping for a minimarket', () => {
    const withGroceries = [...CATEGORIES, { id: 20, name: 'Groceries', kind: 'expense' as const }];
    expect(guessCategoryId('Alfamart', withGroceries)).toBe(20);
  });
});

describe('the account to start on', () => {
  test('the one used last, when it is a rupiah account that is still there', () => {
    expect(defaultAccountId(ACCOUNTS, 2)).toBe(2);
  });

  test('otherwise the first rupiah account; a Valas account is never chosen', () => {
    expect(defaultAccountId(ACCOUNTS, null)).toBe(1);
    expect(defaultAccountId(ACCOUNTS, 3)).toBe(1);
    expect(defaultAccountId(ACCOUNTS, 99)).toBe(1);
    expect(defaultAccountId([VALAS], null)).toBeNull();
  });
});

describe('toDraft and toFormValues', () => {
  const draft = toDraft(PARSED, { accounts: ACCOUNTS, categories: CATEGORIES, lastAccountId: 2 });

  test('the first candidate is the chosen total, the others stay as chips', () => {
    expect(draft).toMatchObject({ description: 'Toko Sumber Rejeki', date: '2026-10-28', dateFromReceipt: true, totals: [48000, 50000], amount: 48000, categoryId: SHOPPING, accountId: 2 });
  });

  test('it becomes an expense for the same form rules and the same save function as the manual form', () => {
    expect(toFormValues(draft)).toEqual({ type: 'expense', amount: 48000, categoryId: SHOPPING, accountId: 2, toAccountId: null, date: '2026-10-28', description: 'Toko Sumber Rejeki', note: '' });
  });

  test('a receipt with no shop name leaves it empty', () => {
    const empty = toDraft({ ...PARSED, merchant: null }, { accounts: ACCOUNTS, categories: CATEGORIES, lastAccountId: null });
    expect(empty.description).toBe('');
    expect(empty.categoryId).toBeNull();
  });
});

describe('draftErrors: the manual form rules', () => {
  const ctx = { today: TODAY, accounts: ACCOUNTS, categories: CATEGORIES };
  const base = toDraft(PARSED, { accounts: ACCOUNTS, categories: CATEGORIES, lastAccountId: 1 });

  test('a complete draft has no errors', () => {
    expect(draftErrors(base, ctx)).toEqual([]);
  });

  test('no category is a category_required error', () => {
    expect(draftErrors({ ...base, categoryId: null }, ctx).map(e => e.code)).toEqual(['category_required']);
  });

  test('a total of zero is amount_required', () => {
    expect(draftErrors({ ...base, amount: 0 }, ctx).map(e => e.code)).toContain('amount_required');
  });

  test('more than the account holds is insufficient_balance with the real shortfall', () => {
    const errors = draftErrors({ ...base, accountId: 2, amount: 500000 }, ctx);
    expect(errors).toEqual([expect.objectContaining({ code: 'insufficient_balance', shortfall: 50000, balance: 450000 })]);
  });

  test('a date after today and a date before the account opened are refused', () => {
    expect(draftErrors({ ...base, date: '2026-10-29' }, ctx).map(e => e.code)).toEqual(['future_date']);
    expect(draftErrors({ ...base, date: '2025-12-31' }, ctx).map(e => e.code)).toEqual(['before_opening_date']);
  });

  test('a Valas account is refused', () => {
    expect(draftErrors({ ...base, accountId: 3 }, ctx).map(e => e.code)).toContain('forex_not_supported');
  });
});

describe('similarWindow', () => {
  test('the day before to the day after, across month and year ends', () => {
    expect(similarWindow('2026-10-28')).toEqual({ from: '2026-10-27', to: '2026-10-29' });
    expect(similarWindow('2026-11-01')).toEqual({ from: '2026-10-31', to: '2026-11-02' });
    expect(similarWindow('2027-01-01')).toEqual({ from: '2026-12-31', to: '2027-01-02' });
  });
});

describe('applyTidy: the model proposes, the person disposes', () => {
  const ctx = { accounts: ACCOUNTS, categories: CATEGORIES };
  const base = { ...toDraft(PARSED, { accounts: ACCOUNTS, categories: CATEGORIES, lastAccountId: 1 }), description: 'TOKO SUMBER REJEKI', categoryId: null };
  const none = new Set<TidyField>();

  test('a tidy shop name and a category from the person\'s own list are applied; the total and the date never change', () => {
    const applied = applyTidy(base, { shop: 'Toko Sumber Rejeki', category: 'Food & drink', account: null }, ctx, none);
    expect(applied.draft).toMatchObject({ description: 'Toko Sumber Rejeki', categoryId: FOOD, accountId: 1, amount: 48000, date: '2026-10-28' });
    expect(applied.aiCategory).toBe(true);
    expect(applied.changed).toBe(true);
  });

  test('a category that is not in the list is not applied, and neither is a near-miss that could be two', () => {
    expect(applyTidy(base, { shop: null, category: 'Groceries', account: null }, ctx, none)).toMatchObject({ aiCategory: false, changed: false, draft: { categoryId: null } });
  });

  test('an income category is not an expense category', () => {
    expect(applyTidy(base, { shop: null, category: 'Salary', account: null }, ctx, none).draft.categoryId).toBeNull();
  });

  test('an alias or a small typo still finds the category (the chat\'s matcher)', () => {
    expect(applyTidy(base, { shop: null, category: 'food', account: null }, ctx, none).draft.categoryId).toBe(FOOD);
    expect(applyTidy(base, { shop: null, category: 'Shoping', account: null }, ctx, none).draft.categoryId).toBe(SHOPPING);
  });

  test('an account needs its exact name; a Valas account or an unknown one is ignored', () => {
    expect(applyTidy(base, { shop: null, category: null, account: 'Cash wallet' }, ctx, none).draft.accountId).toBe(2);
    expect(applyTidy(base, { shop: null, category: null, account: 'cash' }, ctx, none).draft.accountId).toBe(1);
    expect(applyTidy(base, { shop: null, category: null, account: 'Valas' }, ctx, none).draft.accountId).toBe(1);
    expect(applyTidy(base, { shop: null, category: null, account: 'Dompet Rahasia' }, ctx, none).draft.accountId).toBe(1);
  });

  test('what the person changed themselves is left alone', () => {
    const mine = { ...base, description: 'Makan siang', categoryId: BILLS, accountId: 2 };
    const applied = applyTidy(mine, { shop: 'Warung Pasta', category: 'Food & drink', account: 'BCA Tabungan' }, ctx, new Set<TidyField>(['shop', 'category', 'account']));
    expect(applied.draft).toEqual(mine);
    expect(applied.changed).toBe(false);
    expect(applied.aiCategory).toBe(false);
  });

  test('nothing to propose changes nothing', () => {
    const applied = applyTidy(base, { shop: null, category: null, account: null }, ctx, none);
    expect(applied.draft).toEqual(base);
    expect(applied.changed).toBe(false);
  });

  test('extra spaces in the proposed name are tidied', () => {
    expect(applyTidy(base, { shop: '  Warung   Pasta  ', category: null, account: null }, ctx, none).draft.description).toBe('Warung Pasta');
  });
});
