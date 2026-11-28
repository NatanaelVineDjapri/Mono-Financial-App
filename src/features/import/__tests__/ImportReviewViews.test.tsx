// The review queue (Tinjau) and the check screen (Periksa), drawn from plain props. Nothing here saves: the
// callbacks are the only way out, and they are what the route wires to the domain.
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { QueueRowWithNames } from '@/data/repo/importQueue';
import type { TxFormData } from '@/domain/txForm';

import { txKindLabel } from '@/i18n';

import { ImportEditView } from '../ImportEditView';
import { ImportReviewView } from '../ImportReviewView';

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const row = (over: Partial<QueueRowWithNames>): QueueRowWithNames => ({
  id: 1,
  package: 'com.example.bank',
  app_name: 'Example Bank',
  account_id: 1,
  kind: 'expense',
  amount_idr: 25000,
  merchant: 'Kopi Kenangan',
  category_id: 10,
  guessed: 1,
  occurred_at: '2026-11-03T09:30:00+07:00',
  fingerprint: 'x',
  status: 'pending',
  created_at: '2026-11-03T10:00:00+07:00',
  account_name: 'BCA Tabungan',
  category_name: 'Food & drink',
  ...over,
});

const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>;

describe('Tinjau: the list', () => {
  const handlers = () => ({ onBack: jest.fn(), onOpen: jest.fn(), onSaveAll: jest.fn() });

  test('an empty queue says so and offers no bulk save', async () => {
    const h = handlers();
    const view = await render(wrap(<ImportReviewView items={[]} saving={false} {...h} />));
    expect(view.getByTestId('import-review-empty')).toBeTruthy();
    expect(view.queryByTestId('import-save-all')).toBeNull();
  });

  test('a card shows what was read, tagged Ditebak, and opens on tap', async () => {
    const h = handlers();
    const view = await render(wrap(<ImportReviewView items={[row({})]} saving={false} {...h} />));
    expect(view.getByText('Kopi Kenangan')).toBeTruthy();
    expect(view.getByTestId('import-guessed-1')).toBeTruthy();
    expect(view.queryByTestId('import-check-1')).toBeNull();
    expect(view.getByText('Food & drink')).toBeTruthy();
    await fireEvent.press(view.getByTestId('import-card-1'));
    expect(h.onOpen).toHaveBeenCalledWith(1);
  });

  test('an unclear kind is flagged Perlu dicek and a missing category asks to choose one', async () => {
    const h = handlers();
    const view = await render(wrap(<ImportReviewView items={[row({ id: 2, kind: null, category_id: null, category_name: null })]} saving={false} {...h} />));
    expect(view.getByTestId('import-check-2')).toBeTruthy();
    expect(view.getByText('Pilih kategori')).toBeTruthy();
  });

  test('Simpan N yang lengkap counts only the cards with a kind and a category', async () => {
    const h = handlers();
    const items = [row({ id: 1 }), row({ id: 2, kind: null }), row({ id: 3, category_id: null, category_name: null }), row({ id: 4, merchant: 'Gojek' })];
    const view = await render(wrap(<ImportReviewView items={items} saving={false} {...h} />));
    expect(view.getByText('Simpan 2 yang lengkap')).toBeTruthy();
    await fireEvent.press(view.getByTestId('import-save-all'));
    expect(h.onSaveAll).toHaveBeenCalledTimes(1);
  });

  test('no bulk save when nothing is complete', async () => {
    const h = handlers();
    const view = await render(wrap(<ImportReviewView items={[row({ kind: null })]} saving={false} {...h} />));
    expect(view.queryByTestId('import-save-all')).toBeNull();
  });
});

describe('Periksa: one card', () => {
  const data: TxFormData = {
    accounts: [
      { id: 1, name: 'BCA Tabungan', type: 'bank', icon: null, balance: 1_000_000, openingDate: '2026-01-01' },
      { id: 2, name: 'Valas', type: 'forex', icon: null, balance: 0, openingDate: '2026-01-01' },
    ],
    categories: [
      { id: 10, name: 'Food & drink', kind: 'expense' },
      { id: 11, name: 'Shopping', kind: 'expense' },
      { id: 12, name: 'Salary', kind: 'income' },
    ],
    pockets: [],
    rates: {},
    record: null,
  };
  const handlers = () => ({ onBack: jest.fn(), onSave: jest.fn(), onReject: jest.fn() });
  const open = async (item: QueueRowWithNames, h = handlers(), error: string | null = null, extra: Partial<typeof data> = {}) => ({
    view: await render(wrap(<ImportEditView item={item} data={{ ...data, ...extra }} today="2026-11-03" saving={false} error={error} {...h} />)),
    h,
  });

  test('shows where it was read from, and Simpan hands back what is on screen', async () => {
    const { view, h } = await open(row({}));
    expect(view.getByTestId('import-edit-source').props.children).toContain('Example Bank');
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).toHaveBeenCalledWith({ kind: 'expense', amountIdr: 25000, merchant: 'Kopi Kenangan', categoryId: 10, accountId: 1, date: '2026-11-03', subcategoryId: null }, false);
  });

  test('a sub-category the merchant names is filled in; it can be taken off or another chosen', async () => {
    const subcategories = [{ id: 5, categoryId: 10, name: 'Kopi' }, { id: 6, categoryId: 10, name: 'Roti' }];
    const { view, h } = await open(row({}), handlers(), null, { subcategories });
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 10, subcategoryId: 5 }), false);
    await fireEvent.press(view.getByTestId('tx-subcategory-6'));
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ subcategoryId: 6 }), false);
  });

  test('Simpan stays off until a kind and a category are chosen', async () => {
    const { view, h } = await open(row({ kind: null, category_id: null, category_name: null }));
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).not.toHaveBeenCalled();
  });

  test('the amount and the name can be changed before saving', async () => {
    const { view, h } = await open(row({}));
    await fireEvent.changeText(view.getByTestId('import-edit-amount'), '27500');
    await fireEvent.changeText(view.getByTestId('import-edit-merchant'), 'Kopi Tuku');
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ amountIdr: 27500, merchant: 'Kopi Tuku' }), false);
  });

  test('changing the kind clears a category of the other kind', async () => {
    const { view, h } = await open(row({}));
    await fireEvent.press(view.getByText(txKindLabel('income')));
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).not.toHaveBeenCalled(); // the expense category no longer fits an income
  });

  test('"remember" is offered when there is a merchant and a category, and is passed on', async () => {
    const { view, h } = await open(row({}));
    await fireEvent.press(view.getByTestId('import-edit-remember'));
    await fireEvent.press(view.getByTestId('import-edit-save'));
    expect(h.onSave).toHaveBeenCalledWith(expect.anything(), true);
  });

  test('no "remember" without a merchant', async () => {
    const { view } = await open(row({ merchant: '' }));
    expect(view.queryByTestId('import-edit-remember')).toBeNull();
  });

  test('Tolak drops it, and a refusal from the domain shows as a message', async () => {
    const { view, h } = await open(row({}), handlers(), 'Not enough money in BCA Tabungan.');
    expect(view.getByTestId('import-edit-error')).toBeTruthy();
    await fireEvent.press(view.getByTestId('import-edit-reject'));
    expect(h.onReject).toHaveBeenCalledTimes(1);
  });
});
