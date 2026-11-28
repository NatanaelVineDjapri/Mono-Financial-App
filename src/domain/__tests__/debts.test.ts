// Utang-piutang: balances move, income and expense do not, net worth stays right, and the guards hold.
import { exportBackup } from '../../data/backup/export';
import { restoreBackup } from '../../data/backup/restore';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { createHash } from 'crypto';

import { archiveAccount, createAccount } from '../accounts';
import { createDebt, debtTotals, deleteDebt, listDebtMoves, listDebts, payDebt, type NewDebt } from '../debts';
import { getTxFormData } from '../txForm';

const NOW = '2026-10-28T10:00:00.000Z';
const TODAY = '2026-10-28';
const sha = async (text: string) => createHash('sha256').update(text).digest('hex');

async function setup(): Promise<{ db: Db; bca: number }> {
  const db = await openMigratedTestDb();
  const bca = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 500_000, openingDate: '2026-10-01' }, NOW);
  return { db, bca };
}

const debt = (bca: number, over: Partial<NewDebt> = {}): NewDebt => ({
  direction: 'lent', person: 'Budi', amount: 100_000, accountId: bca, date: '2026-10-10', dueOn: null, note: '', accountName: 'Loan to Budi', description: 'Loan to Budi', ...over,
});
const pay = (bca: number, amount: number) => ({ amount, accountId: bca, date: '2026-10-20', description: 'Paid back' });

const balance = async (db: Db, id: number) => (await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = $id', { $id: id }))!.balance;
const netWorth = async (db: Db) => (await db.getFirstAsync<{ net_worth: number }>('select net_worth from v_net_worth'))!.net_worth;
const flows = async (db: Db) => db.getAllAsync('select income, expense from v_period_flow where income <> 0 or expense <> 0');

test('money lent leaves the account, is still counted in net worth and is no expense; paid back in parts', async () => {
  const { db, bca } = await setup();
  const made = await createDebt(db, debt(bca), TODAY, NOW);
  expect(made.ok).toBe(true);
  const id = (made as { value: number }).value;
  expect(await balance(db, bca)).toBe(400_000);
  expect(await netWorth(db)).toBe(500_000);
  expect(await flows(db)).toEqual([]);

  expect(await payDebt(db, id, pay(bca, 150_000), TODAY, NOW)).toEqual({ ok: false, error: 'more_than_owed' });
  expect(await payDebt(db, id, pay(bca, 40_000), TODAY, NOW)).toEqual({ ok: true, value: null });
  expect((await listDebts(db))[0]).toMatchObject({ person: 'Budi', total: 100_000, remaining: 60_000, started_on: '2026-10-10' });
  expect(await payDebt(db, id, pay(bca, 60_000), TODAY, NOW)).toEqual({ ok: true, value: null });
  expect(await balance(db, bca)).toBe(500_000);
  expect((await listDebts(db))[0].remaining).toBe(0);
  expect((await listDebtMoves(db, id)).map(m => [m.repayment, m.amount, m.account_name])).toEqual([[0, 100_000, 'BCA'], [1, 40_000, 'BCA'], [1, 60_000, 'BCA']]);
  expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
});

test('money borrowed arrives, is subtracted from net worth and is no income', async () => {
  const { db, bca } = await setup();
  const made = await createDebt(db, debt(bca, { direction: 'borrowed', person: 'Andi', amount: 200_000, accountName: 'Loan from Andi' }), TODAY, NOW);
  const id = (made as { value: number }).value;
  expect(await balance(db, bca)).toBe(700_000);
  expect(await netWorth(db)).toBe(500_000);
  expect(await flows(db)).toEqual([]);
  expect(debtTotals(await listDebts(db))).toEqual({ owedToMe: 0, iOwe: 200_000 });
  expect(await payDebt(db, id, pay(bca, 50_000), TODAY, NOW)).toEqual({ ok: true, value: null });
  expect((await listDebts(db))[0].remaining).toBe(150_000);
  expect(await netWorth(db)).toBe(500_000);
  expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
});

test('the database refuses an overdrawn account and paying back more than borrowed, even past the checks', async () => {
  const { db, bca } = await setup();
  expect(await createDebt(db, debt(bca, { amount: 600_000 }), TODAY, NOW)).toEqual({ ok: false, error: 'insufficient_balance' });
  expect(await createDebt(db, debt(bca, { person: '  ' }), TODAY, NOW)).toEqual({ ok: false, error: 'person_required' });
  expect(await createDebt(db, debt(bca, { date: '2026-11-01' }), TODAY, NOW)).toEqual({ ok: false, error: 'future_date' });
  const id = ((await createDebt(db, debt(bca, { direction: 'borrowed', accountName: 'Loan from Budi' }), TODAY, NOW)) as { value: number }).value;
  await expect(
    db.runAsync(
      "insert into transactions (kind, account_id, to_account_id, to_currency, amount, amount_to, amount_idr, occurred_on, created_at, updated_at) values ('transfer', $a, $t, 'IDR', 100001, 100001, 100001, '2026-10-12', $now, $now)",
      { $a: bca, $t: id, $now: NOW },
    ),
  ).rejects.toThrow('debt_overpaid');
});

test('the hidden account is offered nowhere, a second debt of the same person gets its own, and deleting gives the money back', async () => {
  const { db, bca } = await setup();
  const first = ((await createDebt(db, debt(bca), TODAY, NOW)) as { value: number }).value;
  const second = ((await createDebt(db, debt(bca, { amount: 20_000 }), TODAY, NOW)) as { value: number }).value;
  expect((await getTxFormData(db)).accounts.map(a => a.id)).toEqual([bca]);
  expect(await db.getAllAsync('select name from accounts where id in ($a, $b) order by id', { $a: first, $b: second })).toEqual([{ name: 'Loan to Budi' }, { name: 'Loan to Budi 2' }]);
  expect(await deleteDebt(db, first)).toEqual({ ok: true, value: null });
  expect(await balance(db, bca)).toBe(480_000);
  expect(await netWorth(db)).toBe(500_000);
});

test('a borrowed loan whose money is already spent cannot be deleted', async () => {
  const { db, bca } = await setup();
  const id = ((await createDebt(db, debt(bca, { direction: 'borrowed', amount: 200_000, accountName: 'Loan from Budi' }), TODAY, NOW)) as { value: number }).value;
  await createDebt(db, debt(bca, { amount: 650_000, person: 'Cici', accountName: 'Loan to Cici' }), TODAY, NOW);
  expect(await deleteDebt(db, id)).toEqual({ ok: false, error: 'insufficient_balance' });
  expect(await balance(db, bca)).toBe(50_000);
  expect(await db.getFirstAsync("select value from meta where key = 'guards_off'")).toEqual({ value: '0' });
});

test('debts survive a backup and restore', async () => {
  const { db, bca } = await setup();
  await createDebt(db, debt(bca, { direction: 'borrowed', accountName: 'Loan from Budi', dueOn: '2026-12-01' }), TODAY, NOW);
  const file = await exportBackup(db, NOW, sha);
  const target = await openMigratedTestDb();
  expect((await restoreBackup(target, JSON.stringify(file), NOW, sha)).ok).toBe(true);
  expect((await listDebts(target))[0]).toMatchObject({ direction: 'borrowed', person: 'Budi', due_on: '2026-12-01', remaining: 100_000 });
});
