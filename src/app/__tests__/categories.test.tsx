// The Categories screens (list, form, archived) drawn from mocked reads and actions. The app's text is
// Indonesian in tests (jest-setup).
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useToastStore } from '@/components/toast-store';
import { undoLabel } from '@/i18n';
import type { ArchivedCategoryRow, CategoryRow } from '@/data/repo/categories';
import type { CategoryOverview, CategoryUsage } from '@/features/categories/categories';
import type { CategoryError } from '@/features/categories/rules';
import { useArchivedCategories, useCategoryActions, useCategoryFormData, useCategoryOverview } from '@/features/categories/useCategories';

import ArchivedCategoriesScreen from '../categories/archived';
import CategoriesScreen from '../categories';
import CategoryEditScreen from '../category/edit';

jest.mock('@/features/categories/useCategories');
const mockOverview = useCategoryOverview as jest.MockedFunction<typeof useCategoryOverview>;
const mockArchived = useArchivedCategories as jest.MockedFunction<typeof useArchivedCategories>;
const mockFormData = useCategoryFormData as jest.MockedFunction<typeof useCategoryFormData>;
const mockActions = useCategoryActions as jest.MockedFunction<typeof useCategoryActions>;

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>;

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: jest.fn() }) as never;

const OVERVIEW: CategoryOverview = {
  expense: [
    { id: 1, name: 'Food & drink', kind: 'expense', icon: 'food', sort_order: 1, has_budget: 1 },
    { id: 2, name: 'Transport', kind: 'expense', icon: 'car', sort_order: 2, has_budget: 0 },
  ],
  income: [{ id: 11, name: 'Salary', kind: 'income', icon: 'wallet', sort_order: 1, has_budget: 0 }],
  archivedCount: 2,
};

const actions = {
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
  restore: jest.fn(),
  canArchive: jest.fn(),
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  actions.create.mockResolvedValue({ ok: true, value: { id: 99 } });
  actions.update.mockResolvedValue({ ok: true, value: undefined });
  actions.archive.mockResolvedValue({ ok: true, value: undefined });
  actions.restore.mockResolvedValue({ ok: true, value: undefined });
  actions.canArchive.mockResolvedValue(null);
  mockActions.mockReturnValue(actions as never);
  await act(async () => useToastStore.getState().dismiss());
});

describe('the list', () => {
  test('sections count only active categories, the budget tag shows, and Transfer is a locked system row', async () => {
    mockOverview.mockReturnValue(query(OVERVIEW));
    const result = await render(wrap(<CategoriesScreen />));
    expect(result.getByText('Pengeluaran, 2')).toBeTruthy();
    expect(result.getByText('Pemasukan, 1')).toBeTruthy();
    expect(result.getByText('Sistem, tidak bisa diubah')).toBeTruthy();
    expect(within(result.getByTestId('category-row-1')).getByText('Ada anggaran')).toBeTruthy();
    expect(within(result.getByTestId('category-row-2')).queryByText('Ada anggaran')).toBeNull();
    expect(result.getByText('Bukan pemasukan, bukan pengeluaran')).toBeTruthy();
    expect(result.getByLabelText('Transfer. Bukan pemasukan, bukan pengeluaran')).toBeTruthy();
  });

  test('a row says what it is and opens the form; the plus opens an empty one', async () => {
    mockOverview.mockReturnValue(query(OVERVIEW));
    const result = await render(wrap(<CategoriesScreen />));
    expect(result.getByLabelText('Food & drink, ada anggaran, ketuk untuk mengubah')).toBeTruthy();
    expect(result.getByLabelText('Transport, ketuk untuk mengubah')).toBeTruthy();
    await fireEvent.press(result.getByTestId('category-row-2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/category/edit', params: { id: '2' } });
    await fireEvent.press(result.getByTestId('categories-add'));
    expect(mockPush).toHaveBeenCalledWith('/category/edit');
  });

  test('the archived row shows the count and opens the archived list', async () => {
    mockOverview.mockReturnValue(query(OVERVIEW));
    const result = await render(wrap(<CategoriesScreen />));
    expect(result.getByText('Diarsipkan, 2')).toBeTruthy();
    await fireEvent.press(result.getByTestId('categories-archived-row'));
    expect(mockPush).toHaveBeenCalledWith('/categories/archived');
  });

  test('with nothing archived the row is not there', async () => {
    mockOverview.mockReturnValue(query({ ...OVERVIEW, archivedCount: 0 }));
    const result = await render(wrap(<CategoriesScreen />));
    expect(result.queryByTestId('categories-archived-row')).toBeNull();
  });
});

const ALL: CategoryRow[] = [
  { id: 1, name: 'Food & drink', kind: 'expense', icon: 'food', sort_order: 1, archived: 0 },
  { id: 2, name: 'Transport', kind: 'expense', icon: 'car', sort_order: 2, archived: 0 },
  { id: 3, name: 'Coffee', kind: 'expense', icon: 'coffee', sort_order: 3, archived: 1 },
  { id: 11, name: 'Salary', kind: 'income', icon: 'wallet', sort_order: 1, archived: 0 },
];
const USAGE: CategoryUsage = { transactionCount: 24, lastUsedOn: '2026-10-26', hasBudgetThisMonth: true, budgetCount: 1, recurringCount: 0, kindLocked: true };

function formData(category: CategoryRow | null, usage: CategoryUsage | null) {
  mockFormData.mockReturnValue(query({ all: ALL, category, usage }));
}

describe('the form for a new category', () => {
  beforeEach(() => formData(null, null));

  test('Save is off until the name is valid, the count and preview follow the name', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    expect(result.getByText('Kategori baru')).toBeTruthy();
    expect(result.getByText('0/40')).toBeTruthy();
    expect(result.getByText('Nama kategori')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Simpan kategori' }).props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(result.getByTestId('category-name-input'), 'Kopi');
    expect(result.getByText('4/40')).toBeTruthy();
    expect(within(result.getByTestId('category-preview')).getByText('Kopi')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Simpan kategori' }).props.accessibilityState).toMatchObject({ disabled: false });
  });

  test('a name an active category has is refused with the sentence and the border', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'transport');
    expect(result.getByText('Nama ini sudah dipakai di Pengeluaran. Pakai nama lain.')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Simpan kategori' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('a name an archived category has says to restore it first', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'COFFEE');
    expect(result.getByText('Nama ini dipakai kategori yang diarsipkan. Pulihkan dulu atau pakai nama lain.')).toBeTruthy();
  });

  test('the same name in the other type is fine', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-kind-income'));
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'Transport');
    expect(result.queryByText(/Nama ini sudah dipakai/)).toBeNull();
  });

  test('the icon grid has twenty named icons and the picked one is announced as selected', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    const grid = within(result.getByTestId('category-icons'));
    expect(grid.getAllByRole('button')).toHaveLength(20);
    expect(grid.getByLabelText('Label, dipilih')).toBeTruthy(); // the default is the tag icon
    await fireEvent.press(result.getByTestId('category-icon-coffee'));
    expect(grid.getByLabelText('Kopi, dipilih')).toBeTruthy();
    expect(grid.getByLabelText('Label')).toBeTruthy();
  });

  test('saving creates the category with the chosen type, name and icon, then goes back with a toast', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-kind-income'));
    await fireEvent.changeText(result.getByTestId('category-name-input'), '  Bonus ');
    await fireEvent.press(result.getByTestId('category-icon-wallet'));
    await fireEvent.press(result.getByTestId('category-save'));
    expect(actions.create).toHaveBeenCalledWith({ kind: 'income', name: '  Bonus ', icon: 'wallet' });
    expect(mockBack).toHaveBeenCalled();
    expect(useToastStore.getState().message).toBe('Kategori tersimpan.');
  });

  test('closing with unsaved input asks first; Lanjut mengubah stays, Buang leaves', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-close'));
    expect(mockBack).toHaveBeenCalledTimes(1); // nothing typed: leaves at once

    mockBack.mockClear();
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'Kopi');
    await fireEvent.press(result.getByTestId('category-cancel'));
    expect(result.getByText('Buang perubahan?')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await fireEvent.press(result.getByTestId('category-discard-cancel'));
    expect(result.queryByText('Buang perubahan?')).toBeNull();

    await fireEvent.press(result.getByTestId('category-close'));
    await fireEvent.press(result.getByTestId('category-discard-confirm'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('a refusal that comes back from saving shows under the name', async () => {
    actions.create.mockResolvedValue({ ok: false, error: { code: 'name_taken', kind: 'expense' } satisfies CategoryError });
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'Kopi');
    await fireEvent.press(result.getByTestId('category-save'));
    expect(result.getByText('Nama ini sudah dipakai di Pengeluaran. Pakai nama lain.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('the form for an existing category', () => {
  const FOOD = ALL[0];
  beforeEach(() => {
    mockParams = { id: '1' };
    formData(FOOD, USAGE);
  });

  test('the type is locked with the reason, and the usage card shows the numbers', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    expect(result.getByText('Ubah kategori')).toBeTruthy();
    expect(result.getByText('Jenis tidak bisa diubah karena sudah dipakai di 24 transaksi.')).toBeTruthy();
    expect(result.getByLabelText('Pengeluaran, terkunci')).toBeTruthy();
    expect(result.getByTestId('category-kind-income').props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByText('Mengganti nama memperbarui transaksi lama dan laporan.')).toBeTruthy();
    const usage = within(result.getByTestId('category-usage'));
    expect(usage.getByText('24')).toBeTruthy();
    expect(usage.getByText('26 Oct 2026')).toBeTruthy();
    expect(usage.getByText('Ada')).toBeTruthy();
  });

  test('a category nothing uses can still change type, and has no lock note', async () => {
    formData(FOOD, { ...USAGE, transactionCount: 0, lastUsedOn: null, hasBudgetThisMonth: false, budgetCount: 0, kindLocked: false });
    const result = await render(wrap(<CategoryEditScreen />));
    expect(result.queryByTestId('category-kind-locked-note')).toBeNull();
    expect(result.getByText('Belum pernah')).toBeTruthy();
    expect(result.getByText('Tidak ada')).toBeTruthy();
    await fireEvent.press(result.getByTestId('category-kind-income'));
    await fireEvent.press(result.getByTestId('category-save'));
    expect(actions.update).toHaveBeenCalledWith(1, { name: 'Food & drink', icon: 'food', kind: 'income' });
  });

  test('Save stays off until something changes, and its own name is not a clash', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    expect(result.getByRole('button', { name: 'Simpan kategori' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'FOOD & DRINK');
    expect(result.queryByText(/Nama ini sudah dipakai/)).toBeNull();
    await fireEvent.changeText(result.getByTestId('category-name-input'), 'Makan');
    await fireEvent.press(result.getByTestId('category-save'));
    expect(actions.update).toHaveBeenCalledWith(1, { name: 'Makan', icon: 'food', kind: undefined });
  });

  test('Arsipkan kategori explains what happens, then archives, goes back and offers Urungkan', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-archive'));
    await act(async () => {});
    expect(result.getByText('Arsipkan Food & drink?')).toBeTruthy();
    expect(result.getByText(/24 transaksi lama dan laporan tetap utuh/)).toBeTruthy();
    expect(result.getByText(/Kamu bisa memulihkannya kapan saja dari Kategori → Diarsipkan\./)).toBeTruthy();

    await fireEvent.press(result.getByTestId('category-archive-dialog-confirm'));
    await act(async () => {});
    expect(actions.archive).toHaveBeenCalledWith(1);
    expect(mockBack).toHaveBeenCalled();
    const toast = useToastStore.getState();
    expect(toast.message).toBe('Kategori diarsipkan.');
    expect(toast.actionLabel).toBe(undoLabel());
    await act(async () => toast.onAction?.());
    expect(actions.restore).toHaveBeenCalledWith(1);
  });

  test('Batal on the archive dialog changes nothing', async () => {
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-archive'));
    await act(async () => {});
    await fireEvent.press(result.getByTestId('category-archive-dialog-cancel'));
    expect(result.queryByText('Arsipkan Food & drink?')).toBeNull();
    expect(actions.archive).not.toHaveBeenCalled();
  });

  test('a refused archive explains why in a notice with one button', async () => {
    actions.canArchive.mockResolvedValue({ code: 'last_active', kind: 'expense' } satisfies CategoryError);
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-archive'));
    await act(async () => {});
    expect(result.getByText('Belum bisa diarsipkan')).toBeTruthy();
    expect(result.getByText('Harus ada minimal satu kategori pengeluaran aktif. Tambah kategori lain dulu, lalu arsipkan yang ini.')).toBeTruthy();
    expect(result.queryByTestId('category-blocked-dialog-cancel')).toBeNull();
    expect(result.queryByText('Arsipkan Food & drink?')).toBeNull();
    await fireEvent.press(result.getByTestId('category-blocked-dialog-confirm'));
    expect(result.queryByText('Belum bisa diarsipkan')).toBeNull();
  });

  test('a category an active fixed expense uses names it in the notice', async () => {
    actions.canArchive.mockResolvedValue({ code: 'used_by_recurring', recurringName: 'Gym membership' } satisfies CategoryError);
    const result = await render(wrap(<CategoryEditScreen />));
    await fireEvent.press(result.getByTestId('category-archive'));
    await act(async () => {});
    expect(result.getByText('Dipakai pengeluaran tetap Gym membership. Ganti kategorinya dulu.')).toBeTruthy();
  });
});

const ARCHIVED: ArchivedCategoryRow[] = [
  { id: 3, name: 'Education', kind: 'expense', icon: 'book', transaction_count: 8, last_used_on: '2026-08-03' },
  { id: 4, name: 'Gifts', kind: 'expense', icon: 'gift', transaction_count: 0, last_used_on: null },
  { id: 12, name: 'Freelance', kind: 'income', icon: 'briefcase', transaction_count: 3, last_used_on: '2026-08-21' },
];

describe('the archived list', () => {
  test('groups by type with counts, the last use, a restore button per row and the never-deleted note', async () => {
    mockArchived.mockReturnValue(query(ARCHIVED));
    const result = await render(wrap(<ArchivedCategoriesScreen />));
    expect(result.getByText('Diarsipkan')).toBeTruthy();
    expect(result.getByText('Pengeluaran, 2')).toBeTruthy();
    expect(result.getByText('Pemasukan, 1')).toBeTruthy();
    expect(result.getByText('8 transaksi · 3 Aug 2026')).toBeTruthy();
    expect(result.getByText('0 transaksi')).toBeTruthy();
    expect(result.getByLabelText('Pulihkan Education')).toBeTruthy();
    expect(result.getByText('Kategori tidak pernah dihapus, hanya diarsipkan, supaya riwayatmu tidak berubah.')).toBeTruthy();
  });

  test('Pulihkan restores at once (no dialog) and says so', async () => {
    mockArchived.mockReturnValue(query(ARCHIVED));
    const result = await render(wrap(<ArchivedCategoriesScreen />));
    await fireEvent.press(result.getByTestId('archived-restore-3'));
    await act(async () => {});
    expect(actions.restore).toHaveBeenCalledWith(3);
    expect(useToastStore.getState().message).toBe('Kategori dipulihkan.');
  });

  test('an empty list goes back to the main list by itself', async () => {
    mockArchived.mockReturnValue(query([]));
    await render(wrap(<ArchivedCategoriesScreen />));
    expect(mockBack).toHaveBeenCalled();
  });
});
