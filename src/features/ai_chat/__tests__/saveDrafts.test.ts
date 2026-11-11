import { openTestDb } from '../../../data/db/openTestDb';
import { getPocketBalanceNow } from '../../../data/repo/transactionDetail';
import { getTransaction } from '../../../data/repo/transactions';
import { createAccount } from '../../../domain/accounts';
import { getNetWorth } from '../../../domain/net-worth';
import { getTxFormData } from '../../../domain/txForm';
import { chooseAmount } from '../draft';
import { processResponse, type Draft, type InterpretResult } from '../interpret';
import { canSave, saveDrafts, undoDrafts } from '../saveDrafts';
import { response, tx } from './fixtures';

const NOW = '2026-10-28T12:41:09+07:00';

async function fixture() {
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
  const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-01-01' }, NOW);
  const { accounts, categories } = await getTxFormData(db);
  const ctx = { today: '2026-10-28', accounts, categories };

  const draftsFor = (message: string, ...items: Parameters<typeof tx>[0][]): Draft[] => {
    const result: InterpretResult = processResponse(response('create_transactions', items.map(i => tx(i))), message, ctx);
    if (result.kind !== 'drafts' && result.kind !== 'clarify') throw new Error('no drafts');
    return result.drafts;
  };
  const count = async () => (await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n;
  const balance = (id: number) => getPocketBalanceNow(db, id, 'IDR');
  return { db, bca, cash, gopay, jago, ctx, draftsFor, count, balance };
}

const lunch = { type: 'expense', amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' } as const;
const parking = { type: 'expense', amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' } as const;

describe('saveDrafts', () => {
  test('two drafts are saved together with source "ai"; balances come from the views', async () => {
    const f = await fixture();
    const drafts = f.draftsFor('makan siang 48rb cash, parkir 5rb', lunch, parking);
    const result = await saveDrafts(f.db, drafts, ['d1', 'd2'], NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.ids).toHaveLength(2);
    expect(result.value.balances).toEqual([{ accountId: f.cash, balance: 397000 }]);
    const rows = await Promise.all(result.value.ids.map(id => getTransaction(f.db, id)));
    expect(rows.map(r => r?.source)).toEqual(['ai', 'ai']);
    expect(rows.map(r => [r?.kind, r?.amount, r?.amount_idr, r?.description, r?.occurred_on])).toEqual([
      ['expense', 48000, 48000, 'Makan siang', '2026-10-28'],
      ['expense', 5000, 5000, 'Parkir', '2026-10-28'],
    ]);
    expect(await f.balance(f.cash)).toBe(397000);
  });

  test('only the chosen drafts are saved', async () => {
    const f = await fixture();
    const drafts = f.draftsFor('makan siang 48rb cash, parkir 5rb', lunch, parking);
    const result = await saveDrafts(f.db, drafts, ['d2'], NOW);
    expect(result.ok && result.value.saved.map(s => s.draftId)).toEqual(['d2']);
    expect(await f.count()).toBe(1);
    expect(await f.balance(f.cash)).toBe(445000);
  });

  test('income and transfer: the transfer is one row, net worth does not change', async () => {
    const f = await fixture();
    const before = (await getNetWorth(f.db)).netWorth;
    const drafts = f.draftsFor('transfer 500rb bca ke jago', { type: 'transfer', amount: 500000, amount_text: '500rb', description: 'Ke Jago', account: 'BCA Tabungan', to_account: 'Jago Pocket' });
    const result = await saveDrafts(f.db, drafts, ['d1'], NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.balances.sort((a, b) => a.accountId - b.accountId)).toEqual([
      { accountId: f.bca, balance: 6342500 },
      { accountId: f.jago, balance: 1775000 },
    ]);
    expect(await getTransaction(f.db, result.value.ids[0])).toMatchObject({ kind: 'transfer', category_id: null, to_account_id: f.jago, amount_to: 500000, source: 'ai' });
    expect((await getNetWorth(f.db)).netWorth).toBe(before);
  });

  test('Urungkan removes every row of the batch and the balances go back', async () => {
    const f = await fixture();
    const drafts = f.draftsFor('makan siang 48rb cash, parkir 5rb', lunch, parking);
    const saved = await saveDrafts(f.db, drafts, ['d1', 'd2'], NOW);
    if (!saved.ok) throw new Error('save failed');
    expect(await undoDrafts(f.db, saved.value.ids)).toEqual({ ok: true, value: null });
    expect(await f.count()).toBe(0);
    expect(await f.balance(f.cash)).toBe(450000);
  });

  test('a draft that needs something, a locked amount or a blocked draft cannot be saved, and nothing is written', async () => {
    const f = await fixture();
    const needs = f.draftsFor('bayar 150rb', { amount: 150000, amount_text: '150rb', description: 'Bayar' });
    const check = f.draftsFor('bensin 40rb cash', { amount: 4000, amount_text: '40rb', category: 'Transport', account: 'Cash wallet' });
    const blocked = f.draftsFor('headphone 1,5jt cash', { amount: 1500000, amount_text: '1,5jt', category: 'Shopping', account: 'Cash wallet' });
    expect([needs[0].status.kind, check[0].status.kind, blocked[0].status.kind]).toEqual(['needs', 'check_amount', 'blocked']);

    for (const drafts of [needs, check, blocked]) {
      expect(canSave(drafts[0])).toBe(false);
      const result = await saveDrafts(f.db, drafts, ['d1'], NOW);
      expect(result.ok).toBe(false);
    }
    expect(await f.count()).toBe(0);

    // once the person has chosen, it can be saved
    const fixed = chooseAmount(check, 'd1', 40000, f.ctx);
    expect(canSave(fixed[0])).toBe(true);
    expect((await saveDrafts(f.db, fixed, ['d1'], NOW)).ok).toBe(true);
  });

  test('the lock is in the domain: a forged "ready" status on a draft with a gap is still refused', async () => {
    const f = await fixture();
    const [needs] = f.draftsFor('bayar 150rb', { amount: 150000, amount_text: '150rb', description: 'Bayar' });
    const forged: Draft = { ...needs, status: { kind: 'ready' } };
    expect((await saveDrafts(f.db, [forged], ['d1'], NOW)).ok).toBe(false);
    const [check] = f.draftsFor('bensin 40rb cash', { amount: 4000, amount_text: '40rb', category: 'Transport', account: 'Cash wallet' });
    expect((await saveDrafts(f.db, [{ ...check, status: { kind: 'ready' } }], ['d1'], NOW)).ok).toBe(false);
    expect(await f.count()).toBe(0);
  });

  test('nothing chosen, or an unknown id, is refused', async () => {
    const f = await fixture();
    const drafts = f.draftsFor('makan siang 48rb cash', lunch);
    expect((await saveDrafts(f.db, drafts, [], NOW)).ok).toBe(false);
    expect((await saveDrafts(f.db, drafts, ['d1', 'd9'], NOW)).ok).toBe(false);
    expect(await f.count()).toBe(0);
  });

  test('all or nothing: if the database refuses one draft, none is stored', async () => {
    const f = await fixture();
    const [first, second] = f.draftsFor('makan siang 48rb cash, parkir 5rb', lunch, parking);
    // The schema is the backstop: this one reaches it with a date in the future.
    const result = await saveDrafts(f.db, [first, { ...second, date: '2026-12-01' }], ['d1', 'd2'], NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Date cannot be later than 28 Oct 2026/);
    expect(await f.count()).toBe(0);
    expect(await f.balance(f.cash)).toBe(450000);
  });

  test('the balance guard still holds if the cash went down since the draft was made', async () => {
    const f = await fixture();
    const drafts = f.draftsFor('makan siang 48rb cash', lunch);
    await f.db.runAsync(
      "insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('expense', $a, 'IDR', $c, 440000, 440000, '2026-10-28', 'x', 'manual', $n, $n)",
      { $a: f.cash, $c: f.ctx.categories.find(c => c.name === 'Shopping')!.id, $n: NOW },
    );
    const result = await saveDrafts(f.db, drafts, ['d1'], NOW);
    expect(result.ok).toBe(false);
    expect(await f.count()).toBe(1);
  });
});
