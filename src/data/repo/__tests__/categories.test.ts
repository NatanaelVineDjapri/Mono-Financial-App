import { openTestDb } from '../../db/openTestDb';
import { archiveCategory, createCategory, listCategories } from '../categories';

describe('categories repo', () => {
  test('the seed already has 10 expense and 4 income categories', async () => {
    const db = openTestDb();
    expect((await listCategories(db, { kind: 'expense' })).length).toBe(10);
    expect((await listCategories(db, { kind: 'income' })).length).toBe(4);
  });

  test('create and archive a category', async () => {
    const db = openTestDb();
    const id = await createCategory(db, { name: 'Pets', kind: 'expense' });
    expect((await listCategories(db, { kind: 'expense' })).some(c => c.id === id)).toBe(true);

    await archiveCategory(db, id);
    expect((await listCategories(db, { kind: 'expense' })).some(c => c.id === id)).toBe(false);
    expect((await listCategories(db, { kind: 'expense', includeArchived: true })).some(c => c.id === id)).toBe(true);
  });
});
