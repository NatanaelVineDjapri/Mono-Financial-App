// The optional sub-category on the transaction form: a row of chips under the category, shown only when the chosen category has
// any, "None" by default, dropped again when the category changes.
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { FormAccount, FormCategory, FormSubcategory, TxFormValues } from '@/core/tx/validate';
import type { TxFormData } from '@/domain/txForm';
import { TransactionForm, type SubmitResult } from '@/features/transactions/form/TransactionForm';
import { useHideAmounts } from '@/components/hide-amounts-store';

const TODAY = '2026-10-28';
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };
const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, openingDate: '2026-01-01' };
const CATEGORIES: FormCategory[] = [
  { id: 1, name: 'Food & drink', kind: 'expense' },
  { id: 2, name: 'Transport', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];
const SUBS: FormSubcategory[] = [
  { id: 101, categoryId: 1, name: 'Sendiri' },
  { id: 102, categoryId: 1, name: 'Berdua' },
  { id: 201, categoryId: 11, name: 'Bonus' },
];
const DATA: TxFormData = { accounts: [BCA], categories: CATEGORIES, subcategories: SUBS, pockets: [], rates: {}, record: null };

function renderForm(data: TxFormData = DATA, props: Record<string, unknown> = {}) {
  const onSubmit = jest.fn<Promise<SubmitResult>, [TxFormValues]>(async () => ({ ok: true }));
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TransactionForm mode="add" data={data} today={TODAY} onSubmit={onSubmit} onCancel={jest.fn()} onChat={jest.fn()} {...props} />
    </SafeAreaProvider>,
  );
  return { view, onSubmit };
}

const selected = (node: { props: { accessibilityState?: unknown } }) => node.props.accessibilityState;

beforeEach(async () => {
  await act(async () => useHideAmounts.getState().setHidden(false));
});

describe('TransactionForm: the optional sub-category', () => {
  test('no row until a category with sub-categories is chosen', async () => {
    const result = await (await renderForm()).view;
    expect(result.queryByTestId('tx-subcategory-row')).toBeNull();
    await fireEvent.press(result.getByTestId('tx-category-2')); // Transport has none
    expect(result.queryByTestId('tx-subcategory-row')).toBeNull();
    await fireEvent.press(result.getByTestId('tx-category-1'));
    expect(result.getByTestId('tx-subcategory-row')).toBeTruthy();
    expect(result.getByTestId('tx-subcategory-101')).toBeTruthy();
    expect(result.getByTestId('tx-subcategory-102')).toBeTruthy();
    expect(result.queryByTestId('tx-subcategory-201')).toBeNull(); // Bonus belongs to Salary
  });

  test('"None" is the default, one can be chosen, and the chosen one goes back to none when pressed again', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-category-1'));
    expect(selected(result.getByTestId('tx-subcategory-none'))).toMatchObject({ selected: true });
    await fireEvent.press(result.getByTestId('tx-subcategory-102'));
    expect(selected(result.getByTestId('tx-subcategory-102'))).toMatchObject({ selected: true });
    expect(selected(result.getByTestId('tx-subcategory-none'))).toMatchObject({ selected: false });
    await fireEvent.press(result.getByTestId('tx-subcategory-102'));
    expect(selected(result.getByTestId('tx-subcategory-none'))).toMatchObject({ selected: true });
  });

  test('the chosen sub-category goes with the values to Save; without one, null', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20000');
    await fireEvent.press(result.getByTestId('tx-category-1'));
    await fireEvent.press(result.getByTestId('tx-subcategory-101'));
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 1, subcategoryId: 101 }));

    const second = await renderForm();
    const again = await second.view;
    await fireEvent.changeText(again.getByTestId('tx-amount-input'), '20000');
    await fireEvent.press(again.getByTestId('tx-category-1'));
    await fireEvent.press(again.getByRole('button', { name: 'Save expense' }));
    expect(second.onSubmit.mock.calls[0][0].subcategoryId ?? null).toBeNull();
  });

  test('another category drops the sub-category of the old one', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20000');
    await fireEvent.press(result.getByTestId('tx-category-1'));
    await fireEvent.press(result.getByTestId('tx-subcategory-101'));
    await fireEvent.press(result.getByTestId('tx-category-2'));
    expect(result.queryByTestId('tx-subcategory-row')).toBeNull();
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(onSubmit.mock.calls[0][0].subcategoryId ?? null).toBeNull();
  });

  test('switching to a transfer or to income drops it too, and income shows its own sub-categories', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-category-1'));
    await fireEvent.press(result.getByTestId('tx-subcategory-102'));
    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));
    expect(result.queryByTestId('tx-subcategory-row')).toBeNull();
    await fireEvent.press(result.getByTestId('tx-category-11'));
    expect(result.getByTestId('tx-subcategory-201')).toBeTruthy();
    expect(selected(result.getByTestId('tx-subcategory-none'))).toMatchObject({ selected: true });
  });

  test('editing a record opens on its own sub-category', async () => {
    const record = {
      id: 7,
      type: 'expense' as const,
      accountId: 1,
      toAccountId: null,
      categoryId: 1,
      subcategoryId: 102,
      amount: 30000,
      amountTo: null,
      date: '2026-10-20',
      description: 'Makan',
      note: '',
      currency: 'IDR',
      toCurrency: null,
      supported: true,
      snapshot: {} as never,
    };
    const result = await (await renderForm({ ...DATA, record }, { mode: 'edit' })).view;
    expect(selected(result.getByTestId('tx-subcategory-102'))).toMatchObject({ selected: true });
  });
});

describe('TransactionForm: the category filled from the description', () => {
  const history = [{ description: 'Boba', kind: 'expense' as const, categoryId: 1, subcategoryId: 102, uses: 3, lastOn: '2026-10-20' }];

  test('typing what was filed before fills category and sub-category, and clearing the words takes them back', async () => {
    const { view, onSubmit } = await renderForm({ ...DATA, history });
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-description'), 'boba');
    expect(selected(result.getByTestId('tx-category-1'))).toMatchObject({ selected: true });
    expect(selected(result.getByTestId('tx-subcategory-102'))).toMatchObject({ selected: true });
    await fireEvent.changeText(result.getByTestId('tx-description'), 'bo');
    expect(selected(result.getByTestId('tx-category-1'))).toMatchObject({ selected: false });
    await fireEvent.changeText(result.getByTestId('tx-description'), 'boba');
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '15000');
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 1, subcategoryId: 102 }));
  });

  test('a category chosen by hand is never replaced', async () => {
    const result = await (await renderForm({ ...DATA, history })).view;
    await fireEvent.press(result.getByTestId('tx-category-2'));
    await fireEvent.changeText(result.getByTestId('tx-description'), 'boba');
    expect(selected(result.getByTestId('tx-category-2'))).toMatchObject({ selected: true });
    expect(selected(result.getByTestId('tx-category-1'))).toMatchObject({ selected: false });
  });
});
