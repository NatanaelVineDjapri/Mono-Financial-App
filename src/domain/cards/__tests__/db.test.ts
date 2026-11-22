// Pairing a card with an account and recording the difference: against the real schema, never a mock of it.
import { ADJUSTMENT_CATEGORY_NAME, ADJUSTMENT_DESCRIPTION } from '../../../core/cardAdjustment';
import { ADJUSTMENT_CATEGORY_NAME as MIGRATION_CATEGORY_NAME } from '../../../data/db/migrations/v12_nfc_card_links';
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import type { Db } from '../../../data/db/types';
import { createAccount } from '../../accounts';
import { addExpense } from '../../transactions';
import { previewAdjustment, recordAdjustment, undoAdjustment } from '../adjustment';
import { createAccountFromCard, ensureNfcSalt, findCardAccount, linkCardToAccount, unlinkCard } from '../links';
import type { CardInfo } from '../types';

const NOW = '2026-11-03T10:00:00+07:00';

const card = (over: Partial<CardInfo> = {}): CardInfo => ({
  issuer: 'mandiri',
  last4: '7731',
  fingerprint: 'fp-7731',
  balance: 84_000,
  readAt: NOW,
  estimated: false,
  ...over,
});

async function fixture(): Promise<{ db: Db; ewallet: number; bank: number }> {
  const db = await openMigratedTestDb();
  const ewallet = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 100_000, openingDate: '2026-01-01' }, NOW);
  const bank = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 1_000_000, openingDate: '2026-01-01' }, NOW);
  return { db, ewallet, bank };
}

const balanceOf = async (db: Db, id: number) => (await db.getFirstAsync<{ balance: number }>('select balance from v_account_balance where id = ?', [id]))?.balance;
const count = async (db: Db, table: string) => (await db.getFirstAsync<{ n: number }>(`select count(*) as n from ${table}`))!.n;

test('the stored category name is the one migration 11 -> 12 seeds', () => {
  expect(ADJUSTMENT_CATEGORY_NAME).toBe(MIGRATION_CATEGORY_NAME);
});

describe('ensureNfcSalt', () => {
  test('is made once, from random bytes, and read back every time after', async () => {
    const { db } = await fixture();
    const bytes = jest.fn(async () => Uint8Array.from({ length: 16 }, (_, i) => i));
    const first = await ensureNfcSalt(db, bytes);
    expect(first).toBe('000102030405060708090a0b0c0d0e0f');
    expect(await ensureNfcSalt(db, bytes)).toBe(first);
    expect(bytes).toHaveBeenCalledTimes(1);
    expect(await db.getFirstAsync("select value from settings where key = 'nfc_salt'")).toEqual({ value: first });
  });

  test('two callers at once end up with one salt', async () => {
    const { db } = await fixture();
    let n = 0;
    const bytes = async () => new Uint8Array(16).fill(++n);
    const [a, b] = await Promise.all([ensureNfcSalt(db, bytes), ensureNfcSalt(db, bytes)]);
    expect(a).toBe(b);
    expect(await count(db, 'settings where key = \'nfc_salt\'')).toBe(1);
  });
});

describe('createAccountFromCard', () => {
  test('makes an e-wallet account with the card balance as its opening balance, and the link, in one go', async () => {
    const { db } = await fixture();
    const result = await createAccountFromCard(db, { card: card(), name: ' E-money Mandiri ', openingBalance: 84_000, now: NOW });
    expect(result.ok).toBe(true);
    const accountId = (result as { ok: true; value: { accountId: number } }).value.accountId;
    expect(await db.getFirstAsync('select name, type, opening_balance, opening_date from accounts where id = ?', [accountId])).toEqual({ name: 'E-money Mandiri', type: 'ewallet', opening_balance: 84_000, opening_date: '2026-11-03' });
    expect(await db.getFirstAsync('select * from card_links')).toEqual({ account_id: accountId, issuer: 'mandiri', last4: '7731', fingerprint: 'fp-7731', linked_at: NOW });
    expect(await balanceOf(db, accountId)).toBe(84_000);
    expect((await findCardAccount(db, 'fp-7731'))?.account_name).toBe('E-money Mandiri');
  });

  test('the opening balance may be changed from what the card says', async () => {
    const { db } = await fixture();
    const result = await createAccountFromCard(db, { card: card(), name: 'Kartu', openingBalance: 50_000, now: NOW });
    const id = (result as { ok: true; value: { accountId: number } }).value.accountId;
    expect(await balanceOf(db, id)).toBe(50_000);
  });

  test('the same card cannot make a second account', async () => {
    const { db } = await fixture();
    await createAccountFromCard(db, { card: card(), name: 'Kartu', openingBalance: 84_000, now: NOW });
    expect(await createAccountFromCard(db, { card: card(), name: 'Kartu dua', openingBalance: 84_000, now: NOW })).toEqual({ ok: false, reason: 'already_linked' });
    expect(await count(db, 'accounts')).toBe(3);
  });

  test('a name that is empty, too long or taken is refused, and nothing is left behind', async () => {
    const { db } = await fixture();
    expect(await createAccountFromCard(db, { card: card(), name: '   ', openingBalance: 1, now: NOW })).toEqual({ ok: false, reason: 'name_invalid' });
    expect(await createAccountFromCard(db, { card: card(), name: 'x'.repeat(41), openingBalance: 1, now: NOW })).toEqual({ ok: false, reason: 'name_invalid' });
    expect(await createAccountFromCard(db, { card: card(), name: 'gopay', openingBalance: 1, now: NOW })).toEqual({ ok: false, reason: 'name_taken' });
    expect(await count(db, 'accounts')).toBe(2);
    expect(await count(db, 'card_links')).toBe(0);
  });

  test.each([-1, 1.5, Number.NaN])('an opening balance of %p is refused', async bad => {
    const { db } = await fixture();
    expect(await createAccountFromCard(db, { card: card(), name: 'Kartu', openingBalance: bad, now: NOW })).toEqual({ ok: false, reason: 'balance_invalid' });
    expect(await count(db, 'accounts')).toBe(2);
  });

  test('if the link cannot be written the account is not made either (one transaction)', async () => {
    const { db } = await fixture();
    // 'abc' is not 4 digits: the schema refuses the link row, after the account row was already inserted.
    await expect(createAccountFromCard(db, { card: card({ last4: 'abc' }), name: 'Kartu', openingBalance: 1, now: NOW })).rejects.toBeDefined();
    expect(await count(db, 'accounts')).toBe(2);
    expect(await count(db, 'card_links')).toBe(0);
  });
});

describe('linkCardToAccount', () => {
  test('pairs the card with an e-wallet account that has none', async () => {
    const { db, ewallet } = await fixture();
    expect(await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW })).toEqual({ ok: true, value: { accountId: ewallet } });
    expect((await findCardAccount(db, 'fp-7731'))?.account_id).toBe(ewallet);
  });

  test('only an e-wallet account: a bank, cash or savings account is refused', async () => {
    const { db, bank } = await fixture();
    expect(await linkCardToAccount(db, { accountId: bank, card: card(), now: NOW })).toEqual({ ok: false, reason: 'not_ewallet' });
    expect(await count(db, 'card_links')).toBe(0);
  });

  test('the Valas account is refused', async () => {
    const { db } = await fixture();
    const valas = (await db.runAsync("insert into accounts (name, type, opening_balance, opening_date, created_at) values ('Valas', 'forex', 0, '2026-01-01', ?)", [NOW])).lastInsertRowId;
    expect(await linkCardToAccount(db, { accountId: valas, card: card(), now: NOW })).toEqual({ ok: false, reason: 'not_ewallet' });
  });

  test('an account that already has a card is refused', async () => {
    const { db, ewallet } = await fixture();
    await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW });
    expect(await linkCardToAccount(db, { accountId: ewallet, card: card({ fingerprint: 'other', last4: '0001' }), now: NOW })).toEqual({ ok: false, reason: 'account_has_card' });
  });

  test('a card that already belongs to another account is refused', async () => {
    const { db, ewallet } = await fixture();
    const second = await createAccount(db, { name: 'DANA', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW });
    expect(await linkCardToAccount(db, { accountId: second, card: card(), now: NOW })).toEqual({ ok: false, reason: 'already_linked' });
  });

  test('an archived or missing account is refused', async () => {
    const { db, ewallet } = await fixture();
    await db.runAsync('update accounts set archived = 1 where id = ?', [ewallet]);
    expect(await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW })).toEqual({ ok: false, reason: 'account_not_found' });
    expect(await linkCardToAccount(db, { accountId: 9999, card: card(), now: NOW })).toEqual({ ok: false, reason: 'account_not_found' });
  });

  test('unlinking removes only the link: the account and its transactions stay', async () => {
    const { db, ewallet } = await fixture();
    await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW });
    await addExpense(db, { accountId: ewallet, currency: 'IDR', categoryId: 1, amount: 10_000, occurredOn: '2026-11-01' }, NOW);
    expect(await unlinkCard(db, ewallet)).toBe(true);
    expect(await unlinkCard(db, ewallet)).toBe(false);
    expect(await findCardAccount(db, 'fp-7731')).toBeNull();
    expect(await balanceOf(db, ewallet)).toBe(90_000);
    expect(await count(db, 'transactions')).toBe(1);
  });
});

describe('the adjustment', () => {
  async function linked(): Promise<{ db: Db; ewallet: number }> {
    const { db, ewallet } = await fixture();
    await linkCardToAccount(db, { accountId: ewallet, card: card(), now: NOW });
    return { db, ewallet };
  }

  test('a card with less than MONO becomes an expense, and then the two balances are equal', async () => {
    const { db, ewallet } = await linked();
    const preview = await previewAdjustment(db, ewallet, 84_000);
    expect(preview).toMatchObject({ appBalance: 100_000, cardBalance: 84_000, diff: -16_000, action: 'expense', amount: 16_000 });

    const result = await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    expect(result).toMatchObject({ ok: true, value: { kind: 'expense', amount: 16_000, balanceAfter: 84_000 } });
    expect(await balanceOf(db, ewallet)).toBe(84_000);
    expect(await db.getFirstAsync('select kind, amount, amount_idr, source, description, occurred_on, account_id from transactions')).toEqual({ kind: 'expense', amount: 16_000, amount_idr: 16_000, source: 'nfc', description: ADJUSTMENT_DESCRIPTION, occurred_on: '2026-11-03', account_id: ewallet });
    expect(await db.getFirstAsync('select c.name, c.kind from transactions t join categories c on c.id = t.category_id')).toEqual({ name: 'Penyesuaian saldo', kind: 'expense' });
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('a card with more than MONO becomes an income', async () => {
    const { db, ewallet } = await linked();
    const result = await recordAdjustment(db, { accountId: ewallet, cardBalance: 130_000, expectedDiff: 30_000, now: NOW });
    expect(result).toMatchObject({ ok: true, value: { kind: 'income', amount: 30_000, balanceAfter: 130_000 } });
    expect(await db.getFirstAsync('select c.name, c.kind from transactions t join categories c on c.id = t.category_id')).toEqual({ name: 'Penyesuaian saldo', kind: 'income' });
  });

  test('it counts as an ordinary expense in the reports, and a transfer is not touched', async () => {
    const { db, ewallet } = await linked();
    await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    expect(await db.getFirstAsync("select expense from v_period_flow where period = '2026-11'")).toEqual({ expense: 16_000 });
    expect(await count(db, "transactions where kind = 'transfer'")).toBe(0);
  });

  test('the same balance records nothing', async () => {
    const { db, ewallet } = await linked();
    expect(await recordAdjustment(db, { accountId: ewallet, cardBalance: 100_000, expectedDiff: 0, now: NOW })).toEqual({ ok: false, reason: 'nothing_to_record' });
    expect(await count(db, 'transactions')).toBe(0);
  });

  test('if the account moved after the screen was drawn, nothing is recorded and the new difference is returned', async () => {
    const { db, ewallet } = await linked();
    await addExpense(db, { accountId: ewallet, currency: 'IDR', categoryId: 1, amount: 5_000, occurredOn: '2026-11-02' }, NOW);
    const result = await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    expect(result).toMatchObject({ ok: false, reason: 'balance_changed', preview: { appBalance: 95_000, diff: -11_000 } });
    expect(await count(db, "transactions where source = 'nfc'")).toBe(0);
  });

  test('Undo takes that very row away and the balance goes back', async () => {
    const { db, ewallet } = await linked();
    const result = await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    const id = (result as { ok: true; value: { transactionId: number } }).value.transactionId;
    expect(await undoAdjustment(db, id)).toBe(true);
    expect(await balanceOf(db, ewallet)).toBe(100_000);
    expect(await count(db, 'transactions')).toBe(0);
    expect(await db.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('the category is made when it is missing (a restored older backup) and reused after', async () => {
    const { db, ewallet } = await linked();
    await db.runAsync("delete from categories where name = 'Penyesuaian saldo'");
    await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    await recordAdjustment(db, { accountId: ewallet, cardBalance: 80_000, expectedDiff: -4_000, now: NOW });
    expect(await count(db, "categories where name = 'Penyesuaian saldo' and kind = 'expense'")).toBe(1);
  });

  test('an archived category is brought back so the adjustment can use it', async () => {
    const { db, ewallet } = await linked();
    await db.runAsync("update categories set archived = 1 where name = 'Penyesuaian saldo' and kind = 'expense'");
    const result = await recordAdjustment(db, { accountId: ewallet, cardBalance: 84_000, expectedDiff: -16_000, now: NOW });
    expect(result.ok).toBe(true);
    expect(await db.getFirstAsync("select archived from categories where name = 'Penyesuaian saldo' and kind = 'expense'")).toEqual({ archived: 0 });
  });

  test('an account that is gone is refused with a message and nothing is written', async () => {
    const { db } = await linked();
    const result = await recordAdjustment(db, { accountId: 9999, cardBalance: 1, expectedDiff: 1, now: NOW });
    expect(result).toMatchObject({ ok: false, reason: 'refused' });
    expect(await count(db, 'transactions')).toBe(0);
  });
});
