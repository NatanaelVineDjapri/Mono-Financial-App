import { suggestFromDescription, type DescriptionUse, type SuggestSource } from './suggest';

const source = (history: DescriptionUse[] = []): SuggestSource => ({
  categories: [
    { id: 1, name: 'Makanan', kind: 'expense' },
    { id: 2, name: 'Minuman', kind: 'expense' },
    { id: 3, name: 'Gaji', kind: 'income' },
  ],
  subcategories: [
    { id: 10, categoryId: 2, name: 'Kopi' },
    { id: 11, categoryId: 2, name: 'Susu' },
    { id: 12, categoryId: 1, name: 'Pacaran' },
  ],
  history,
});
const use = (description: string, categoryId: number, subcategoryId: number | null, uses = 1, lastOn = '2026-11-01'): DescriptionUse => ({ description, kind: 'expense', categoryId, subcategoryId, uses, lastOn });

test('the same words go where they went most often, then latest', () => {
  expect(suggestFromDescription(' Nasi  Padang ', 'expense', source([use('nasi padang', 1, 12, 1), use('Nasi Padang', 1, null, 3)]))).toEqual({ categoryId: 1, subcategoryId: null });
  expect(suggestFromDescription('boba', 'expense', source([use('boba', 1, null, 2, '2026-10-01'), use('boba', 2, 11, 2, '2026-11-20')]))).toEqual({ categoryId: 2, subcategoryId: 11 });
});

test('without history, a sub-category or category named in the words; never a guess between two', () => {
  expect(suggestFromDescription('beli kopi', 'expense', source())).toEqual({ categoryId: 2, subcategoryId: 10 });
  expect(suggestFromDescription('makanan kucing', 'expense', source())).toEqual({ categoryId: 1, subcategoryId: null });
  expect(suggestFromDescription('kopi susu', 'expense', source())).toBeNull();
  expect(suggestFromDescription('ngopi', 'expense', source())).toBeNull();
});

test('only the chosen kind, only categories that can still be used, nothing for a short or unknown text', () => {
  expect(suggestFromDescription('beli kopi', 'income', source())).toBeNull();
  expect(suggestFromDescription('lama', 'expense', source([use('lama', 99, null, 5)]))).toBeNull();
  expect(suggestFromDescription('parkir', 'expense', source([use('parkir', 1, 999, 2)]))).toEqual({ categoryId: 1, subcategoryId: null });
  expect(suggestFromDescription('k', 'expense', source())).toBeNull();
});
