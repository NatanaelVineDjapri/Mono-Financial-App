// Reproduces every published IDR figure (CLAUDE.md's Sample data section) and the
// separate Valas fixture, built ENTIRELY through src/domain functions — never a raw SQL
// insert — to prove the domain layer itself (not just the schema) gets the real numbers.
// The Valas boards use a SEPARATE sample (CLAUDE.md): buildIdrSample() alone reproduces
// the plain IDR numbers; addValasFixture() extends that same db for the Valas numbers,
// which are the IDR totals plus Valas from that point on.
import { createAccount, createValasAccount } from '../accounts';
import { listCategories } from '../../data/repo/categories';
import { insertFxRate } from '../../data/repo/fx';
import type { Db } from '../../data/db/types';
import { openTestDb } from '../../data/db/openTestDb';
import { getAccountBalance, getPocketValue } from '../balances';
import { createBudget, getBudgetStatus, getMonthBudget, setMonthlyLimit } from '../budget';
import { createGoal, listGoalProgress } from '../goals';
import { getNetWorth, getNetWorthHistory } from '../net-worth';
import { createRecurring, listRecurringDue } from '../recurring';
import { getPeriodFlow, getSavingsRate } from '../reports';
import { addExpense, addIncome, addTransfer } from '../transactions';

// Reference "today" in the design: Wed 28 Oct 2026.
const NOW = '2026-10-28T10:00:00+07:00';

async function buildIdrSample() {
  const db = openTestDb();

  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
  const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 275000, openingDate: '2026-01-01' }, NOW);

  const categories = await listCategories(db);
  const cat = (name: string) => categories.find(c => c.name === name)!.id;

  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7500000, occurredOn: '2026-06-25' }, NOW);
  await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat('Bills'), amount: 4100500, occurredOn: '2026-08-10' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Salary'), amount: 7000000, occurredOn: '2026-10-25' }, NOW);
  await addIncome(db, { accountId: bca, currency: 'IDR', categoryId: cat('Freelance'), amount: 500000, occurredOn: '2026-10-26' }, NOW);
  for (const [name, amount] of [
    ['Shopping', 812000],
    ['Bills', 1150000],
    ['Transport', 540000],
    ['Food & drink', 1425000],
    ['Leisure', 210000],
    ['Health', 120000],
  ] as const) {
    await addExpense(db, { accountId: bca, currency: 'IDR', categoryId: cat(name), amount, occurredOn: '2026-10-20' }, NOW);
  }
  await addTransfer(db, { accountId: bca, currency: 'IDR', toAccountId: jago, amount: 1000000, occurredOn: '2026-10-27' }, NOW);

  await setMonthlyLimit(db, '2026-10', 5000000);
  for (const [name, limitAmount] of [
    ['Shopping', 700000],
    ['Bills', 1200000],
    ['Transport', 600000],
    ['Food & drink', 1800000],
    ['Leisure', 400000],
    ['Health', 300000],
  ] as const) {
    await createBudget(db, { categoryId: cat(name), month: '2026-10', limitAmount });
  }

  await createGoal(db, { name: 'Total assets', mode: 'total_assets', targetAmount: 30000000, targetDate: '2027-06-30' }, NOW);
  await createGoal(db, { name: 'Emergency fund', mode: 'account', accountId: bca, targetAmount: 15000000, targetDate: '2027-12-31' }, NOW);
  await createGoal(db, { name: 'Travel fund', mode: 'account', accountId: cash, targetAmount: 8000000 }, NOW);

  // Due today, left unconfirmed on purpose — the sample shows it as "due", not posted.
  await createRecurring(db, { name: 'Gym membership', amount: 200000, accountId: bca, categoryId: cat('Health'), dayOfMonth: 28, firstDueOn: '2026-10-28' }, NOW);

  return { db, bca, cash, gopay, jago, cat };
}

// US$250,00 and S$200,00 opened 1 Oct, a S$20,00 dinner on 15 Oct leaves S$180,00.
async function addValasFixture(db: Db, cat: (name: string) => number) {
  const valas = await createValasAccount(
    db,
    { name: 'Valas', openingDate: '2026-10-01', pockets: [{ currency: 'USD', openingBalance: 25000 }, { currency: 'SGD', openingBalance: 20000 }] },
    NOW,
  );
  await insertFxRate(db, 'USD', 162500000, '2026-10-28T09:00:00+07:00', 'api');
  await insertFxRate(db, 'SGD', 125000000, '2026-10-28T09:00:00+07:00', 'api');
  await addExpense(db, { accountId: valas, currency: 'SGD', categoryId: cat('Food & drink'), amount: 2000, occurredOn: '2026-10-15', description: 'Dinner, Singapore' }, NOW);
  return valas;
}

describe('the IDR sample, built entirely through domain functions', () => {
  test('account balances', async () => {
    const { db, bca, cash, gopay, jago } = await buildIdrSample();
    expect((await getAccountBalance(db, bca))?.balance).toBe(6842500);
    expect((await getAccountBalance(db, cash))?.balance).toBe(450000);
    expect((await getAccountBalance(db, gopay))?.balance).toBe(312500);
    expect((await getAccountBalance(db, jago))?.balance).toBe(1275000);
  });

  test('net worth: Rp8.880.000, September was Rp5.637.000', async () => {
    const { db } = await buildIdrSample();
    expect(await getNetWorth(db)).toEqual({ netWorth: 8880000, incomplete: false });
    const history = await getNetWorthHistory(db);
    expect(history.find(h => h.month === '2026-09')?.netWorth).toBe(5637000);
  });

  test('October flow and savings rate: income 7.500.000, expense 4.257.000, net +3.243.000, 4324 bp', async () => {
    const { db } = await buildIdrSample();
    expect(await getPeriodFlow(db, '2026-10')).toMatchObject({ income: 7500000, expense: 4257000, net: 3243000 });
    expect((await getSavingsRate(db, '2026-10'))?.savings_rate_bp).toBe(4324);
  });

  test('budgets: Shopping over by Rp112.000 at 116,00%, Rp743.000 left overall', async () => {
    const { db } = await buildIdrSample();
    const status = await getBudgetStatus(db, '2026-10');
    expect(status.find(s => s.category === 'Shopping')).toMatchObject({ spent: 812000, remaining: -112000, used_bp: 11600, is_over: 1 });
    expect((await getMonthBudget(db, '2026-10'))?.remaining).toBe(743000);
  });

  test('goals: Total assets 2960 bp, Emergency fund 4562 bp, Travel fund barely started', async () => {
    const { db } = await buildIdrSample();
    const progress = await listGoalProgress(db);
    expect(progress.find(g => g.name === 'Total assets')?.progress_bp).toBe(2960);
    expect(progress.find(g => g.name === 'Emergency fund')?.progress_bp).toBe(4562);
    // "Travel fund 0" in the sample data is the rounded headline (563 bp = 5,63%), not a
    // literal zero — it reads Cash wallet's balance (450.000), not a typed-in amount.
    expect(progress.find(g => g.name === 'Travel fund')).toMatchObject({ current_amount: 450000, progress_bp: 563 });
  });

  test('Gym membership shows as due today, unconfirmed (not posted as an expense)', async () => {
    const { db } = await buildIdrSample();
    expect(await listRecurringDue(db)).toEqual([expect.objectContaining({ name: 'Gym membership', due_on: '2026-10-28' })]);
    expect((await getBudgetStatus(db, '2026-10')).find(s => s.category === 'Health')?.spent).toBe(120000);
  });
});

describe('the Valas fixture, added on top of the same IDR sample', () => {
  test('Valas is worth Rp6.312.500 (US$250,00 + S$180,00 at 16.250 / 12.500)', async () => {
    const { db, cat } = await buildIdrSample();
    const valas = await addValasFixture(db, cat);

    expect((await getPocketValue(db, valas, 'USD'))?.value_idr).toBe(4062500);
    const sgd = await getPocketValue(db, valas, 'SGD');
    expect(sgd?.balance).toBe(18000); // S$180,00 after the S$20,00 dinner
    expect(sgd?.value_idr).toBe(2250000);
    expect((await getAccountBalance(db, valas))?.balance).toBe(4062500 + 2250000);
  });

  test('net worth with Valas is Rp15.192.500', async () => {
    const { db, cat } = await buildIdrSample();
    await addValasFixture(db, cat);
    expect(await getNetWorth(db)).toEqual({ netWorth: 8880000 + 6312500, incomplete: false });
  });

  test('the SGD dinner counts in October rupiah reports, via addExpense\'s own conversion', async () => {
    const { db, cat } = await buildIdrSample();
    await addValasFixture(db, cat);
    // S$20,00 at 12.500 = Rp250.000
    expect((await getPeriodFlow(db, '2026-10'))?.expense).toBe(4257000 + 250000);
    const foodDrink = (await getBudgetStatus(db, '2026-10')).find(s => s.category === 'Food & drink');
    expect(foodDrink?.spent).toBe(1425000 + 250000);
  });

  test('a pocket with no rate yet flags net worth incomplete rather than counting as zero', async () => {
    const { db } = await buildIdrSample();
    const valas = await createValasAccount(db, { name: 'Valas', openingDate: '2026-10-01', pockets: [{ currency: 'EUR', openingBalance: 1000 }] }, NOW);
    expect(await getNetWorth(db)).toEqual({ netWorth: 8880000, incomplete: true });
    expect((await getAccountBalance(db, valas))?.missing_rates).toBe(1);
  });
});
