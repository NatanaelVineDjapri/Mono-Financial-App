// The Valas account on the real (migrated) schema: one account, pockets per currency, a rate that is
// missing is never zero, amount_idr is frozen when a record is written, and an exchange moves net
// worth only by its difference.
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { insertFxRate } from '../../../data/repo/fx';
import { listCategories } from '../../../data/repo/categories';
import { createAccount } from '../../../domain/accounts';
import { DomainError } from '../../../domain/errors';
import { getNetWorth } from '../../../domain/net-worth';
import { createRecurring } from '../../../domain/recurring';
import { addExpense, addIncome, addTransfer } from '../../../domain/transactions';
import { addForexPocket, archiveForexPocket, createForexAccount, ForexError, getForexAccountId } from '../forexAccount';

const OPENED = '2026-10-01';
const NOW = '2026-10-28T09:00:00+07:00';
const RATE_AT = '2026-10-28T09:00:00+07:00';

async function fixture() {
  const db = await openMigratedTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6_000_000, openingDate: '2026-01-01' }, NOW);
  const food = (await listCategories(db, { kind: 'expense' })).find(c => c.name === 'Food & drink')!.id;
  return { db, bca, food };
}

async function withValas() {
  const f = await fixture();
  const valas = await createForexAccount(f.db, { name: 'Valas', openingDate: OPENED, pockets: [{ currency: 'USD', openingMinor: 25000 }, { currency: 'SGD', openingMinor: 20000 }] }, NOW);
  await insertFxRate(f.db, 'USD', 162500000, RATE_AT, 'api');
  await insertFxRate(f.db, 'SGD', 125000000, RATE_AT, 'api');
  return { ...f, valas };
}

const catchCode = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof DomainError || e instanceof ForexError ? e.code : `other: ${String(e)}`;
  }
};

describe('createForexAccount', () => {
  test('one account with its pockets; the account itself has no balance of its own', async () => {
    const { db, valas } = await withValas();
    expect(await getForexAccountId(db)).toBe(valas);
    expect(await db.getFirstAsync('select type, opening_balance from accounts where id = ?', [valas])).toEqual({ type: 'forex', opening_balance: 0 });
    expect(await db.getAllAsync('select currency, opening_balance, opening_date from account_currencies order by currency')).toEqual([
      { currency: 'SGD', opening_balance: 20000, opening_date: OPENED },
      { currency: 'USD', opening_balance: 25000, opening_date: OPENED },
    ]);
  });

  test('there is only one Valas account: a second is refused with a clear reason', async () => {
    const { db } = await withValas();
    expect(await catchCode(() => createForexAccount(db, { name: 'Valas 2', openingDate: OPENED, pockets: [{ currency: 'EUR', openingMinor: 0 }] }, NOW))).toBe('forex_account_exists');
    expect((await db.getAllAsync("select * from accounts where type = 'forex'")).length).toBe(1);
  });

  test('the schema itself refuses a second one, whatever wrote it (forex_account_exists)', async () => {
    const { db } = await withValas();
    await expect(db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Other', 'forex', 0, ?, ?)", [OPENED, NOW])).rejects.toThrow('forex_account_exists');
  });

  test('a plain account cannot be turned into a second forex account', async () => {
    const { db, bca } = await withValas();
    await expect(db.runAsync("update accounts set type = 'forex' where id = ?", [bca])).rejects.toThrow(/forex_account_exists|account_type_locked/);
  });

  test('an archived Valas account does not block a new one', async () => {
    const { db, valas } = await withValas();
    await db.runAsync('update accounts set archived = 1 where id = ?', [valas]);
    expect(await getForexAccountId(db)).toBeNull();
    expect(await catchCode(() => createForexAccount(db, { name: 'Valas baru', openingDate: OPENED, pockets: [{ currency: 'EUR', openingMinor: 0 }] }, NOW))).toBeNull();
  });

  test('all or nothing: a bad pocket leaves no account behind', async () => {
    const { db } = await fixture();
    expect(await catchCode(() => createForexAccount(db, { name: 'Valas', openingDate: OPENED, pockets: [{ currency: 'USD', openingMinor: 100 }, { currency: 'XYZ', openingMinor: 0 }] }, NOW))).toBe('unsupported_currency');
    expect(await getForexAccountId(db)).toBeNull();
  });

  test.each([
    ['no currency', { name: 'Valas', pockets: [] }, 'no_pockets'],
    ['the same currency twice', { name: 'Valas', pockets: [{ currency: 'USD', openingMinor: 1 }, { currency: 'USD', openingMinor: 2 }] }, 'duplicate_currency'],
    ['the rupiah is not a pocket', { name: 'Valas', pockets: [{ currency: 'IDR', openingMinor: 1 }] }, 'unsupported_currency'],
    ['a negative opening balance', { name: 'Valas', pockets: [{ currency: 'USD', openingMinor: -1 }] }, 'amount_invalid'],
    ['a fraction of a cent', { name: 'Valas', pockets: [{ currency: 'USD', openingMinor: 1.5 }] }, 'amount_invalid'],
    ['an empty name', { name: '   ', pockets: [{ currency: 'USD', openingMinor: 1 }] }, 'name_invalid'],
    ['a name over 40 characters', { name: 'x'.repeat(41), pockets: [{ currency: 'USD', openingMinor: 1 }] }, 'name_invalid'],
  ])('%s is refused', async (_label, input, code) => {
    const { db } = await fixture();
    expect(await catchCode(() => createForexAccount(db, { openingDate: OPENED, ...input }, NOW))).toBe(code);
  });

  test('an opening date in the future is refused', async () => {
    const { db } = await fixture();
    expect(await catchCode(() => createForexAccount(db, { name: 'Valas', openingDate: '2026-10-29', pockets: [{ currency: 'USD', openingMinor: 1 }] }, NOW))).toBe('future_date');
  });
});

describe('pockets', () => {
  test('a currency can be added later, with its own opening date; a duplicate is refused', async () => {
    const { db, valas } = await withValas();
    await addForexPocket(db, valas, { currency: 'EUR', openingMinor: 5000 }, '2026-10-15', NOW);
    expect(await db.getFirstAsync("select opening_balance, opening_date from account_currencies where currency = 'EUR'")).toEqual({ opening_balance: 5000, opening_date: '2026-10-15' });
    expect(await catchCode(() => addForexPocket(db, valas, { currency: 'EUR', openingMinor: 1 }, '2026-10-15', NOW))).toBe('duplicate_currency');
  });

  test('a pocket cannot be added to an account that is not the Valas account', async () => {
    const { db, bca } = await withValas();
    expect(await catchCode(() => addForexPocket(db, bca, { currency: 'EUR', openingMinor: 0 }, OPENED, NOW))).toBe('not_forex_account');
  });

  test('an empty pocket is archived; one that still holds money is refused (pocket_not_empty)', async () => {
    const { db, valas } = await withValas();
    expect(await catchCode(() => archiveForexPocket(db, valas, 'USD'))).toBe('pocket_not_empty');
    await addForexPocket(db, valas, { currency: 'EUR', openingMinor: 0 }, OPENED, NOW);
    expect(await catchCode(() => archiveForexPocket(db, valas, 'EUR'))).toBeNull();
    expect(await db.getFirstAsync("select archived from account_currencies where currency = 'EUR'")).toEqual({ archived: 1 });
  });

  test('an archived currency comes back with the balance it had', async () => {
    const { db, valas } = await withValas();
    await addForexPocket(db, valas, { currency: 'EUR', openingMinor: 0 }, OPENED, NOW);
    await archiveForexPocket(db, valas, 'EUR');
    await addForexPocket(db, valas, { currency: 'EUR', openingMinor: 999 }, '2026-10-20', NOW);
    expect(await db.getFirstAsync("select archived, opening_balance from account_currencies where currency = 'EUR'")).toEqual({ archived: 0, opening_balance: 0 });
  });

  test('a record on a currency the account does not hold is refused (currency_not_in_account)', async () => {
    const { db, valas, food } = await withValas();
    await insertFxRate(db, 'EUR', 180000000, RATE_AT, 'api');
    expect(await catchCode(() => addExpense(db, { accountId: valas, currency: 'EUR', categoryId: food, amount: 100, occurredOn: '2026-10-20' }, NOW))).toBe('currency_not_in_account');
  });
});

describe('a pocket without a rate is never worth zero', () => {
  test('value_idr is NULL, net worth is incomplete, and a new record is refused (missing_fx_rate)', async () => {
    const f = await fixture();
    const valas = await createForexAccount(f.db, { name: 'Valas', openingDate: OPENED, pockets: [{ currency: 'USD', openingMinor: 25000 }] }, NOW);
    expect(await f.db.getFirstAsync('select balance, rate_e4, value_idr from v_pocket_value where account_id = ?', [valas])).toEqual({ balance: 25000, rate_e4: null, value_idr: null });
    expect(await f.db.getFirstAsync('select balance, missing_rates from v_account_balance where id = ?', [valas])).toEqual({ balance: 0, missing_rates: 1 });
    expect((await getNetWorth(f.db)).incomplete).toBe(true);
    expect(await catchCode(() => addExpense(f.db, { accountId: valas, currency: 'USD', categoryId: f.food, amount: 100, occurredOn: '2026-10-20' }, NOW))).toBe('missing_fx_rate');
  });

  test('once a rate exists the pocket is valued and net worth is complete again', async () => {
    const { db, valas } = await withValas();
    expect(await db.getFirstAsync('select value_idr from v_pocket_value where account_id = ? and currency = ?', [valas, 'USD'])).toEqual({ value_idr: 4062500 });
    expect((await getNetWorth(db)).incomplete).toBe(false);
  });
});

describe('amount_idr is frozen when the record is written', () => {
  test('S$20,00 at Rp12.500 is Rp250.000; a rate change afterwards does not move it', async () => {
    const { db, valas, food } = await withValas();
    const { id, amountIdr } = await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: food, amount: 2000, occurredOn: '2026-10-15', description: 'Dinner, Singapore' }, NOW);
    expect(amountIdr).toBe(250000);

    await insertFxRate(db, 'SGD', 130000000, '2026-10-29T09:00:00+07:00', 'api'); // the dollar got dearer
    expect(await db.getFirstAsync('select amount, amount_idr from transactions where id = ?', [id])).toEqual({ amount: 2000, amount_idr: 250000 });
    // the pocket's own value moves with the rate (an estimate), the record's does not
    expect(await db.getFirstAsync("select value_idr from v_pocket_value where currency = 'SGD'")).toEqual({ value_idr: Math.round(18000 * 130000000 / 1000000) });
  });

  test('budgets and reports add up amount_idr only', async () => {
    const { db, valas, food } = await withValas();
    await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: food, amount: 2000, occurredOn: '2026-10-15' }, NOW);
    await insertFxRate(db, 'SGD', 140000000, '2026-10-29T09:00:00+07:00', 'api');
    await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: food, amount: 1000, occurredOn: '2026-10-16' }, '2026-10-29T10:00:00+07:00');
    // 250.000 at the old rate + 140.000 at the new one; a later rate never rewrites the first
    expect(await db.getFirstAsync("select spent from v_category_spend where category_id = ? and period = '2026-10'", [food])).toEqual({ spent: 250000 + 140000 });
    expect(await db.getFirstAsync("select expense from v_period_flow where period = '2026-10'")).toEqual({ expense: 390000 });
  });

  test('income in a pocket is frozen too', async () => {
    const { db, valas } = await withValas();
    const income = (await listCategories(db, { kind: 'income' }))[0].id;
    expect((await addIncome(db, { accountId: valas, currency: 'USD', categoryId: income, amount: 10000, occurredOn: '2026-10-20' }, NOW)).amountIdr).toBe(1625000);
  });

  test('an expense bigger than the pocket is refused, in that currency', async () => {
    const { db, valas, food } = await withValas();
    try {
      await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: food, amount: 30000, occurredOn: '2026-10-20' }, NOW);
      throw new Error('should have been refused');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('insufficient_balance');
      expect((e as DomainError).context.shortfallFormatted).toBe('S$100,00'); // the pocket has S$200,00
    }
  });
});

describe('an exchange', () => {
  test('rupiah to dollars at the stored rate: both pockets move and net worth does not', async () => {
    const { db, bca, valas } = await withValas();
    const before = (await getNetWorth(db)).netWorth;
    const { amountIdr } = await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: valas, toCurrency: 'USD', amount: 1625000, amountTo: 10000, occurredOn: '2026-10-29', description: 'Buy USD' }, '2026-10-29T10:00:00+07:00');
    expect(amountIdr).toBe(1625000);
    expect(await db.getFirstAsync("select balance from v_pocket_balance where account_id = ? and currency = 'USD'", [valas])).toEqual({ balance: 35000 });
    expect((await getNetWorth(db)).netWorth).toBe(before);
  });

  test('dollars to Singapore dollars inside the Valas account: net worth moves only by the difference', async () => {
    const { db, valas } = await withValas();
    const before = (await getNetWorth(db)).netWorth;
    // US$100,00 (Rp1.625.000) -> S$128,00 (Rp1.600.000): Rp25.000 lost to the exchange
    await addTransfer(db, { accountId: valas, currency: 'USD', toAccountId: valas, toCurrency: 'SGD', amount: 10000, amountTo: 12800, occurredOn: '2026-10-29' }, '2026-10-29T10:00:00+07:00');
    expect((await getNetWorth(db)).netWorth).toBe(before - 25000);
  });

  test('inside one Valas account an exchange is only between two different pockets', async () => {
    const { db, valas } = await withValas();
    expect(await catchCode(() => addTransfer(db, { accountId: valas, currency: 'USD', toAccountId: valas, toCurrency: 'USD', amount: 100, occurredOn: '2026-10-29' }, '2026-10-29T10:00:00+07:00'))).not.toBeNull();
    expect(await db.getFirstAsync("select count(*) as n from transactions where kind = 'transfer'")).toEqual({ n: 0 });
  });
});

describe('fixed expenses cannot use the Valas account', () => {
  test('recurring_needs_idr_account', async () => {
    const { db, valas, food } = await withValas();
    expect(await catchCode(() => createRecurring(db, { name: 'Langganan', amount: 1000, accountId: valas, categoryId: food, dayOfMonth: 1, firstDueOn: '2026-11-01' }, NOW))).toBe('recurring_needs_idr_account');
  });
});

describe('the Valas sample numbers (CLAUDE.md)', () => {
  test('US$250,00 and S$180,00 at the rates of 28 Oct 09:00 make Valas about Rp6.312.500', async () => {
    const { db, valas, food } = await withValas();
    await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: food, amount: 2000, occurredOn: '2026-10-15' }, NOW); // the S$20 dinner
    expect(await db.getFirstAsync('select balance from v_account_balance where id = ?', [valas])).toEqual({ balance: 6312500 });
  });
});
