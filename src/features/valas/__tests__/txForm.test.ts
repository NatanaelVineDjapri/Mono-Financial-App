// The transaction form with the Valas account: validation (pure), saving through core/tx/save.ts, the
// form data, and editing. Money is an integer in the minor unit of its currency; a missing rate blocks
// the record and is never counted as 0; the AI chat, the scan and the import never write to Valas.
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { insertFxRate } from '../../../data/repo/fx';
import { getTransaction } from '../../../data/repo/transactions';
import { listCategories } from '../../../data/repo/categories';
import { createAccount } from '../../../domain/accounts';
import { getNetWorth } from '../../../domain/net-worth';
import { getTxFormData } from '../../../domain/txForm';
import { saveNewTransaction, saveTransactionChanges, undoTransactionChanges } from '../../../core/tx/save';
import { validateTx, type FormAccount, type FormPocket, type TxFormValues, type ValidationContext } from '../../../core/tx/validate';
import { createForexAccount } from '../forexAccount';

const OPENED = '2026-10-01';
const NOW = '2026-10-28T09:00:00+07:00';
const TODAY = '2026-10-28';

async function fixture() {
  const db = await openMigratedTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6_000_000, openingDate: '2026-01-01' }, NOW);
  const food = (await listCategories(db, { kind: 'expense' })).find(c => c.name === 'Food & drink')!.id;
  const valas = await createForexAccount(db, { name: 'Valas', openingDate: OPENED, pockets: [{ currency: 'USD', openingMinor: 25000 }, { currency: 'SGD', openingMinor: 20000 }] }, NOW);
  await insertFxRate(db, 'USD', 162500000, NOW, 'api');
  await insertFxRate(db, 'SGD', 125000000, NOW, 'api');
  return { db, bca, valas, food };
}

const base: TxFormValues = { type: 'expense', amount: 2000, categoryId: 1, accountId: 2, toAccountId: null, date: TODAY, description: '', note: '' };

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: null, balance: 6_000_000, openingDate: '2026-01-01' };
const VALAS: FormAccount = { id: 2, name: 'Valas', type: 'forex', icon: null, balance: 6_312_500, openingDate: OPENED };
const POCKETS: FormPocket[] = [
  { accountId: 2, currency: 'USD', minorFactor: 100, balance: 25000, openingDate: OPENED },
  { accountId: 2, currency: 'SGD', minorFactor: 100, balance: 18000, openingDate: '2026-10-05' },
];
const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({
  today: TODAY,
  accounts: [BCA, VALAS],
  categories: [{ id: 1, name: 'Food & drink', kind: 'expense' }],
  allowForex: true,
  pockets: POCKETS,
  rates: { USD: 162500000, SGD: 125000000 },
  ...over,
});
const codes = (v: Partial<TxFormValues>, c: ValidationContext = ctx()) => validateTx({ ...base, ...v }, c).map(e => `${e.field}:${e.code}`);

describe('validateTx with a Valas pocket', () => {
  test('a good expense in S$ has no errors', () => {
    expect(codes({ currency: 'SGD' })).toEqual([]);
  });

  test('the Valas account needs a pocket chosen', () => {
    expect(codes({ currency: undefined })).toEqual(['account:pocket_required']);
    expect(codes({ currency: 'JPY' })).toContain('account:pocket_required'); // not a pocket of the account
  });

  test('a currency with no rate blocks the record; it is never valued at 0', () => {
    const errors = validateTx({ ...base, currency: 'SGD' }, ctx({ rates: { USD: 162500000 } }));
    expect(errors.map(e => e.code)).toEqual(['missing_rate']);
    expect(errors[0]).toMatchObject({ field: 'account', currency: 'SGD' });
  });

  test('a pocket is judged by its own balance, in its own currency', () => {
    const errors = validateTx({ ...base, currency: 'SGD', amount: 30000 }, ctx());
    expect(errors).toEqual([expect.objectContaining({ field: 'account', code: 'insufficient_balance', currency: 'SGD', minorFactor: 100, balance: 18000, shortfall: 12000, immediate: true })]);
    // exactly the pocket's balance is fine
    expect(codes({ currency: 'SGD', amount: 18000 })).toEqual([]);
  });

  test('income needs no balance, only a rate', () => {
    expect(codes({ type: 'income', currency: 'USD', categoryId: 1, amount: 99999 }, ctx({ categories: [{ id: 1, name: 'Salary', kind: 'income' }] }))).toEqual([]);
  });

  test('the date cannot be before the pocket opened (not the account)', () => {
    expect(codes({ currency: 'SGD', date: '2026-10-03' })).toEqual(['date:before_opening_date']);
    expect(codes({ currency: 'USD', date: '2026-10-03' })).toEqual([]);
  });

  test('the AI chat, the scan and the import never allow Valas: without allowForex it is refused', () => {
    expect(codes({ currency: 'SGD' }, ctx({ allowForex: false }))).toEqual(['account:forex_not_supported']);
    expect(codes({ type: 'transfer', accountId: 1, toAccountId: 2, categoryId: null, toCurrency: 'USD', amountTo: 100 }, ctx({ allowForex: false }))).toEqual(['toAccount:forex_not_supported']);
  });
});

describe('validateTx: an exchange', () => {
  const exchange: Partial<TxFormValues> = { type: 'transfer', categoryId: null, accountId: 1, toAccountId: 2, toCurrency: 'USD', amount: 1_625_000, amountTo: 10000 };

  test('rupiah to dollars needs both amounts', () => {
    expect(codes(exchange)).toEqual([]);
    expect(codes({ ...exchange, amountTo: 0 })).toEqual(['amountTo:amount_to_required']);
    expect(codes({ ...exchange, amountTo: null })).toEqual(['amountTo:amount_to_required']);
  });

  test('inside the Valas account only between two different pockets', () => {
    const inside: Partial<TxFormValues> = { type: 'transfer', categoryId: null, accountId: 2, toAccountId: 2, currency: 'USD', toCurrency: 'SGD', amount: 10000, amountTo: 13000 };
    expect(codes(inside)).toEqual([]);
    expect(codes({ ...inside, toCurrency: 'USD' })).toEqual(['toAccount:same_pocket']);
  });

  test('the sending pocket must hold the amount; the receiving pocket needs a rate too', () => {
    const inside: Partial<TxFormValues> = { type: 'transfer', categoryId: null, accountId: 2, toAccountId: 2, currency: 'USD', toCurrency: 'SGD', amount: 30000, amountTo: 39000 };
    expect(codes(inside)).toEqual(['account:insufficient_balance']);
    expect(codes({ ...inside, amount: 100 }, ctx({ rates: { USD: 162500000 } }))).toEqual(['toAccount:missing_rate']);
  });

  test('two rupiah accounts stay a plain transfer: no second amount asked', () => {
    const cash: FormAccount = { ...BCA, id: 3, name: 'Cash' };
    expect(codes({ type: 'transfer', categoryId: null, accountId: 1, toAccountId: 3, amount: 1000, amountTo: undefined }, ctx({ accounts: [BCA, VALAS, cash] }))).toEqual([]);
  });
});

describe('saving a Valas record through the form', () => {
  test('an expense of S$20,00 freezes Rp250.000 and the toast numbers are read in S$', async () => {
    const { db, valas, food } = await fixture();
    const result = await saveNewTransaction(db, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 2000 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ accountId: valas, currency: 'SGD', accountBalanceAfter: 18000, toCurrency: null });
    const row = await getTransaction(db, result.value.id);
    expect(row).toMatchObject({ currency: 'SGD', amount: 2000, amount_idr: 250000 });
  });

  test('no rate for the currency: refused with the plain message, nothing written', async () => {
    const { db, valas, food } = await fixture();
    await db.runAsync("delete from fx_rates where currency = 'SGD'");
    const result = await saveNewTransaction(db, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 2000 }, NOW);
    expect(result.ok).toBe(false);
    expect(await db.getFirstAsync('select count(*) as n from transactions')).toEqual({ n: 0 });
  });

  test('a pocket the account does not hold is refused', async () => {
    const { db, valas, food } = await fixture();
    const result = await saveNewTransaction(db, { ...base, accountId: valas, categoryId: food, currency: 'JPY', amount: 2000 }, NOW);
    expect(result.ok).toBe(false);
  });

  test('an exchange from rupiah into dollars: both amounts stored, net worth moves by nothing', async () => {
    const { db, bca, valas } = await fixture();
    const before = (await getNetWorth(db)).netWorth;
    const result = await saveNewTransaction(
      db,
      { type: 'transfer', amount: 1_625_000, categoryId: null, accountId: bca, toAccountId: valas, toCurrency: 'USD', amountTo: 10000, date: '2026-10-28', description: 'Buy USD', note: '' },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ currency: 'IDR', toCurrency: 'USD', accountBalanceAfter: 4_375_000, toAccountBalanceAfter: 35000 });
    expect(await getTransaction(db, result.value.id)).toMatchObject({ currency: 'IDR', to_currency: 'USD', amount: 1_625_000, amount_to: 10000, amount_idr: 1_625_000 });
    expect((await getNetWorth(db)).netWorth).toBe(before);
  });

  test('dollars to Singapore dollars inside the Valas account: net worth moves only by the difference', async () => {
    const { db, valas } = await fixture();
    const before = (await getNetWorth(db)).netWorth;
    // US$100,00 -> S$128,00 where the stored rates give S$130,00: Rp25.000 less
    const result = await saveNewTransaction(
      db,
      { type: 'transfer', amount: 10000, categoryId: null, accountId: valas, currency: 'USD', toAccountId: valas, toCurrency: 'SGD', amountTo: 12800, date: '2026-10-28', description: '', note: '' },
      NOW,
    );
    expect(result.ok).toBe(true);
    expect((await getNetWorth(db)).netWorth).toBe(before - 25000);
  });
});

describe('the form data', () => {
  test('carries the Valas pockets with their balances and opening dates, and the latest rates', async () => {
    const { db, valas } = await fixture();
    const data = await getTxFormData(db);
    expect(data.pockets).toEqual([
      { accountId: valas, currency: 'SGD', minorFactor: 100, balance: 20000, openingDate: OPENED },
      { accountId: valas, currency: 'USD', minorFactor: 100, balance: 25000, openingDate: OPENED },
    ]);
    expect(data.rates).toEqual({ USD: 162500000, SGD: 125000000 });
  });

  test('when editing, the pocket balance is the one before the record existed', async () => {
    const { db, valas, food } = await fixture();
    const saved = await saveNewTransaction(db, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 2000 }, NOW);
    if (!saved.ok) throw new Error('setup');
    const adding = await getTxFormData(db);
    expect(adding.pockets.find(p => p.currency === 'SGD')?.balance).toBe(18000);
    const editing = await getTxFormData(db, saved.value.id);
    expect(editing.pockets.find(p => p.currency === 'SGD')?.balance).toBe(20000);
    expect(editing.record).toMatchObject({ currency: 'SGD', amount: 2000, supported: true });
  });
});

describe('editing a Valas record', () => {
  async function recorded() {
    const f = await fixture();
    const saved = await saveNewTransaction(f.db, { ...base, accountId: f.valas, categoryId: f.food, currency: 'SGD', amount: 2000, description: 'Dinner' }, NOW);
    if (!saved.ok) throw new Error('setup');
    return { ...f, id: saved.value.id };
  }

  test('changing only the note keeps the frozen rupiah value even after the rate moved', async () => {
    const { db, valas, food, id } = await recorded();
    await insertFxRate(db, 'SGD', 140000000, '2026-10-29T09:00:00+07:00', 'api');
    const result = await saveTransactionChanges(db, id, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 2000, description: 'Dinner', note: 'with Ana' }, '2026-10-29T10:00:00+07:00');
    expect(result.ok).toBe(true);
    expect(await getTransaction(db, id)).toMatchObject({ amount: 2000, amount_idr: 250000, note: 'with Ana' });
  });

  test('changing the amount freezes the rupiah value again, at the latest rate', async () => {
    const { db, valas, food, id } = await recorded();
    await insertFxRate(db, 'SGD', 140000000, '2026-10-29T09:00:00+07:00', 'api');
    const result = await saveTransactionChanges(db, id, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 3000, description: 'Dinner' }, '2026-10-29T10:00:00+07:00');
    expect(result.ok).toBe(true);
    expect(await getTransaction(db, id)).toMatchObject({ amount: 3000, amount_idr: 420000 });
  });

  test('undoing an edit puts the old amount and the old rupiah value back', async () => {
    const { db, valas, food, id } = await recorded();
    const before = (await getTransaction(db, id))!;
    await insertFxRate(db, 'SGD', 140000000, '2026-10-29T09:00:00+07:00', 'api');
    await saveTransactionChanges(db, id, { ...base, accountId: valas, categoryId: food, currency: 'SGD', amount: 3000, description: 'Dinner' }, '2026-10-29T10:00:00+07:00');
    const undone = await undoTransactionChanges(db, before, '2026-10-29T10:01:00+07:00');
    expect(undone.ok).toBe(true);
    expect(await getTransaction(db, id)).toMatchObject({ amount: 2000, amount_idr: 250000 });
  });

  test('a rupiah record is unaffected: its rupiah value is its amount', async () => {
    const { db, bca, food } = await fixture();
    const saved = await saveNewTransaction(db, { ...base, accountId: bca, categoryId: food, amount: 50000 }, NOW);
    if (!saved.ok) throw new Error('setup');
    const result = await saveTransactionChanges(db, saved.value.id, { ...base, accountId: bca, categoryId: food, amount: 60000 }, NOW);
    expect(result.ok).toBe(true);
    expect(await getTransaction(db, saved.value.id)).toMatchObject({ currency: 'IDR', amount: 60000, amount_idr: 60000 });
  });
});
