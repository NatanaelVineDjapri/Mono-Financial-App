// Managing the sub-categories of a category on its edit screen, against a real database: add, the name rules in words, rename,
// archive and restore, delete only when nothing uses it.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { saveNewTransaction } from '@/core/tx/save';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { listCategories } from '@/data/repo/categories';
import { createAccount } from '@/domain/accounts';

import { SubcategoriesSection } from '../SubcategoriesSection';
import { createSubcategory, listForCategory } from '../subcategories';

let mockDb: Db;
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));

const NOW = '2026-11-03T10:00:00+07:00';

async function setup() {
  mockDb = await openMigratedTestDb();
  const account = await createAccount(mockDb, { name: 'BCA', type: 'bank', openingBalance: 1_000_000, openingDate: '2026-01-01' }, NOW);
  const food = (await listCategories(mockDb)).find(c => c.name === 'Food & drink')!.id;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <SubcategoriesSection categoryId={food} />
    </QueryClientProvider>,
  );
  const refresh = () => act(async () => { await queryClient.invalidateQueries(); });
  return { view, account, food, refresh };
}

const names = async (food: number) => (await listForCategory(mockDb, food)).map(s => [s.name, s.archived]);

describe('SubcategoriesSection', () => {
  test('says there are none yet, and explains what they are', async () => {
    const { view } = await setup();
    await waitFor(() => expect(view.getByTestId('subcategories-empty')).toBeTruthy());
    expect(view.getByText(/Sub-categories|Sub-kategori/)).toBeTruthy();
  });

  test('adds one, and the input empties', async () => {
    const { view, food } = await setup();
    await fireEvent.changeText(view.getByTestId('subcategory-new-name-input'), '  Sendiri ');
    await fireEvent.press(view.getByTestId('subcategory-add'));
    await waitFor(() => expect(view.getByTestId('subcategory-open-1')).toBeTruthy());
    expect(await names(food)).toEqual([['Sendiri', 0]]);
    expect(view.getByTestId('subcategory-new-name-input').props.value).toBe('');
  });

  test('the same name again is refused in words, and nothing is added', async () => {
    const { view, food } = await setup();
    await createSubcategory(mockDb, food, 'Sendiri');
    await fireEvent.changeText(view.getByTestId('subcategory-new-name-input'), 'sendiri');
    await fireEvent.press(view.getByTestId('subcategory-add'));
    await waitFor(() => expect(view.getByText(/already has a sub-category|sudah punya sub-kategori/)).toBeTruthy());
    expect(await names(food)).toEqual([['Sendiri', 0]]);
  });

  test('Add is off until something is typed', async () => {
    const { view } = await setup();
    expect(view.getByTestId('subcategory-add').props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('rename, archive and restore', async () => {
    const { view, food, refresh } = await setup();
    const sub = await createSubcategory(mockDb, food, 'Sendiri');
    const id = (sub as { value: number }).value;
    await refresh();
    await waitFor(() => expect(view.getByTestId(`subcategory-open-${id}`)).toBeTruthy());

    await fireEvent.press(view.getByTestId(`subcategory-open-${id}`));
    await fireEvent.changeText(view.getByTestId(`subcategory-name-${id}-input`), 'Solo');
    await fireEvent.press(view.getByTestId(`subcategory-save-${id}`));
    await waitFor(async () => expect(await names(food)).toEqual([['Solo', 0]]));

    await fireEvent.press(view.getByTestId(`subcategory-open-${id}`));
    await fireEvent.press(view.getByTestId(`subcategory-archive-${id}`));
    await waitFor(async () => expect(await names(food)).toEqual([['Solo', 1]]));

    await fireEvent.press(view.getByTestId(`subcategory-open-${id}`));
    await fireEvent.press(view.getByTestId(`subcategory-restore-${id}`));
    await waitFor(async () => expect(await names(food)).toEqual([['Solo', 0]]));
  });

  test('an unused one can be deleted; a used one has no Delete, only Archive', async () => {
    const { view, food, account, refresh } = await setup();
    const unused = (await createSubcategory(mockDb, food, 'Kosong')) as { value: number };
    const used = (await createSubcategory(mockDb, food, 'Dipakai')) as { value: number };
    await saveNewTransaction(mockDb, { type: 'expense', amount: 10_000, categoryId: food, subcategoryId: used.value, accountId: account, toAccountId: null, date: '2026-11-02', description: 'x', note: '' }, NOW);
    await refresh();
    await waitFor(() => expect(view.getByTestId(`subcategory-open-${used.value}`)).toBeTruthy());

    await fireEvent.press(view.getByTestId(`subcategory-open-${used.value}`));
    expect(view.queryByTestId(`subcategory-delete-${used.value}`)).toBeNull();
    expect(view.getByTestId(`subcategory-archive-${used.value}`)).toBeTruthy();

    await fireEvent.press(view.getByTestId(`subcategory-open-${unused.value}`));
    await fireEvent.press(view.getByTestId(`subcategory-delete-${unused.value}`));
    await act(async () => {});
    await waitFor(async () => expect(await names(food)).toEqual([['Dipakai', 0]]));
  });
});
