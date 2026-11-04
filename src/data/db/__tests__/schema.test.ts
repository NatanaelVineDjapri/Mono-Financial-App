// Jest port of tools/verify_schema.py, run against the real schema with better-sqlite3.
// Reproduces every IDR figure in CLAUDE.md's sample data, all 13 named guard codes, and
// the Valas (multi-currency) fixture: USD 250,00 and SGD 180,00 at 16.250 / 12.500.
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, '../mono_schema_v1.sql'), 'utf8');
const NOW = '2026-11-03T10:00:00+07:00';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

type AccountId = { [name: string]: number };
type CategoryId = { [key: string]: number };

function loadLookups(db: Database.Database) {
  const accounts: AccountId = {};
  for (const r of db.prepare('select id, name from accounts').all() as { id: number; name: string }[]) {
    accounts[r.name] = r.id;
  }
  const categories: CategoryId = {};
  for (const r of db.prepare('select id, name, kind from categories').all() as {
    id: number;
    name: string;
    kind: string;
  }[]) {
    categories[`${r.name}/${r.kind}`] = r.id;
  }
  return { accounts, categories };
}

const insertIdrTx = (db: Database.Database) =>
  db.prepare(
    `insert into transactions
      (kind, account_id, to_account_id, to_currency, amount_to, category_id, amount, amount_idr, occurred_on, description, created_at, updated_at)
     values (@kind, @account_id, @to_account_id, @to_currency, @amount_to, @category_id, @amount, @amount_idr, @occurred_on, @description, @created_at, @updated_at)`,
  );

// Mirrors the Python I() helper: an IDR transaction, amount_idr = amount.
function idrTxParams(opts: {
  kind: 'income' | 'expense' | 'transfer';
  account_id: number;
  to_account_id?: number | null;
  category_id?: number | null;
  amount: number;
  occurred_on: string;
  description?: string;
}) {
  const to = opts.to_account_id ?? null;
  return {
    kind: opts.kind,
    account_id: opts.account_id,
    to_account_id: to,
    to_currency: to ? 'IDR' : null,
    amount_to: to ? opts.amount : null,
    category_id: opts.category_id ?? null,
    amount: opts.amount,
    amount_idr: opts.amount,
    occurred_on: opts.occurred_on,
    description: opts.description ?? '',
    created_at: NOW,
    updated_at: NOW,
  };
}

describe('MONO Finance schema v1 (IDR sample data)', () => {
  let db: Database.Database;
  let A: AccountId;
  let C: CategoryId;
  let cat: (name: string, kind?: 'income' | 'expense') => number;
  let tx: (p: ReturnType<typeof idrTxParams>) => number;

  beforeAll(() => {
    db = openDb();
    for (const [n, t, ob] of [
      ['BCA Tabungan', 'bank', 1200000],
      ['Cash wallet', 'cash', 450000],
      ['GoPay', 'ewallet', 312500],
      ['Jago Pocket', 'savings', 275000],
    ] as const) {
      db.prepare(
        'insert into accounts (name, type, opening_balance, opening_date, created_at) values (?, ?, ?, ?, ?)',
      ).run(n, t, ob, '2026-01-01', NOW);
    }
    ({ accounts: A, categories: C } = loadLookups(db));
    cat = (name, kind = 'expense') => C[`${name}/${kind}`];
    const stmt = insertIdrTx(db);
    tx = p => Number(stmt.run(p).lastInsertRowid);

    tx(idrTxParams({ kind: 'income', account_id: A['BCA Tabungan'], amount: 7500000, occurred_on: '2026-06-25', category_id: cat('Salary', 'income') }));
    tx(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: 4100500, occurred_on: '2026-08-10', category_id: cat('Bills') }));
    tx(idrTxParams({ kind: 'income', account_id: A['BCA Tabungan'], amount: 7000000, occurred_on: '2026-10-25', category_id: cat('Salary', 'income') }));
    tx(idrTxParams({ kind: 'income', account_id: A['BCA Tabungan'], amount: 500000, occurred_on: '2026-10-26', category_id: cat('Freelance', 'income') }));
    for (const [n, a] of [
      ['Shopping', 812000],
      ['Bills', 1150000],
      ['Transport', 540000],
      ['Food & drink', 1425000],
      ['Leisure', 210000],
      ['Health', 120000],
    ] as const) {
      tx(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: a, occurred_on: '2026-10-20', category_id: cat(n) }));
    }
    tx(idrTxParams({ kind: 'transfer', account_id: A['BCA Tabungan'], to_account_id: A['Jago Pocket'], amount: 1000000, occurred_on: '2026-10-27' }));

    db.prepare("insert into monthly_limits (month, amount) values ('2026-10', 5000000)").run();
    for (const [n, l] of [
      ['Shopping', 700000],
      ['Bills', 1200000],
      ['Transport', 600000],
      ['Food & drink', 1800000],
      ['Leisure', 400000],
      ['Health', 300000],
    ] as const) {
      db.prepare('insert into budgets (category_id, month, limit_amount) values (?, ?, ?)').run(cat(n), '2026-10', l);
    }
    db.prepare(
      "insert into goals (name, mode, account_id, target_amount, target_date, created_at) values ('Total assets', 'total_assets', NULL, 30000000, '2027-06-30', ?)",
    ).run(NOW);
    db.prepare(
      "insert into goals (name, mode, account_id, target_amount, target_date, created_at) values ('Emergency fund', 'account', ?, 15000000, '2027-12-31', ?)",
    ).run(A['BCA Tabungan'], NOW);
    db.prepare(
      "insert into goals (name, mode, account_id, target_amount, created_at) values ('Travel fund', 'account', ?, 8000000, ?)",
    ).run(A['Cash wallet'], NOW);
    db.prepare(
      "insert into recurring (name, amount, account_id, category_id, day_of_month, first_due_on, created_at) values ('Gym membership', 200000, ?, ?, 28, '2026-10-28', ?)",
    ).run(A['BCA Tabungan'], cat('Health'), NOW);
    db.prepare(
      "insert into recurring (name, amount, amount_varies, account_id, category_id, day_of_month, first_due_on, created_at) values ('Electricity token', 562000, 1, ?, ?, 31, '2026-08-31', ?)",
    ).run(A['BCA Tabungan'], cat('Bills'), NOW);
  });

  afterAll(() => db.close());

  test('account balances match the published sample data', () => {
    const rows = db.prepare('select name, balance from v_account_balance order by id').all();
    expect(rows).toEqual([
      { name: 'BCA Tabungan', balance: 6842500 },
      { name: 'Cash wallet', balance: 450000 },
      { name: 'GoPay', balance: 312500 },
      { name: 'Jago Pocket', balance: 1275000 },
    ]);
  });

  test('net worth is Rp8.880.000 and complete (no missing rates)', () => {
    expect(db.prepare('select net_worth, incomplete from v_net_worth').get()).toEqual({
      net_worth: 8880000,
      incomplete: 0,
    });
  });

  test('October flow: income 7.500.000, expense 4.257.000, net +3.243.000', () => {
    expect(db.prepare("select income, expense, net, transfer_count, transfer_total from v_period_flow where period = '2026-10'").get()).toEqual({
      income: 7500000,
      expense: 4257000,
      net: 3243000,
      transfer_count: 1,
      transfer_total: 1000000,
    });
  });

  test('October savings rate is 4324 bp (43,24%)', () => {
    expect(db.prepare("select savings_rate_bp from v_savings_rate where period = '2026-10'").get()).toEqual({
      savings_rate_bp: 4324,
    });
  });

  test('budget usage in basis points matches each category', () => {
    const rows = db.prepare('select category, used_bp, is_over from v_budget_status order by used_bp desc').all();
    expect(rows).toEqual([
      { category: 'Shopping', used_bp: 11600, is_over: 1 },
      { category: 'Bills', used_bp: 9583, is_over: 0 },
      { category: 'Transport', used_bp: 9000, is_over: 0 },
      { category: 'Food & drink', used_bp: 7917, is_over: 0 },
      { category: 'Leisure', used_bp: 5250, is_over: 0 },
      { category: 'Health', used_bp: 4000, is_over: 0 },
    ]);
  });

  test('Shopping is over by Rp112.000', () => {
    expect(db.prepare("select remaining from v_budget_status where category = 'Shopping'").get()).toEqual({
      remaining: -112000,
    });
  });

  test('month budget: Rp5.000.000 limit, Rp743.000 left', () => {
    expect(db.prepare('select monthly_limit, allocated, total_spent, remaining from v_month_budget').get()).toEqual({
      monthly_limit: 5000000,
      allocated: 5000000,
      total_spent: 4257000,
      remaining: 743000,
    });
  });

  test('goal progress: Total assets 2960 bp, Emergency fund 4562 bp', () => {
    const rows = db.prepare('select name, progress_bp from v_goal_progress order by name').all();
    expect(rows).toEqual([
      { name: 'Emergency fund', progress_bp: 4562 },
      { name: 'Total assets', progress_bp: 2960 },
      { name: 'Travel fund', progress_bp: 563 },
    ]);
  });

  test('September month-end net worth is Rp5.637.000', () => {
    const row = db.prepare("select net_worth from v_net_worth_by_month where month = '2026-09'").get() as { net_worth: number };
    expect(row.net_worth).toBe(5637000);
  });

  test('fixed expenses due: Electricity (Aug 31 clamp, Sep 30, Oct 31) and Gym (Oct 28)', () => {
    const rows = db.prepare('select name, due_on from v_recurring_due order by due_on').all();
    expect(rows).toEqual([
      { name: 'Electricity token', due_on: '2026-08-31' },
      { name: 'Electricity token', due_on: '2026-09-30' },
      { name: 'Gym membership', due_on: '2026-10-28' },
      { name: 'Electricity token', due_on: '2026-10-31' },
    ]);
  });

  test('account activity: running balance on BCA, most recent 4 moves', () => {
    const rows = db
      .prepare(
        "select occurred_on, kind, delta, balance_after from v_account_activity where account_id = ? and currency = 'IDR' order by occurred_on desc, tx_id desc limit 4",
      )
      .all(A['BCA Tabungan']);
    expect(rows).toEqual([
      { occurred_on: '2026-10-27', kind: 'transfer', delta: -1000000, balance_after: 6842500 },
      { occurred_on: '2026-10-26', kind: 'income', delta: 500000, balance_after: 7842500 },
      { occurred_on: '2026-10-25', kind: 'income', delta: 7000000, balance_after: 7342500 },
      { occurred_on: '2026-10-20', kind: 'expense', delta: -120000, balance_after: 342500 },
    ]);
  });

  test('the database starts with no integrity issues', () => {
    expect(db.prepare('select * from v_integrity_issues').all()).toEqual([]);
  });

  test('date-range queries use the occurred_on index', () => {
    const plan = db
      .prepare("explain query plan select * from transactions where occurred_on between '2026-10-01' and '2026-10-31'")
      .all() as { detail: string }[];
    expect(plan[0].detail).toContain('ix_tx_date');
  });

  describe('all 13 named guard codes are blocked', () => {
    test('insufficient_balance: an expense above the account balance', () => {
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['Cash wallet'], amount: 1500000, occurred_on: '2026-11-01', category_id: cat('Shopping') })),
      ).toThrow(/insufficient_balance/);
    });

    test('future_date: a transaction dated after today', () => {
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: 1000, occurred_on: '2099-01-01', category_id: cat('Bills') })),
      ).toThrow(/future_date/);
    });

    test('before_opening_date: a transaction dated before the account opened', () => {
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: 1000, occurred_on: '2025-12-31', category_id: cat('Bills') })),
      ).toThrow(/before_opening_date/);
    });

    test('category_kind_mismatch: income recorded against an expense category', () => {
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'income', account_id: A['BCA Tabungan'], amount: 1000, occurred_on: '2026-11-01', category_id: cat('Bills') })),
      ).toThrow(/category_kind_mismatch/);
    });

    test('insufficient_balance: deleting an income row would strand the balance negative', () => {
      const id = db
        .prepare("select id from transactions where kind = 'income' and amount = 7000000")
        .get() as { id: number };
      expect(() => db.prepare('delete from transactions where id = ?').run(id.id)).toThrow(/insufficient_balance/);
    });

    test('budget_needs_expense_category: a budget on an income category', () => {
      expect(() => db.prepare('insert into budgets (category_id, month, limit_amount) values (?, ?, ?)').run(cat('Salary', 'income'), '2026-10', 1)).toThrow(
        /budget_needs_expense_category/,
      );
    });

    test('over_monthly_limit: a new budget that would exceed the monthly limit', () => {
      expect(() => db.prepare('insert into budgets (category_id, month, limit_amount) values (?, ?, ?)').run(cat('Housing'), '2026-10', 500000)).toThrow(
        /over_monthly_limit/,
      );
    });

    test('over_monthly_limit: lowering the limit below what is already allocated', () => {
      expect(() => db.prepare("update monthly_limits set amount = 4000000 where month = '2026-10'").run()).toThrow(/over_monthly_limit/);
    });

    test('budgets_exist_for_month: deleting a monthly limit that still has budgets', () => {
      expect(() => db.prepare("delete from monthly_limits where month = '2026-10'").run()).toThrow(/budgets_exist_for_month/);
    });

    // The remaining four named codes (currency_not_in_account, missing_fx_rate,
    // pocket_needs_forex_account, pocket_not_empty, account_type_locked,
    // recurring_needs_idr_account) only apply to forex accounts and are exercised in
    // the Valas describe block below, against a forex account.

    test('raw CHECK constraints still hold (not named codes, but part of the row shape)', () => {
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'transfer', account_id: A['BCA Tabungan'], to_account_id: A['BCA Tabungan'], amount: 1000, occurred_on: '2026-11-01' })),
      ).toThrow(); // transfer to the same account
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'transfer', account_id: A['BCA Tabungan'], to_account_id: A['GoPay'], amount: 1000, occurred_on: '2026-11-01', category_id: cat('Bills') })),
      ).toThrow(); // a transfer cannot carry a category
      expect(() =>
        insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: 0, occurred_on: '2026-11-01', category_id: cat('Bills') })),
      ).toThrow(); // amount must be > 0
      expect(() =>
        db.prepare("insert into accounts (name, type, opening_date, created_at) values ('gopay', 'cash', '2026-01-01', ?)").run(NOW),
      ).toThrow(); // account names are unique case-insensitively
    });

    // tools/verify_schema.py (run under Python's sqlite3) reports this case as NOT
    // blocked, because that build's date() returns NULL for 30 February and a CHECK is
    // satisfied by NULL. better-sqlite3's bundled SQLite instead normalises the
    // overflow to 2 March, so the equality fails and the row is correctly rejected.
    // Since expo-sqlite also bundles a modern SQLite, this test reflects the behaviour
    // the real app will actually see.
    test('an invalid calendar date like 30 February is rejected by the date() CHECK', () => {
      expect(() =>
        db.prepare("insert into accounts (name, type, opening_date, created_at) values ('X', 'cash', '2026-02-30', ?)").run(NOW),
      ).toThrow();
    });
  });

  describe('allowed mutations', () => {
    test('raising the monthly limit then adding the Housing budget succeeds', () => {
      db.prepare("update monthly_limits set amount = 5500000 where month = '2026-10'").run();
      db.prepare('insert into budgets (category_id, month, limit_amount) values (?, ?, ?)').run(cat('Housing'), '2026-10', 500000);
      expect((db.prepare('select allocated from v_month_budget').get() as { allocated: number }).allocated).toBe(5500000);
    });

    test('confirming a fixed expense removes it from due; deleting the transaction brings it back', () => {
      const info = insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['BCA Tabungan'], amount: 200000, occurred_on: '2026-10-28', category_id: cat('Health'), description: 'Gym membership' }));
      const txId = Number(info.lastInsertRowid);
      db.prepare("update transactions set source = 'recurring' where id = ?").run(txId);
      db.prepare('insert into recurring_events values (1, ?, ?, ?, ?)').run('2026-10-28', 'recorded', txId, NOW);

      const dueAfterConfirm = db.prepare("select name from v_recurring_due where name = 'Gym membership'").all();
      expect(dueAfterConfirm).toEqual([]);

      db.prepare('delete from transactions where id = ?').run(txId);
      expect(db.prepare('select count(*) as n from recurring_events').get()).toEqual({ n: 0 });
      const dueAgain = db.prepare("select due_on from v_recurring_due where name = 'Gym membership'").all();
      expect(dueAgain).toEqual([{ due_on: '2026-10-28' }]);
    });

    test('restore simulation: guards off accepts a bad row, the integrity audit catches it, rollback restores guards', () => {
      db.exec('BEGIN');
      db.prepare("update meta set value = '1' where key = 'guards_off'").run();
      insertIdrTx(db).run(idrTxParams({ kind: 'expense', account_id: A['Cash wallet'], amount: 9999999, occurred_on: '2026-11-01', category_id: cat('Shopping'), description: 'bad' }));
      const issues = db.prepare('select * from v_integrity_issues').all();
      expect(issues).toEqual([{ issue: 'negative_balance', ref: `${A['Cash wallet']}/IDR` }]);
      db.exec('ROLLBACK');
      expect(db.prepare("select value from meta where key = 'guards_off'").get()).toEqual({ value: '0' });
      expect(db.prepare('select * from v_integrity_issues').all()).toEqual([]);
    });
  });

  // Continues on the SAME db/state as above (matching tools/verify_schema.py, which is
  // one continuous script). USD 250,00 and SGD 180,00 at 16.250 / 12.500 -> Valas
  // Rp6.312.500, net worth with Valas Rp15.192.500.
  describe('Valas (forex account with pockets)', () => {
    let V: number;
    let nw0: number;

    beforeAll(() => {
      db.prepare("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Valas', 'forex', 0, '2026-10-01', ?)").run(NOW);
      V = (db.prepare("select id from accounts where name = 'Valas'").get() as { id: number }).id;
      db.prepare("insert into account_currencies (account_id, currency, opening_balance, opening_date) values (?, 'USD', 25000, '2026-10-01')").run(V);
      db.prepare("insert into account_currencies (account_id, currency, opening_balance, opening_date) values (?, 'SGD', 20000, '2026-10-01')").run(V);
    });

    test('a pocket can exist before any rate: its value is null, net worth is incomplete', () => {
      expect(db.prepare('select incomplete from v_net_worth').get()).toEqual({ incomplete: 1 });
    });

    test('the missing_fx_rate audit lists both pockets', () => {
      const rows = db.prepare("select ref from v_integrity_issues where issue = 'missing_fx_rate'").all() as { ref: string }[];
      expect(rows.map(r => r.ref).sort()).toEqual(['SGD', 'USD']);
    });

    test('missing_fx_rate: an expense in a pocket with no rate yet', () => {
      expect(() =>
        db
          .prepare(
            "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'SGD',?,2000,250000,'2026-10-15',?,?)",
          )
          .run(V, cat('Food & drink'), NOW, NOW),
      ).toThrow(/missing_fx_rate/);
    });

    test('adding rates makes net worth complete again', () => {
      db.prepare("insert into fx_rates (currency, rate_e4, fetched_at, source) values ('USD', 162500000, '2026-10-28T09:00:00+07:00', 'api')").run();
      db.prepare("insert into fx_rates (currency, rate_e4, fetched_at, source) values ('SGD', 125000000, '2026-10-28T09:00:00+07:00', 'api')").run();
      expect(db.prepare('select net_worth, incomplete from v_net_worth').get()).toEqual({ net_worth: 8880000 + 4062500 + 2500000, incomplete: 0 });
    });

    test('USD pocket is worth Rp4.062.500 (US$250,00 at 16.250)', () => {
      expect(db.prepare("select balance, value_idr from v_pocket_value where account_id = ? and currency = 'USD'").get(V)).toEqual({
        balance: 25000,
        value_idr: 4062500,
      });
    });

    test('SGD pocket is worth Rp2.500.000 (S$200,00 at 12.500)', () => {
      expect(db.prepare("select balance, value_idr from v_pocket_value where account_id = ? and currency = 'SGD'").get(V)).toEqual({
        balance: 20000,
        value_idr: 2500000,
      });
    });

    test('an expense inside the SGD pocket counts in rupiah in the account balance', () => {
      db.prepare(
        "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,description,created_at,updated_at) values ('expense',?,'SGD',?,2000,250000,'2026-10-15','Dinner, Singapore',?,?)",
      ).run(V, cat('Food & drink'), NOW, NOW);
      expect(db.prepare('select balance, missing_rates from v_account_balance where id = ?').get(V)).toEqual({
        balance: 4062500 + 2250000,
        missing_rates: 0,
      });
    });

    test('October expense total now includes the SGD dinner in rupiah', () => {
      expect((db.prepare("select expense from v_period_flow where period = '2026-10'").get() as { expense: number }).expense).toBe(4257000 + 250000);
    });

    test('Food & drink category spend includes it too', () => {
      expect(
        (db.prepare("select spent from v_category_spend where period = '2026-10' and category_id = ?").get(cat('Food & drink')) as { spent: number }).spent,
      ).toBe(1425000 + 250000);
    });

    test('a cross-currency transfer and a pocket-to-pocket exchange leave net worth unchanged', () => {
      nw0 = (db.prepare('select net_worth from v_net_worth').get() as { net_worth: number }).net_worth;
      // IDR -> USD pocket: Rp1.625.000 becomes US$100,00. One row, two amounts.
      db.prepare(
        "insert into transactions (kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,description,created_at,updated_at) values ('transfer',?,'IDR',?,'USD',1625000,10000,1625000,'2026-10-29','Buy USD',?,?)",
      ).run(A['BCA Tabungan'], V, NOW, NOW);
      // USD pocket -> SGD pocket in the SAME account (an exchange): US$50,00 becomes S$65,00.
      db.prepare(
        "insert into transactions (kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,description,created_at,updated_at) values ('transfer',?,'USD',?,'SGD',5000,6500,812500,'2026-10-30','USD to SGD',?,?)",
      ).run(V, V, NOW, NOW);
      expect((db.prepare('select net_worth from v_net_worth').get() as { net_worth: number }).net_worth).toBe(nw0);
    });

    test('USD and SGD pocket balances reflect both transfers', () => {
      expect((db.prepare("select balance from v_pocket_balance where account_id = ? and currency = 'USD'").get(V) as { balance: number }).balance).toBe(
        25000 + 10000 - 5000,
      );
      expect((db.prepare("select balance from v_pocket_balance where account_id = ? and currency = 'SGD'").get(V) as { balance: number }).balance).toBe(
        18000 + 6500,
      );
    });

    test('BCA drops by the rupiah spent buying USD', () => {
      expect((db.prepare('select balance from v_account_balance where id = ?').get(A['BCA Tabungan']) as { balance: number }).balance).toBe(6842500 - 1625000);
    });

    test('exchanges between pockets are never income or expense', () => {
      expect(db.prepare("select income, expense from v_period_flow where period = '2026-10'").get()).toEqual({ income: 7500000, expense: 4257000 + 250000 });
    });

    test('statement: USD pocket running balance across both transfers', () => {
      const rows = db
        .prepare("select kind, delta, balance_after from v_account_activity where account_id = ? and currency = 'USD' order by occurred_on, tx_id")
        .all(V);
      expect(rows).toEqual([
        { kind: 'transfer_in', delta: 10000, balance_after: 35000 },
        { kind: 'transfer', delta: -5000, balance_after: 30000 },
      ]);
    });

    describe('Valas guard codes', () => {
      test('currency_not_in_account: a USD expense on a normal IDR account', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'USD',?,100,16250,'2026-10-30',?,?)",
            )
            .run(A['BCA Tabungan'], cat('Bills'), NOW, NOW),
        ).toThrow(/currency_not_in_account/);
      });

      test('currency_not_in_account: a JPY expense with no JPY pocket', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'JPY',?,100,100,'2026-10-30',?,?)",
            )
            .run(V, cat('Bills'), NOW, NOW),
        ).toThrow(/currency_not_in_account/);
      });

      test('insufficient_balance: a SGD expense above the SGD pocket (S$300 > S$245)', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'SGD',?,30000,3750000,'2026-10-30',?,?)",
            )
            .run(V, cat('Bills'), NOW, NOW),
        ).toThrow(/insufficient_balance/);
      });

      test('raw CHECK: a same-account, same-currency transfer', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,created_at,updated_at) values ('transfer',?,'USD',?,'USD',100,100,16250,'2026-10-30',?,?)",
            )
            .run(V, V, NOW, NOW),
        ).toThrow();
      });

      test('raw CHECK: a same-currency transfer with mismatched amounts', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,created_at,updated_at) values ('transfer',?,'IDR',?,'IDR',1000,900,1000,'2026-10-30',?,?)",
            )
            .run(A['BCA Tabungan'], A['GoPay'], NOW, NOW),
        ).toThrow();
      });

      test('raw CHECK: an IDR row whose amount_idr differs from amount', () => {
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'IDR',?,1000,999,'2026-10-30',?,?)",
            )
            .run(A['BCA Tabungan'], cat('Bills'), NOW, NOW),
        ).toThrow();
      });

      test('pocket_needs_forex_account: a pocket on a normal account', () => {
        expect(() =>
          db.prepare("insert into account_currencies (account_id, currency, opening_date) values (?, 'USD', '2026-10-01')").run(A['BCA Tabungan']),
        ).toThrow(/pocket_needs_forex_account/);
      });

      test('raw CHECK: a pocket cannot be IDR', () => {
        expect(() => db.prepare("insert into account_currencies (account_id, currency, opening_date) values (?, 'IDR', '2026-10-01')").run(V)).toThrow();
      });

      test('raw CHECK: a forex account cannot have an opening balance', () => {
        expect(() =>
          db.prepare("insert into accounts (name,type,opening_balance,opening_date,created_at) values ('V2','forex',5,'2026-10-01',?)").run(NOW),
        ).toThrow();
      });

      test('pocket_not_empty: archiving a pocket that still holds money', () => {
        expect(() => db.prepare("update account_currencies set archived = 1 where account_id = ? and currency = 'USD'").run(V)).toThrow(/pocket_not_empty/);
      });

      test('account_type_locked: converting a used bank account to forex', () => {
        expect(() => db.prepare("update accounts set type = 'forex' where id = ?").run(A['BCA Tabungan'])).toThrow(/account_type_locked/);
      });

      test('recurring_needs_idr_account: a fixed expense on a forex account', () => {
        expect(() =>
          db
            .prepare("insert into recurring (name,amount,account_id,category_id,day_of_month,first_due_on,created_at) values ('X',1000,?,?,1,'2026-10-01',?)")
            .run(V, cat('Bills'), NOW),
        ).toThrow(/recurring_needs_idr_account/);
      });

      test('raw FK: an unknown currency code', () => {
        expect(() => db.prepare("insert into fx_rates (currency,rate_e4,fetched_at,source) values ('XXX',1,'2026-10-30T00:00:00+07:00','api')").run()).toThrow();
      });

      test('raw CHECK: a rate cannot be stored for IDR', () => {
        expect(() =>
          db.prepare("insert into fx_rates (currency,rate_e4,fetched_at,source) values ('IDR',10000,'2026-10-30T00:00:00+07:00','api')").run(),
        ).toThrow();
      });

      test('currency_not_in_account: a new transaction in an archived pocket', () => {
        db.exec('BEGIN');
        db.prepare("insert into account_currencies (account_id, currency, opening_date) values (?, 'EUR', '2026-10-30')").run(V);
        db.prepare("update account_currencies set archived = 1 where account_id = ? and currency = 'EUR'").run(V);
        expect(() =>
          db
            .prepare(
              "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('income',?,'EUR',?,100,1,'2026-10-31',?,?)",
            )
            .run(V, cat('Salary', 'income'), NOW, NOW),
        ).toThrow(/currency_not_in_account/);
        db.exec('ROLLBACK'); // undo the EUR pocket too, matching tools/verify_schema.py
      });
    });

    describe('rate history and rounding', () => {
      test('a newer manual rate wins for the present, but October month-end keeps the October rate', () => {
        db.prepare("insert into fx_rates (currency,rate_e4,fetched_at,source) values ('USD',163000000,'2026-11-02T08:00:00+07:00','manual')").run();
        expect(db.prepare("select rate_e4, source from v_latest_fx where currency = 'USD'").get()).toEqual({ rate_e4: 163000000, source: 'manual' });
        expect((db.prepare('select net_worth from v_net_worth').get() as { net_worth: number }).net_worth).toBe(nw0 + 300 * (16300 - 16250));

        const nwm = Object.fromEntries(
          (db.prepare('select month, net_worth from v_net_worth_by_month').all() as { month: string; net_worth: number }[]).map(r => [r.month, r.net_worth]),
        );
        expect(nwm['2026-09']).toBe(5637000); // excludes Valas, opened 1 Oct
        expect(nwm['2026-10']).toBe(nw0); // the October rate
        expect(nwm['2026-11']).toBe(nw0 + 300 * (16300 - 16250)); // the newer rate
      });

      test('half away from zero: Rp108,50 per yen rounds 1 yen to 109 and 3 yen to 326', () => {
        db.prepare("insert into fx_rates (currency,rate_e4,fetched_at,source) values ('JPY',1085000,'2026-11-02T08:00:00+07:00','manual')").run();
        db.prepare("insert into accounts (name,type,opening_date,created_at) values ('Tiny','forex','2026-10-01',?)").run(NOW);
        const T = (db.prepare("select id from accounts where name = 'Tiny'").get() as { id: number }).id;
        db.prepare("insert into account_currencies (account_id,currency,opening_balance,opening_date) values (?,'JPY',1,'2026-10-01')").run(T);
        expect((db.prepare("select value_idr from v_pocket_value where account_id = ? and currency = 'JPY'").get(T) as { value_idr: number }).value_idr).toBe(
          109,
        );
        db.prepare("update account_currencies set opening_balance = 3 where account_id = ? and currency = 'JPY'").run(T);
        expect((db.prepare("select value_idr from v_pocket_value where account_id = ? and currency = 'JPY'").get(T) as { value_idr: number }).value_idr).toBe(
          326,
        );
      });
    });

    test('restore simulation: a row in a missing pocket loads with guards off, the audit catches it', () => {
      db.exec('BEGIN');
      db.prepare("update meta set value = '1' where key = 'guards_off'").run();
      db.prepare(
        "insert into transactions (kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values ('expense',?,'JPY',?,100,100,'2026-10-30',?,?)",
      ).run(V, cat('Bills'), NOW, NOW);
      const issues = db.prepare('select issue from v_integrity_issues').all();
      expect(issues).toEqual([{ issue: 'currency_not_in_account' }]);
      db.exec('ROLLBACK');
    });
  });
});
