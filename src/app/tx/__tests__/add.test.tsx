import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { FormAccount, FormCategory, TxFormValues } from '@/core/tx/validate';
import type { TxFormData } from '@/domain/txForm';
import { TransactionForm, type SubmitResult, type TransactionFormProps } from '@/features/transactions/form/TransactionForm';
import { MonoColors } from '@/theme/tokens';

const TODAY = '2026-10-28';
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, openingDate: '2026-01-01' };
const CASH: FormAccount = { id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, openingDate: '2026-01-01' };
const JAGO: FormAccount = { id: 3, name: 'Jago Pocket', type: 'savings', icon: 'jago', balance: 1275000, openingDate: '2026-03-01' };
const VALAS: FormAccount = { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, openingDate: '2026-01-01' };

const EXPENSE_NAMES = ['Food & drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Leisure', 'Housing', 'Education', 'Gifts', 'Other'];
const INCOME_NAMES = ['Salary', 'Freelance', 'Interest and dividends', 'Other income'];
const CATEGORIES: FormCategory[] = [
  ...EXPENSE_NAMES.map((name, i) => ({ id: i + 1, name, kind: 'expense' as const })),
  ...INCOME_NAMES.map((name, i) => ({ id: 11 + i, name, kind: 'income' as const })),
];
const FOOD = 1;
const SALARY = 11;

const DATA: TxFormData = { accounts: [BCA, CASH, JAGO, VALAS], categories: CATEGORIES, record: null };

function renderForm(props: Partial<TransactionFormProps> = {}) {
  const onSubmit = jest.fn<Promise<SubmitResult>, [TxFormValues]>(async () => ({ ok: true }));
  const onCancel = jest.fn();
  const onChat = jest.fn();
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TransactionForm mode="add" data={DATA} today={TODAY} onSubmit={onSubmit} onCancel={onCancel} onChat={onChat} {...props} />
    </SafeAreaProvider>,
  );
  return { view, onSubmit, onCancel, onChat };
}

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

async function typeAmount(result: Awaited<ReturnType<typeof render>>, text: string) {
  await fireEvent.changeText(result.getByTestId('tx-amount-input'), text);
}

describe('TransactionForm: a fresh form', () => {
  beforeEach(async () => {
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('opens as an expense with the first Rupiah account and today, and shows no error', async () => {
    const { view } = await renderForm();
    const result = await view;
    expect(result.getByRole('header', { name: 'Add transaction' })).toBeTruthy();
    expect(result.getByRole('radio', { name: 'Expense' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByText('BCA Tabungan')).toBeTruthy();
    expect(result.getByText('Balance after: Rp6.842.500')).toBeTruthy();
    expect(result.getByText('28 Oct 2026')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Today' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('button', { name: 'Save expense' })).toBeTruthy();
    expect(result.queryByTestId('tx-error-summary')).toBeNull();
    expect(result.queryByTestId('tx-amount-error')).toBeNull();
    expect(result.queryByTestId('tx-category-error')).toBeNull();
  });

  test('the start type can be set (income / transfer), and the Save label follows the type', async () => {
    const income = await (await renderForm({ initialType: 'income' })).view;
    expect(income.getByRole('radio', { name: 'Income' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(income.getByRole('button', { name: 'Save income' })).toBeTruthy();
    const transfer = await (await renderForm({ initialType: 'transfer' })).view;
    expect(transfer.getByRole('button', { name: 'Save transfer' })).toBeTruthy();
    expect(transfer.getByText('Amount to move')).toBeTruthy();
  });

  test('Cancel and close both leave; the header has no Chat shortcut', async () => {
    const { view, onCancel } = await renderForm();
    const result = await view;
    await fireEvent.press(result.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(result.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(result.queryByTestId('tx-form-chat')).toBeNull();
  });
});

describe('amount', () => {
  test('digits only, thousands dots, at most 12 digits; "Rp" sits beside it', async () => {
    const result = await (await renderForm()).view;
    await typeAmount(result, '12a5000');
    expect(result.getByTestId('tx-amount-input').props.value).toBe('125.000');
    await typeAmount(result, '1234567890123456');
    expect(result.getByTestId('tx-amount-input').props.value).toBe('123.456.789.012'); // 12 digits
    expect(result.getByText('Rp')).toBeTruthy();
    expect(result.getByTestId('tx-amount-input').props.accessibilityLabel).toBe('Amount in rupiah');
  });

  test('the quick chips add to what is there', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-quick-100000'));
    expect(result.getByTestId('tx-amount-input').props.value).toBe('100.000');
    await fireEvent.press(result.getByTestId('tx-quick-50000'));
    await fireEvent.press(result.getByTestId('tx-quick-10000'));
    expect(result.getByTestId('tx-amount-input').props.value).toBe('160.000');
  });

  test('"Balance after" follows the amount live: an expense takes it out, an income puts it in', async () => {
    const result = await (await renderForm()).view;
    await typeAmount(result, '125000');
    expect(result.getByText('Balance after: Rp6.717.500')).toBeTruthy();
    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));
    expect(result.getByText('Balance after: Rp6.967.500')).toBeTruthy();
  });

  test('hidden-amounts mode masks the balance line', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await (await renderForm()).view;
    expect(result.getByText('Balance after: Rp••••••••')).toBeTruthy();
    expect(result.queryByText(/6\.842\.500/)).toBeNull();
    await act(async () => useHideAmounts.getState().setHidden(false));
  });
});

describe('type switching', () => {
  test('the amount, date and description stay; the category goes; the list follows the kind', async () => {
    const result = await (await renderForm()).view;
    await typeAmount(result, '125000');
    await fireEvent.changeText(result.getByTestId('tx-description'), 'Lunch with team');
    await fireEvent.press(result.getByTestId(`tx-category-${FOOD}`));
    expect(result.getByTestId(`tx-category-${FOOD}`).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));
    expect(result.getByTestId('tx-amount-input').props.value).toBe('125.000');
    expect(result.getByTestId('tx-description').props.value).toBe('Lunch with team');
    expect(result.getByText('28 Oct 2026')).toBeTruthy();
    expect(result.queryByTestId(`tx-category-${FOOD}`)).toBeNull(); // not an income category
    expect(result.getByTestId(`tx-category-${SALARY}`).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('a transfer has no category and no notes; its description says optional', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByRole('radio', { name: 'Transfer' }));
    expect(result.queryByTestId('tx-category-row')).toBeNull();
    expect(result.queryByTestId('tx-note')).toBeNull();
    expect(result.getByText('Description · optional')).toBeTruthy();
  });
});

describe('category', () => {
  test('the chosen chip is selected, and "More" opens the whole list', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-category-more'));
    const sheet = within(result.getByTestId('tx-category-sheet'));
    expect(sheet.getByText('All categories')).toBeTruthy();
    await fireEvent.press(sheet.getByTestId('tx-category-option-10')); // Other, past the first chips
    expect(result.getByTestId('tx-category-10').props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('validation: nothing at first, then what is wrong', () => {
  test('Save on an empty form reveals the errors, in a summary, and does not save', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.getByText('Enter an amount above Rp0.')).toBeTruthy();
    expect(result.getByText('Choose a category so this counts toward the right budget.')).toBeTruthy();
    expect(result.getByText('2 fields need attention before this can be saved.')).toBeTruthy();
    // Save is now disabled (fill and text change are the Button's own disabled look).
    expect(result.getByTestId('tx-save').props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('an error is a red 1.5 border, an icon and a sentence', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    const card = flat(result.getByTestId('tx-amount-card'));
    expect(card).toMatchObject({ borderColor: MonoColors.negative, borderWidth: 1.5 });
    const line = within(result.getByTestId('tx-amount-error'));
    expect(flat(line.getByText('Enter an amount above Rp0.')).color).toBe(MonoColors.negative);
    expect(result.getByTestId('tx-amount-input').props.accessibilityHint).toBe('Enter an amount above Rp0.');
  });

  test('a field shows its error once it was touched (the amount on blur), not before', async () => {
    const result = await (await renderForm()).view;
    expect(result.queryByTestId('tx-amount-error')).toBeNull();
    await fireEvent(result.getByTestId('tx-amount-input'), 'blur');
    expect(result.getByText('Enter an amount above Rp0.')).toBeTruthy();
    expect(result.queryByTestId('tx-category-error')).toBeNull(); // the category was not touched
  });

  test('a short balance shows at once, with the shortfall and the link to transfer money in', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-account-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-2')); // Cash wallet, Rp450.000
    await typeAmount(result, '1500000');
    const message = within(result.getByTestId('tx-account-error'));
    expect(
      message.getByText(
        'Cash wallet only has Rp450.000. Pick another account, lower the amount, or transfer money in first. Short by Rp1.050.000.',
      ),
    ).toBeTruthy();
    expect(message.getByRole('link', { name: 'transfer money in first' })).toBeTruthy();
    expect(result.getByText('1 field needs attention before this can be saved.')).toBeTruthy();
    expect(flat(result.getByTestId('tx-account-button'))).toMatchObject({ borderColor: MonoColors.negative, borderWidth: 1.5 });
    expect(result.queryByTestId('tx-category-error')).toBeNull(); // the other, untouched field is quiet
  });

  test('the link switches to a Transfer into that account', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-account-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-2'));
    await typeAmount(result, '1500000');
    await fireEvent.press(within(result.getByTestId('tx-account-error')).getByRole('link', { name: 'transfer money in first' }));

    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(within(result.getByTestId('tx-to-button')).getByText('Cash wallet')).toBeTruthy();
    expect(within(result.getByTestId('tx-from-button')).getByText('BCA Tabungan')).toBeTruthy();
    expect(result.getByTestId('tx-amount-input').props.value).toBe('1.500.000'); // the amount stays
  });

  test('exactly the balance is fine; one rupiah more is short', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-account-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-2'));
    await typeAmount(result, '450000');
    expect(result.queryByTestId('tx-account-error')).toBeNull();
    await typeAmount(result, '450001');
    expect(within(result.getByTestId('tx-account-error')).getByText(/Short by Rp1\./)).toBeTruthy();
  });

  test('a short balance names no link on a transfer (the money is already being moved)', async () => {
    const result = await (await renderForm({ initialType: 'transfer' })).view;
    await fireEvent.press(result.getByTestId('tx-from-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-2')); // Cash wallet as From
    await fireEvent.press(result.getByTestId('tx-to-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-3'));
    await typeAmount(result, '500000');
    const message = within(result.getByTestId('tx-account-error'));
    expect(message.getByText('Cash wallet only has Rp450.000. Pick another account or lower the amount. Short by Rp50.000.')).toBeTruthy();
    expect(message.queryByRole('link')).toBeNull();
  });
});

describe('transfer', () => {
  async function transferForm() {
    const harness = await renderForm({ initialType: 'transfer' });
    const result = await harness.view;
    await fireEvent.press(result.getByTestId('tx-to-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-3')); // Jago Pocket
    return { ...harness, result };
  }

  test('From and To with their balance after, the swap button and the info banner', async () => {
    const { result } = await transferForm();
    await typeAmount(result, '500000');
    expect(within(result.getByTestId('tx-from-button')).getByText('Balance after: Rp6.342.500')).toBeTruthy();
    expect(within(result.getByTestId('tx-to-button')).getByText('Balance after: Rp1.775.000')).toBeTruthy();
    expect(result.getByText('Moves money between your own accounts. Net worth does not change, and this is not counted as income or an expense.')).toBeTruthy();
    const swap = result.getByRole('button', { name: 'Swap From and To' });
    expect(flat(swap)).toMatchObject({ width: 44, height: 44 });
  });

  test('swap exchanges the two accounts', async () => {
    const { result } = await transferForm();
    await fireEvent.press(result.getByTestId('tx-swap'));
    expect(within(result.getByTestId('tx-from-button')).getByText('Jago Pocket')).toBeTruthy();
    expect(within(result.getByTestId('tx-to-button')).getByText('BCA Tabungan')).toBeTruthy();
  });

  test('the same account twice is "Pick two different accounts."', async () => {
    const { result } = await transferForm();
    await fireEvent.press(result.getByTestId('tx-to-button'));
    await fireEvent.press(result.getByTestId('tx-account-option-1')); // BCA, the From account too
    expect(result.getByText('Pick two different accounts.')).toBeTruthy();
  });

  test('a valid transfer is submitted as one transfer without a category', async () => {
    const { result, onSubmit } = await transferForm();
    await typeAmount(result, '500000');
    await fireEvent.changeText(result.getByTestId('tx-description'), 'Top up Jago');
    await fireEvent.press(result.getByRole('button', { name: 'Save transfer' }));
    expect(onSubmit).toHaveBeenCalledWith({ type: 'transfer', amount: 500000, categoryId: null, accountId: 1, toAccountId: 3, date: TODAY, description: 'Top up Jago', note: '' });
  });
});

describe('account sheet', () => {
  test('lists each account with its balance now; a Valas account is disabled "coming later"', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('tx-account-button'));
    const sheet = within(result.getByTestId('tx-account-sheet'));
    expect(sheet.getByText('Balance Rp6.842.500')).toBeTruthy();
    expect(sheet.getByText('Balance Rp450.000')).toBeTruthy();
    const valas = sheet.getByTestId('tx-account-option-4');
    expect(valas.props.accessibilityState).toMatchObject({ disabled: true });
    expect(sheet.getByText('Valas: coming later')).toBeTruthy();
    await fireEvent.press(valas); // nothing happens
    expect(within(result.getByTestId('tx-account-button')).getByText('BCA Tabungan')).toBeTruthy();
  });
});

describe('date', () => {
  test('Yesterday sets the day before; the sheet picks a day and never one after today', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByRole('button', { name: 'Yesterday' }));
    expect(result.getByText('27 Oct 2026')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Yesterday' }).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(result.getByTestId('tx-date-button'));
    const sheet = within(result.getByTestId('tx-date-sheet'));
    expect(sheet.getByTestId('tx-date-month').props.children).toBe('October 2026');
    expect(sheet.getByTestId('tx-date-day-2026-10-29').props.accessibilityState).toMatchObject({ disabled: true });
    expect(sheet.getByTestId('tx-date-next').props.accessibilityState).toMatchObject({ disabled: true }); // no later month
    await fireEvent.press(sheet.getByTestId('tx-date-day-2026-10-15'));
    expect(result.getByText('15 Oct 2026')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Today' }).props.accessibilityState).toMatchObject({ selected: false });
  });
});

describe('saving', () => {
  async function filledExpense() {
    const harness = await renderForm();
    const result = await harness.view;
    await typeAmount(result, '125000');
    await fireEvent.press(result.getByTestId(`tx-category-${FOOD}`));
    await fireEvent.changeText(result.getByTestId('tx-description'), 'Lunch with team');
    await fireEvent.changeText(result.getByTestId('tx-note'), 'Makan siang');
    return { ...harness, result };
  }

  test('a valid expense is submitted with everything typed', async () => {
    const { result, onSubmit } = await filledExpense();
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ type: 'expense', amount: 125000, categoryId: FOOD, accountId: 1, toAccountId: null, date: TODAY, description: 'Lunch with team', note: 'Makan siang' });
  });

  test('Save is off while it saves, so a second tap cannot save twice', async () => {
    const harness = await renderForm();
    let finish: (r: SubmitResult) => void = () => {};
    harness.onSubmit.mockImplementation(() => new Promise<SubmitResult>(resolve => { finish = resolve; }));
    const result = await harness.view;
    await typeAmount(result, '125000');
    await fireEvent.press(result.getByTestId(`tx-category-${FOOD}`));

    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(result.getByTestId('tx-save').props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByText('Saving…')).toBeTruthy();
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(harness.onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true }));
  });

  test('a save the database refuses shows why and keeps the form', async () => {
    const { result, onSubmit } = await filledExpense();
    onSubmit.mockResolvedValueOnce({ ok: false, message: "Couldn't save. Nothing was changed." });
    await fireEvent.press(result.getByRole('button', { name: 'Save expense' }));
    expect(result.getByText("Couldn't save. Nothing was changed.")).toBeTruthy();
    expect(result.getByTestId('tx-amount-input').props.value).toBe('125.000');
  });
});

describe('edit mode', () => {
  const record = {
    id: 5,
    type: 'expense' as const,
    accountId: 1,
    toAccountId: null,
    categoryId: FOOD,
    amount: 125000,
    date: '2026-10-27',
    description: 'Lunch with team',
    note: 'Makan siang',
    currency: 'IDR',
    toCurrency: null,
    supported: true,
    snapshot: {} as never,
  };
  const editData: TxFormData = { ...DATA, record };

  test('is filled from the record, titled "Edit transaction" with "Save changes"', async () => {
    const result = await (await renderForm({ mode: 'edit', data: editData })).view;
    expect(result.getByRole('header', { name: 'Edit transaction' })).toBeTruthy();
    expect(result.getByTestId('tx-amount-input').props.value).toBe('125.000');
    expect(result.getByTestId('tx-description').props.value).toBe('Lunch with team');
    expect(result.getByTestId('tx-note').props.value).toBe('Makan siang');
    expect(result.getByText('27 Oct 2026')).toBeTruthy();
    expect(result.getByTestId(`tx-category-${FOOD}`).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(result.queryByTestId('tx-form-chat')).toBeNull(); // no Chat shortcut when editing
  });

  test('an expense can become an income, but never a transfer', async () => {
    const result = await (await renderForm({ mode: 'edit', data: editData })).view;
    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityHint).toBe('The type of a transfer cannot be changed.');
    await fireEvent.press(result.getByRole('radio', { name: 'Income' }));
    expect(result.getByRole('radio', { name: 'Income' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(result.getByRole('radio', { name: 'Transfer' }));
    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('a transfer record stays a transfer: Income and Expense are locked', async () => {
    const transfer = { ...record, id: 6, type: 'transfer' as const, categoryId: null, toAccountId: 3, amount: 500000 };
    const result = await (await renderForm({ mode: 'edit', data: { ...DATA, record: transfer } })).view;
    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('radio', { name: 'Expense' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByRole('radio', { name: 'Income' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  test('submitting sends the changed values for that record', async () => {
    const { view, onSubmit } = await renderForm({ mode: 'edit', data: editData });
    const result = await view;
    await typeAmount(result, '200000');
    await fireEvent.press(result.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith({ type: 'expense', amount: 200000, categoryId: FOOD, accountId: 1, toAccountId: null, date: '2026-10-27', description: 'Lunch with team', note: 'Makan siang' });
  });
});
