import { openTestDb } from '../../../data/db/openTestDb';
import { listCategories } from '../../../data/repo/categories';
import { getPocketBalanceNow } from '../../../data/repo/transactionDetail';
import { getTransaction } from '../../../data/repo/transactions';
import { createAccount } from '../../../domain/accounts';
import { getNetWorth } from '../../../domain/net-worth';
import { getTxFormData, withoutRecord } from '../../../domain/txForm';
import { mapDbError, saveNewTransaction, saveTransactionChanges, undoNewTransaction, undoTransactionChanges } from '../save';
import type { TxFormValues } from '../validate';

const NOW = '2026-10-28T12:41:09+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-03-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;
  return { db, bca, jago, food: cat('Food & drink'), transport: cat('Transport'), salary: cat('Salary') };
}

function values(overrides: Partial<TxFormValues>): TxFormValues {
  return { type: 'expense', amount: 125000, categoryId: null, accountId: null, toAccountId: null, date: '2026-10-28', description: '', note: '', ...overrides };
}

const balance = (db: Awaited<ReturnType<typeof fixture>>['db'], account: number) => getPocketBalanceNow(db, account, 'IDR');

describe('saveNewTransaction', () => {
  test('an expense: the row is stored as typed, the balance (from the view) goes down, nothing derived is written', async () => {
    const { db, bca, food } = await fixture();
    const result = await saveNewTransaction(db, values({ categoryId: food, accountId: bca, description: '  Lunch with team ', note: 'Makan siang' }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ type: 'expense', accountId: bca, accountBalanceAfter: 6717500, toAccountId: null, toAccountBalanceAfter: null });

    const row = await getTransaction(db, result.value.id);
    expect(row).toMatchObject({
      kind: 'expense',
      account_id: bca,
      currency: 'IDR',
      amount: 125000,
      amount_idr: 125000,
      category_id: food,
      occurred_on: '2026-10-28',
      description: 'Lunch with team',
      note: 'Makan siang',
      source: 'manual',
      to_account_id: null,
    });
    expect(await balance(db, bca)).toBe(6717500);
  });

  test('an income: the balance goes up; an empty note is stored as null', async () => {
    const { db, bca, salary } = await fixture();
    const result = await saveNewTransaction(db, values({ type: 'income', amount: 7000000, categoryId: salary, accountId: bca, note: '   ' }), NOW);
    expect(result.ok && result.value.accountBalanceAfter).toBe(13842500);
    if (result.ok) expect((await getTransaction(db, result.value.id))?.note).toBeNull();
  });

  test('a transfer: one row, no category, both balances move, net worth, income and expense do not', async () => {
    const { db, bca, jago } = await fixture();
    const worthBefore = (await getNetWorth(db)).netWorth;
    const result = await saveNewTransaction(db, values({ type: 'transfer', amount: 500000, accountId: bca, toAccountId: jago, description: 'Top up Jago' }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ accountBalanceAfter: 6342500, toAccountId: jago, toAccountBalanceAfter: 1775000 });

    const row = await getTransaction(db, result.value.id);
    expect(row).toMatchObject({ kind: 'transfer', category_id: null, account_id: bca, to_account_id: jago, amount: 500000, amount_to: 500000, amount_idr: 500000, source: 'manual' });
    expect(await balance(db, bca)).toBe(6342500);
    expect(await balance(db, jago)).toBe(1775000);
    expect((await getNetWorth(db)).netWorth).toBe(worthBefore);
  });

  test('undo of a new record deletes that row and every balance goes back', async () => {
    const { db, bca, jago } = await fixture();
    const result = await saveNewTransaction(db, values({ type: 'transfer', amount: 500000, accountId: bca, toAccountId: jago }), NOW);
    if (!result.ok) throw new Error('save failed');
    expect(await undoNewTransaction(db, result.value.id)).toEqual({ ok: true, value: null });
    expect(await getTransaction(db, result.value.id)).toBeNull();
    expect(await balance(db, bca)).toBe(6842500);
    expect(await balance(db, jago)).toBe(1275000);
  });

  test('a schema guard that gets past the form comes back as a message, and nothing is written', async () => {
    const { db, bca, jago, food } = await fixture();
    const future = await saveNewTransaction(db, values({ categoryId: food, accountId: bca, date: '2026-10-29' }), NOW);
    expect(future).toEqual({ ok: false, message: 'Date cannot be later than 28 Oct 2026.' });

    const early = await saveNewTransaction(db, values({ categoryId: food, accountId: jago, date: '2026-02-01' }), NOW);
    expect(early).toEqual({ ok: false, message: "This account didn't exist yet on that date." });

    const short = await saveNewTransaction(db, values({ categoryId: food, accountId: jago, amount: 2000000 }), NOW);
    expect(short).toEqual({ ok: false, message: 'Short by Rp725.000. Pick another account or lower the amount.' });

    const wrongKind = await saveNewTransaction(db, values({ type: 'income', categoryId: food, accountId: bca }), NOW);
    expect(wrongKind).toEqual({ ok: false, message: 'Choose a category that matches the transaction type.' });

    expect(await balance(db, bca)).toBe(6842500);
    expect(await balance(db, jago)).toBe(1275000);
  });
});

describe('mapDbError', () => {
  test('every code the form can meet', () => {
    expect(mapDbError('future_date', { today: '2026-10-28' })).toBe('Date cannot be later than 28 Oct 2026.');
    expect(mapDbError('before_opening_date')).toBe("This account didn't exist yet on that date.");
    expect(mapDbError('category_kind_mismatch')).toBe('Choose a category that matches the transaction type.');
    expect(mapDbError('insufficient_balance', { shortfallFormatted: 'Rp1.050.000' })).toBe('Short by Rp1.050.000. Pick another account or lower the amount.');
    expect(mapDbError('insufficient_balance')).toBe('Not enough balance in this account.');
    expect(mapDbError('currency_not_in_account', { currency: 'SGD' })).toBe('This account does not have a SGD pocket.');
    expect(mapDbError('missing_fx_rate', { currency: 'SGD' })).toBe('Add an exchange rate for SGD first.');
  });

  test('an unknown or missing code says nothing technical', () => {
    expect(mapDbError('something_new')).toBe("Couldn't save. Nothing was changed.");
    expect(mapDbError(undefined)).toBe("Couldn't save. Nothing was changed.");
  });
});

describe('editing', () => {
  async function recordFixture() {
    const f = await fixture();
    const saved = await saveNewTransaction(f.db, values({ categoryId: f.food, accountId: f.bca, description: 'Lunch', note: 'old' }), NOW);
    if (!saved.ok) throw new Error('save failed');
    const before = (await getTransaction(f.db, saved.value.id))!;
    return { ...f, id: saved.value.id, before };
  }

  test('the same row is updated (same id, created_at and source), not a new one', async () => {
    const { db, bca, transport, id, before } = await recordFixture();
    const result = await saveTransactionChanges(db, id, values({ amount: 200000, categoryId: transport, accountId: bca, description: 'Ojek', note: '', date: '2026-10-27' }), '2026-10-28T13:00:00+07:00');
    expect(result.ok).toBe(true);
    const row = (await getTransaction(db, id))!;
    expect(row).toMatchObject({ id, amount: 200000, amount_idr: 200000, category_id: transport, description: 'Ojek', note: null, occurred_on: '2026-10-27', source: 'manual', created_at: before.created_at });
    expect(await balance(db, bca)).toBe(6642500);
  });

  test('an expense can become an income (the kind changes with its category)', async () => {
    const { db, bca, salary, id } = await recordFixture();
    const result = await saveTransactionChanges(db, id, values({ type: 'income', amount: 125000, categoryId: salary, accountId: bca }), NOW);
    expect(result.ok).toBe(true);
    expect((await getTransaction(db, id))?.kind).toBe('income');
    expect(await balance(db, bca)).toBe(6967500);
  });

  test('undo of an edit puts the old values back', async () => {
    const { db, bca, transport, id, before } = await recordFixture();
    await saveTransactionChanges(db, id, values({ amount: 200000, categoryId: transport, accountId: bca, description: 'Ojek', note: '', date: '2026-10-27' }), NOW);
    expect(await undoTransactionChanges(db, before, NOW)).toEqual({ ok: true, value: null });
    const row = (await getTransaction(db, id))!;
    expect(row).toMatchObject({ amount: 125000, category_id: before.category_id, description: 'Lunch', note: 'old', occurred_on: '2026-10-28', kind: 'expense' });
    expect(await balance(db, bca)).toBe(6717500);
  });

  test('a change the schema refuses keeps the row as it was', async () => {
    const { db, bca, food, id } = await recordFixture();
    const result = await saveTransactionChanges(db, id, values({ amount: 99999999, categoryId: food, accountId: bca }), NOW);
    expect(result.ok).toBe(false);
    expect((await getTransaction(db, id))?.amount).toBe(125000);
  });

  test('editing a transfer changes both sides', async () => {
    const { db, bca, jago } = await fixture();
    const saved = await saveNewTransaction(db, values({ type: 'transfer', amount: 500000, accountId: bca, toAccountId: jago }), NOW);
    if (!saved.ok) throw new Error('save failed');
    const result = await saveTransactionChanges(db, saved.value.id, values({ type: 'transfer', amount: 300000, accountId: bca, toAccountId: jago }), NOW);
    expect(result.ok).toBe(true);
    expect(await balance(db, bca)).toBe(6542500);
    expect(await balance(db, jago)).toBe(1575000);
    expect((await getTransaction(db, saved.value.id))).toMatchObject({ amount: 300000, amount_to: 300000, amount_idr: 300000 });
  });
});

describe('the form data for editing', () => {
  test("an account's balance is taken without the record being edited", async () => {
    const { db, bca, jago, food } = await fixture();
    const expense = await saveNewTransaction(db, values({ categoryId: food, accountId: bca, amount: 125000 }), NOW);
    const transfer = await saveNewTransaction(db, values({ type: 'transfer', amount: 500000, accountId: bca, toAccountId: jago }), NOW);
    if (!expense.ok || !transfer.ok) throw new Error('save failed');

    const forExpense = await getTxFormData(db, expense.value.id);
    expect(forExpense.accounts.find(a => a.id === bca)?.balance).toBe(6342500); // now 6.217.500, with the expense's 125.000 taken back out
    expect(forExpense.record).toMatchObject({ type: 'expense', amount: 125000, categoryId: food, supported: true });

    const forTransfer = await getTxFormData(db, transfer.value.id);
    expect(forTransfer.accounts.find(a => a.id === bca)?.balance).toBe(6717500); // 6.217.500 + 500.000
    expect(forTransfer.accounts.find(a => a.id === jago)?.balance).toBe(1275000); // 1.775.000 - 500.000

    const adding = await getTxFormData(db);
    expect(adding.record).toBeNull();
    expect(adding.accounts.find(a => a.id === bca)).toMatchObject({ name: 'BCA Tabungan', openingDate: '2026-01-01', balance: 6217500 });
    expect(adding.categories.some(c => c.kind === 'income')).toBe(true);
  });


  test('withoutRecord leaves a Valas account alone but takes a rupiah side back out (an exchange into rupiah)', () => {
    const accounts = [
      { id: 1, name: 'A', type: 'bank' as const, icon: null, balance: 100, openingDate: '2026-01-01' },
      { id: 2, name: 'Valas', type: 'forex' as const, icon: null, balance: 999, openingDate: '2026-01-01' },
    ];
    // a pure Valas expense: nothing to take out of a rupiah account
    expect(withoutRecord(accounts, { kind: 'expense', account_id: 2, to_account_id: null, amount: 50, amount_to: null, currency: 'SGD' })).toEqual(accounts);
    // US$ sold for Rp1.600.000 into account 1: that rupiah comes back out of account 1, and the Valas balance is untouched
    const before = withoutRecord(accounts, { kind: 'transfer', account_id: 2, to_account_id: 1, amount: 10000, amount_to: 1600000, currency: 'USD', to_currency: 'IDR' });
    expect(before.find(a => a.id === 1)?.balance).toBe(100 - 1600000);
    expect(before.find(a => a.id === 2)?.balance).toBe(999);
  });
});
