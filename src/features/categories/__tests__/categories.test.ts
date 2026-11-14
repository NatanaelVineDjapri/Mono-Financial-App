// The categories domain against the real schema brought up to date by the real migrations: the
// rules in CLAUDE.md rule 21 (never deleted, one active per kind, kind locked once used, archived
// ones leave the pickers and are not carried into next month's budgets).
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { listCategories, type CategoryKind } from '@/data/repo/categories';
import { createAccount } from '@/domain/accounts';
import { createBudget, ensureMonth, setMonthlyLimit } from '@/domain/budget';
import { archiveRecurring, createRecurring } from '@/domain/recurring';
import { getTxFormData } from '@/domain/txForm';
import { buildRequest } from '@/features/ai_chat/prompt';

import { archiveCategory, checkArchivable, createCategory, getCategoryOverview, getUsage, listArchived, restoreCategory, updateCategory } from '../categories';

const NOW = '2026-11-14T10:00:00+07:00';

async function fixture() {
  const db = await openMigratedTestDb();
  const accountId = await createAccount(db, { name: 'BCA', type: 'bank', openingBalance: 5000000, openingDate: '2026-01-01' }, NOW);
  return { db, accountId };
}

async function categoryId(db: Db, kind: CategoryKind, name: string): Promise<number> {
  const row = (await listCategories(db, { kind, includeArchived: true })).find(c => c.name === name);
  if (!row) throw new Error(`no ${kind} category ${name}`);
  return row.id;
}

async function insertExpense(db: Db, accountId: number, catId: number, date = '2026-10-01'): Promise<number> {
  const result = await db.runAsync(
    `insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, created_at, updated_at)
     values ('expense', ?, 'IDR', ?, 1000, 1000, ?, ?, ?)`,
    [accountId, catId, date, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe('the seeded icons', () => {
  test('migration 7 -> 8 gives every seeded category an icon key from the registry', async () => {
    const { db } = await fixture();
    const rows = await listCategories(db, { includeArchived: true });
    expect(rows.every(r => r.icon)).toBe(true);
    const byName = Object.fromEntries(rows.map(r => [r.name, r.icon]));
    expect(byName).toMatchObject({ 'Food & drink': 'food', Transport: 'car', Shopping: 'bag', Bills: 'bolt', Health: 'heart', Leisure: 'film', Housing: 'home', Education: 'book', Gifts: 'gift', Other: 'dot' });
  });
});

describe('createCategory', () => {
  test('a new category goes at the end of its kind and starts on the tag icon', async () => {
    const { db } = await fixture();
    const result = await createCategory(db, { kind: 'expense', name: '  Kopi ' });
    expect(result.ok).toBe(true);
    const rows = await listCategories(db, { kind: 'expense' });
    const created = rows[rows.length - 1];
    expect(created).toMatchObject({ name: 'Kopi', kind: 'expense', icon: 'tag', archived: 0 });
    expect(created.sort_order).toBe(Math.max(...rows.map(r => r.sort_order)));
    expect(rows.filter(r => r.sort_order === created.sort_order)).toHaveLength(1);
  });

  test('income categories keep their own order', async () => {
    const { db } = await fixture();
    await createCategory(db, { kind: 'income', name: 'Bonus', icon: 'wallet' });
    const rows = await listCategories(db, { kind: 'income' });
    expect(rows[rows.length - 1]).toMatchObject({ name: 'Bonus', sort_order: 5, icon: 'wallet' });
  });

  test('a duplicate name is refused per kind, ignoring case, and an archived one has its own reason', async () => {
    const { db } = await fixture();
    expect(await createCategory(db, { kind: 'expense', name: 'transport' })).toEqual({ ok: false, error: { code: 'name_taken', kind: 'expense' } });
    expect((await createCategory(db, { kind: 'income', name: 'Transport' })).ok).toBe(true);
    await archiveCategory(db, await categoryId(db, 'expense', 'Gifts'));
    expect(await createCategory(db, { kind: 'expense', name: 'GIFTS' })).toEqual({ ok: false, error: { code: 'name_taken_archived', kind: 'expense' } });
  });

  test('empty and 41-character names are refused before the database', async () => {
    const { db } = await fixture();
    expect(await createCategory(db, { kind: 'expense', name: '   ' })).toEqual({ ok: false, error: { code: 'name_empty' } });
    expect(await createCategory(db, { kind: 'expense', name: 'x'.repeat(41) })).toEqual({ ok: false, error: { code: 'name_too_long' } });
  });

  test('an unknown icon key is stored as the dot fallback', async () => {
    const { db } = await fixture();
    await createCategory(db, { kind: 'expense', name: 'Aneh', icon: 'rocket' });
    expect((await listCategories(db, { kind: 'expense' })).find(c => c.name === 'Aneh')?.icon).toBe('dot');
  });
});

describe('updateCategory and the locked kind', () => {
  test('renaming and changing the icon work, and renaming to its own name is fine', async () => {
    const { db } = await fixture();
    const id = await categoryId(db, 'expense', 'Leisure');
    expect((await updateCategory(db, id, { name: 'Hiburan', icon: 'film' }, NOW)).ok).toBe(true);
    expect((await updateCategory(db, id, { name: 'hiburan', icon: 'coffee' }, NOW)).ok).toBe(true);
    expect((await listCategories(db)).find(c => c.id === id)).toMatchObject({ name: 'hiburan', icon: 'coffee' });
  });

  test('a rename that clashes with another category is refused', async () => {
    const { db } = await fixture();
    const id = await categoryId(db, 'expense', 'Leisure');
    expect(await updateCategory(db, id, { name: 'bills', icon: 'film' }, NOW)).toEqual({ ok: false, error: { code: 'name_taken', kind: 'expense' } });
  });

  test('the kind of a category nobody uses can change', async () => {
    const { db } = await fixture();
    const created = await createCategory(db, { kind: 'expense', name: 'Ragu' });
    if (!created.ok) throw new Error('create failed');
    expect((await updateCategory(db, created.value.id, { name: 'Ragu', icon: 'tag', kind: 'income' }, NOW)).ok).toBe(true);
    expect((await listCategories(db, { kind: 'income' })).some(c => c.name === 'Ragu')).toBe(true);
  });

  test('the kind is locked once a transaction uses the category', async () => {
    const { db, accountId } = await fixture();
    const id = await categoryId(db, 'expense', 'Leisure');
    await insertExpense(db, accountId, id);
    expect(await updateCategory(db, id, { name: 'Leisure', icon: 'film', kind: 'income' }, NOW)).toEqual({ ok: false, error: { code: 'kind_locked' } });
    // the name and icon still change
    expect((await updateCategory(db, id, { name: 'Leisure 2', icon: 'film' }, NOW)).ok).toBe(true);
  });

  test('the kind is locked by a budget alone, and by a fixed expense alone', async () => {
    const { db, accountId } = await fixture();
    const budgeted = await categoryId(db, 'expense', 'Health');
    await setMonthlyLimit(db, '2026-11', 1000000);
    await createBudget(db, { categoryId: budgeted, month: '2026-11', limitAmount: 100000 });
    expect((await getUsage(db, budgeted, NOW)).kindLocked).toBe(true);

    const templated = await categoryId(db, 'expense', 'Bills');
    await createRecurring(db, { name: 'Internet', amount: 385000, accountId, categoryId: templated, dayOfMonth: 5, firstDueOn: '2026-11-05' }, NOW);
    expect((await getUsage(db, templated, NOW)).kindLocked).toBe(true);
  });

  test('the database refuses a kind change on a used category even if the domain check is skipped', async () => {
    const { db, accountId } = await fixture();
    const id = await categoryId(db, 'expense', 'Leisure');
    await insertExpense(db, accountId, id);
    await expect(db.runAsync("update categories set kind = 'income' where id = ?", [id])).rejects.toThrow(/category_kind_locked/);
  });
});

describe('archive and restore', () => {
  test('a category is archived and restored, never deleted', async () => {
    const { db } = await fixture();
    const id = await categoryId(db, 'expense', 'Gifts');
    expect(await archiveCategory(db, id)).toEqual({ ok: true, value: undefined });
    expect((await listCategories(db, { kind: 'expense' })).some(c => c.id === id)).toBe(false);
    expect((await listCategories(db, { kind: 'expense', includeArchived: true })).some(c => c.id === id)).toBe(true);
    expect(await restoreCategory(db, id)).toEqual({ ok: true, value: undefined });
    expect((await listCategories(db, { kind: 'expense' })).some(c => c.id === id)).toBe(true);
  });

  test('the last active category of a kind cannot be archived, for either kind', async () => {
    const { db } = await fixture();
    for (const kind of ['expense', 'income'] as const) {
      const rows = await listCategories(db, { kind });
      for (const row of rows.slice(1)) expect((await archiveCategory(db, row.id)).ok).toBe(true);
      expect(await archiveCategory(db, rows[0].id)).toEqual({ ok: false, error: { code: 'last_active', kind } });
      expect(await checkArchivable(db, rows[0].id)).toEqual({ code: 'last_active', kind });
    }
  });

  test('the database refuses to archive the last active category too', async () => {
    const { db } = await fixture();
    const rows = await listCategories(db, { kind: 'income' });
    for (const row of rows.slice(1)) await db.runAsync('update categories set archived = 1 where id = ?', [row.id]);
    await expect(db.runAsync('update categories set archived = 1 where id = ?', [rows[0].id])).rejects.toThrow(/last_active_category/);
  });

  test('a category used by an active fixed expense cannot be archived, and the reason names it', async () => {
    const { db, accountId } = await fixture();
    const id = await categoryId(db, 'expense', 'Bills');
    const recurringId = await createRecurring(db, { name: 'Internet', amount: 385000, accountId, categoryId: id, dayOfMonth: 5, firstDueOn: '2026-11-05' }, NOW);
    expect(await archiveCategory(db, id)).toEqual({ ok: false, error: { code: 'used_by_recurring', recurringName: 'Internet' } });
    await expect(db.runAsync('update categories set archived = 1 where id = ?', [id])).rejects.toThrow(/category_in_active_recurring/);

    // once the template is stopped the category can go
    await archiveRecurring(db, recurringId);
    expect((await archiveCategory(db, id)).ok).toBe(true);
  });

  test('a restore (guards off) bypasses the database guards', async () => {
    const { db } = await fixture();
    const rows = await listCategories(db, { kind: 'income' });
    await db.runAsync("update meta set value = '1' where key = 'guards_off'");
    for (const row of rows) await db.runAsync('update categories set archived = 1 where id = ?', [row.id]);
    await db.runAsync("update meta set value = '0' where key = 'guards_off'");
    expect(await listCategories(db, { kind: 'income' })).toHaveLength(0);
  });

  test('archiving keeps the old transactions and their category', async () => {
    const { db, accountId } = await fixture();
    const id = await categoryId(db, 'expense', 'Gifts');
    const txId = await insertExpense(db, accountId, id);
    await archiveCategory(db, id);
    expect(await db.getFirstAsync('select category_id from transactions where id = ?', [txId])).toEqual({ category_id: id });
    expect((await listArchived(db)).find(r => r.id === id)).toMatchObject({ name: 'Gifts', transaction_count: 1, last_used_on: '2026-10-01' });
  });
});

describe('the lists', () => {
  test('the overview counts only active categories and says how many are archived', async () => {
    const { db } = await fixture();
    expect(await getCategoryOverview(db, NOW)).toMatchObject({ archivedCount: 0 });
    const before = await getCategoryOverview(db, NOW);
    expect([before.expense.length, before.income.length]).toEqual([10, 4]);

    await archiveCategory(db, await categoryId(db, 'expense', 'Gifts'));
    await archiveCategory(db, await categoryId(db, 'income', 'Freelance'));
    const after = await getCategoryOverview(db, NOW);
    expect([after.expense.length, after.income.length, after.archivedCount]).toEqual([9, 3, 2]);
    expect(after.expense.some(r => r.name === 'Gifts')).toBe(false);
  });

  test('a category with a budget this month carries the flag', async () => {
    const { db } = await fixture();
    await setMonthlyLimit(db, '2026-11', 1000000);
    await createBudget(db, { categoryId: await categoryId(db, 'expense', 'Leisure'), month: '2026-11', limitAmount: 100000 });
    const overview = await getCategoryOverview(db, NOW);
    expect(overview.expense.filter(r => r.has_budget === 1).map(r => r.name)).toEqual(['Leisure']);
  });

  test('usage reports transactions, the last day used, and this month\'s budget', async () => {
    const { db, accountId } = await fixture();
    const id = await categoryId(db, 'expense', 'Food & drink');
    expect(await getUsage(db, id, NOW)).toMatchObject({ transactionCount: 0, lastUsedOn: null, hasBudgetThisMonth: false, kindLocked: false });
    await insertExpense(db, accountId, id, '2026-10-01');
    await insertExpense(db, accountId, id, '2026-11-02');
    expect(await getUsage(db, id, NOW)).toMatchObject({ transactionCount: 2, lastUsedOn: '2026-11-02', kindLocked: true });
  });
});

describe('budgets and archived categories', () => {
  test('ensureMonth does not copy the budget of an archived category into the next month', async () => {
    const { db } = await fixture();
    const food = await categoryId(db, 'expense', 'Food & drink');
    const leisure = await categoryId(db, 'expense', 'Leisure');
    await setMonthlyLimit(db, '2026-10', 2000000);
    await createBudget(db, { categoryId: food, month: '2026-10', limitAmount: 500000 });
    await createBudget(db, { categoryId: leisure, month: '2026-10', limitAmount: 300000 });

    await archiveCategory(db, leisure);
    expect(await ensureMonth(db, '2026-11')).toBe(true);

    const nextMonth = await db.getAllAsync<{ category_id: number }>("select category_id from budgets where month = '2026-11'");
    expect(nextMonth.map(b => b.category_id)).toEqual([food]);
    // this month's data stays
    const thisMonth = await db.getAllAsync<{ category_id: number }>("select category_id from budgets where month = '2026-10' order by category_id");
    expect(thisMonth.map(b => b.category_id).sort()).toEqual([food, leisure].sort());
  });
});

describe('what the pickers and the AI see', () => {
  test('a new transaction is offered active categories only', async () => {
    const { db } = await fixture();
    await archiveCategory(db, await categoryId(db, 'expense', 'Gifts'));
    const data = await getTxFormData(db);
    expect(data.categories.some(c => c.name === 'Gifts')).toBe(false);
    expect(data.categories.some(c => c.name === 'Food & drink')).toBe(true);
  });

  test('editing an old transaction still shows its archived category, and only that one', async () => {
    const { db, accountId } = await fixture();
    const gifts = await categoryId(db, 'expense', 'Gifts');
    const txId = await insertExpense(db, accountId, gifts);
    await archiveCategory(db, gifts);
    await archiveCategory(db, await categoryId(db, 'expense', 'Housing'));

    const data = await getTxFormData(db, txId);
    expect(data.categories.some(c => c.id === gifts)).toBe(true);
    expect(data.categories.some(c => c.name === 'Housing')).toBe(false);
    expect(data.record?.categoryId).toBe(gifts);
  });

  test('the category names sent to the AI leave out archived ones', async () => {
    const { db, accountId } = await fixture();
    await archiveCategory(db, await categoryId(db, 'expense', 'Gifts'));
    const data = await getTxFormData(db);
    const request = buildRequest('makan 25rb', { today: '2026-11-14', accounts: data.accounts.map(a => ({ name: a.name, type: a.type })), categories: data.categories });
    const sent = request.contents[0].parts[0].text;
    expect(sent).toContain('Food & drink');
    expect(sent).not.toContain('Gifts');
    expect(accountId).toBeGreaterThan(0);
  });
});
