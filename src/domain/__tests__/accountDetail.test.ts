import { saveAccountChanges, saveNewAccount } from '../../core/account/save';
import { openTestDb } from '../../data/db/openTestDb';
import { listCategories } from '../../data/repo/categories';
import { createAccount } from '../accounts';
import { getAccountDetail, getAccountEditData, listAccountActivity, listAccountNames, type ActivityKind } from '../accountDetail';
import { getAccountBalance } from '../balances';
import { addExpense, addIncome, addTransfer } from '../transactions';

const NOW = '2026-10-28T10:00:00+07:00';
const kindName = (k: ActivityKind) => k;

// BCA Tabungan, as on the board: opening Rp1.200.000, 15.000.000 in, 9.357.500 out, 6.842.500 now.
async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 275000, openingDate: '2026-01-01' }, NOW);
  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;

  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-06-25' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 4100500, occurredOn: '2026-08-10', description: 'Rent' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, occurredOn: '2026-10-25', description: 'Salary, October' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Freelance'), amount: 500000, occurredOn: '2026-10-26', description: 'Freelance, logo work' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Food & drink'), amount: 5257000, occurredOn: '2026-10-20' }, NOW);
  await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: jago, amount: 1000000, occurredOn: '2026-10-27', description: 'Top up Jago Pocket' }, NOW);
  return { db, bca, jago };
}

describe('getAccountDetail', () => {
  test('opening + money in − money out is exactly the balance the view reports', async () => {
    const { db, bca } = await fixture();
    const d = (await getAccountDetail(db, bca, '2026-10-28'))!;
    expect(d).toMatchObject({ name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01', period: '2026-10' });
    expect(d.moneyIn).toBe(15000000);
    expect(d.moneyOut).toBe(10357500); // 4.100.500 + 5.257.000 expenses + 1.000.000 transfer out
    expect(d.openingBalance + d.moneyIn - d.moneyOut).toBe(d.balance);
    expect(d.balance).toBe((await getAccountBalance(db, bca))?.balance);
    expect(d.balance).toBe(5842500); // 1.200.000 + 15.000.000 - 10.357.500
    expect(d.recordCount).toBe(6);
  });

  test('a transfer counts as money in for the account it went to', async () => {
    const { db, jago } = await fixture();
    const d = (await getAccountDetail(db, jago, '2026-10-28'))!;
    expect(d).toMatchObject({ moneyIn: 1000000, moneyOut: 0, balance: 1275000 });
    expect(d.openingBalance + d.moneyIn - d.moneyOut).toBe(d.balance);
  });

  test('an account with no records: all zero, balance is the opening balance', async () => {
    const db = openTestDb();
    const id = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
    expect(await getAccountDetail(db, id, '2026-10-28')).toMatchObject({ moneyIn: 0, moneyOut: 0, recordCount: 0, balance: 450000 });
  });

  test('an unknown id is null', async () => {
    const { db } = await fixture();
    expect(await getAccountDetail(db, 999, '2026-10-28')).toBeNull();
  });
});

describe('listAccountActivity', () => {
  test("the month's rows, newest first, each with the running balance after it", async () => {
    const { db, bca } = await fixture();
    const rows = await listAccountActivity(db, bca, '2026-10', 'all', kindName);
    expect(rows.map(r => [r.date, r.title, r.kind, r.delta, r.balanceAfter])).toEqual([
      ['2026-10-27', 'Top up Jago Pocket', 'transfer_out', -1000000, 5842500],
      ['2026-10-26', 'Freelance, logo work', 'income', 500000, 6842500],
      ['2026-10-25', 'Salary, October', 'income', 7000000, 6342500],
      ['2026-10-20', 'Food & drink', 'expense', -5257000, -657500],
    ]);
    // The running balance chains: each row's balance is the one before it plus its delta.
    for (let i = 0; i < rows.length - 1; i++) expect(rows[i].balanceAfter - rows[i].delta).toBe(rows[i + 1].balanceAfter);
    expect(rows[0].balanceAfter).toBe((await getAccountDetail(db, bca, '2026-10-28'))!.balance);
  });

  test('In and Out filters', async () => {
    const { db, bca } = await fixture();
    const incoming = await listAccountActivity(db, bca, '2026-10', 'in', kindName);
    const outgoing = await listAccountActivity(db, bca, '2026-10', 'out', kindName);
    expect(incoming.map(r => r.kind)).toEqual(['income', 'income']);
    expect(outgoing.map(r => r.kind)).toEqual(['transfer_out', 'expense']);
  });

  test("only that month: another month's records are not here", async () => {
    const { db, bca } = await fixture();
    expect(await listAccountActivity(db, bca, '2026-08', 'all', kindName)).toHaveLength(1);
    expect(await listAccountActivity(db, bca, '2026-09', 'all', kindName)).toEqual([]);
  });

  test('a transfer into the account is a "transfer_in" row titled by where it came from when it has no description', async () => {
    const { db, jago, bca } = await fixture();
    await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: jago, amount: 100000, occurredOn: '2026-10-28' }, NOW);
    const rows = await listAccountActivity(db, jago, '2026-10', 'all', kindName);
    expect(rows[0]).toMatchObject({ kind: 'transfer_in', title: '← BCA Tabungan', delta: 100000 });
    expect(rows[1]).toMatchObject({ kind: 'transfer_in', title: 'Top up Jago Pocket' });
    const out = await listAccountActivity(db, bca, '2026-10', 'all', kindName);
    expect(out[0]).toMatchObject({ kind: 'transfer_out', title: '→ Jago Pocket' });
  });
});

describe('getAccountEditData', () => {
  test("what the form needs to judge an edit: the movement and the oldest record", async () => {
    const { db, bca } = await fixture();
    expect(await getAccountEditData(db, bca)).toMatchObject({ name: 'BCA Tabungan', openingBalance: 1200000, openingDate: '2026-01-01', movement: 4642500, firstRecordOn: '2026-06-25' });
    expect(await getAccountEditData(db, 999)).toBeNull();
    expect((await listAccountNames(db)).map(n => n.name)).toEqual(['BCA Tabungan', 'Jago Pocket']);
  });
});

describe('saving accounts', () => {
  test('a new account is stored as typed (trimmed name) and starts at its opening balance', async () => {
    const db = openTestDb();
    const result = await saveNewAccount(db, { name: '  BCA Tabungan ', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01', icon: 'bca' }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await getAccountDetail(db, result.value.id, '2026-10-28')).toMatchObject({ name: 'BCA Tabungan', type: 'bank', icon: 'bca', openingBalance: 1200000, balance: 1200000 });
  });

  test('a duplicate name (any case) comes back as a message', async () => {
    const db = openTestDb();
    await saveNewAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01', icon: null }, NOW);
    const again = await saveNewAccount(db, { name: 'gopay', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01', icon: null }, NOW);
    expect(again).toEqual({ ok: false, message: 'You already have an account with this name.' });
  });

  test('editing recalculates the balance (a view), and the type can change between normal types', async () => {
    const { db, bca } = await fixture();
    const before = (await getAccountDetail(db, bca, '2026-10-28'))!;
    const result = await saveAccountChanges(db, bca, { name: 'BCA Utama', type: 'savings', openingBalance: 2200000, openingDate: '2026-01-01', icon: 'bca' });
    expect(result).toEqual({ ok: true, value: null });
    const after = (await getAccountDetail(db, bca, '2026-10-28'))!;
    expect(after).toMatchObject({ name: 'BCA Utama', type: 'savings', openingBalance: 2200000 });
    expect(after.balance).toBe(before.balance + 1000000);
  });

  test('the schema guards come back as messages: a date past the oldest record, a balance below zero', async () => {
    const { db, bca } = await fixture();
    const late = await saveAccountChanges(db, bca, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-07-01', icon: null }, { firstRecordOn: '2026-06-25' });
    expect(late).toEqual({ ok: false, message: 'This account has records from 25 Jun 2026. Pick that day or an earlier one.' });

    // Opening balance down to zero: 0 + 15.000.000 in - 10.357.500 out is still above zero, so it is allowed.
    const lower = await saveAccountChanges(db, bca, { name: 'BCA Tabungan', type: 'bank', openingBalance: 0, openingDate: '2026-01-01', icon: null });
    expect(lower.ok).toBe(true);
  });
});
