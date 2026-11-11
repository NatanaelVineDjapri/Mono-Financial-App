import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { AccountFormValues, AccountValidationContext } from '@/core/account/validate';
import { AccountForm, type AccountFormProps } from '@/features/accounts/form/AccountForm';
import { MonoColors } from '@/theme/tokens';

const TODAY = '2026-10-28';
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const FRESH: AccountFormValues = { name: '', type: 'bank', openingBalance: 0, openingDate: TODAY, icon: null };
const CONTEXT: AccountValidationContext = { today: TODAY, otherNames: ['Cash wallet', 'GoPay'] };

function renderForm(props: Partial<AccountFormProps> = {}) {
  const onSubmit = jest.fn<Promise<{ ok: true } | { ok: false; message: string }>, [AccountFormValues]>(async () => ({ ok: true }));
  const onCancel = jest.fn();
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AccountForm mode="add" initial={FRESH} context={CONTEXT} onSubmit={onSubmit} onCancel={onCancel} {...props} />
    </SafeAreaProvider>,
  );
  return { view, onSubmit, onCancel };
}

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

describe('AccountForm: a new account', () => {
  beforeEach(async () => {
    await act(async () => useHideAmounts.getState().setHidden(false));
  });

  test('opens as a Bank on today with nothing wrong shown', async () => {
    const result = await (await renderForm()).view;
    expect(result.getByRole('header', { name: 'New account' })).toBeTruthy();
    expect(result.getByRole('radio', { name: 'Bank' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByText('As of 28 Oct 2026')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(result.queryByTestId('account-error-summary')).toBeNull();
    expect(result.queryByTestId('account-name-error')).toBeNull();
    expect(result.getByText('No bank login or card number is needed. This is only a label you keep on this device.')).toBeTruthy();
    expect(result.getByText('The balance on that date. Income, expenses and transfers you record afterwards move it. Editing this later recalculates the current balance.')).toBeTruthy();
  });

  test('four type tiles; the chosen one is solid light, the others are not', async () => {
    const result = await (await renderForm()).view;
    for (const label of ['Bank', 'Cash', 'E-wallet', 'Savings']) expect(result.getByRole('radio', { name: label })).toBeTruthy();
    expect(flat(result.getByTestId('account-type-bank')).backgroundColor).toBe(MonoColors.text);
    expect(flat(result.getByTestId('account-type-cash')).backgroundColor).not.toBe(MonoColors.text);
    await fireEvent.press(result.getByRole('radio', { name: 'E-wallet' }));
    expect(result.getByRole('radio', { name: 'E-wallet' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('radio', { name: 'Bank' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('the opening balance takes digits only, with thousands dots', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '1x200000');
    expect(result.getByTestId('tx-amount-input').props.value).toBe('1.200.000');
    expect(result.getByText('Opening balance')).toBeTruthy();
    expect(result.queryByTestId('tx-quick-10000')).toBeNull(); // no quick-add chips here
  });

  test('Cancel and close both leave', async () => {
    const { view, onCancel } = await renderForm();
    const result = await view;
    await fireEvent.press(result.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(result.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe('icons', () => {
  test('a bank offers bank marks and "No bank"; choosing one selects it and names it', async () => {
    const result = await (await renderForm()).view;
    expect(result.getByText('Icon · optional')).toBeTruthy();
    expect(result.getByTestId('account-icon-bca')).toBeTruthy();
    expect(result.queryByTestId('account-icon-gopay')).toBeNull();
    expect(result.getByTestId('account-icon-none').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(result.getByTestId('account-icon-bca'));
    expect(result.getByTestId('account-icon-bca').props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByTestId('account-icon-bca').props.accessibilityLabel).toBe('BCA icon');
    expect(within(result.getByTestId('account-icons')).getByText('BCA')).toBeTruthy();
  });

  test('an e-wallet offers wallet marks; a chosen bank mark is dropped when the type changes', async () => {
    const result = await (await renderForm({ initial: { ...FRESH, icon: 'bca' } })).view;
    await fireEvent.press(result.getByRole('radio', { name: 'E-wallet' }));
    expect(result.getByTestId('account-icon-gopay')).toBeTruthy();
    expect(result.queryByTestId('account-icon-bca')).toBeNull();
    expect(result.getByTestId('account-icon-none').props.accessibilityState).toMatchObject({ selected: true });
  });

  test('cash has no brand to pick (it has its own card)', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByRole('radio', { name: 'Cash' }));
    expect(result.queryByTestId('account-icons')).toBeNull();
  });
});

describe('validation: nothing at first, then what is wrong', () => {
  test('the name shows its error once touched, not before', async () => {
    const result = await (await renderForm()).view;
    expect(result.queryByTestId('account-name-error')).toBeNull();
    await fireEvent(result.getByTestId('account-name'), 'blur');
    expect(result.getByText('Give the account a name.')).toBeTruthy();
    expect(flat(result.getByTestId('account-name'))).toMatchObject({ borderColor: MonoColors.negative, borderWidth: 1.5 });
    expect(flat(within(result.getByTestId('account-name-error')).getByText('Give the account a name.')).color).toBe(MonoColors.negative);
  });

  test('Save on an empty form reveals the error, summarises it and does not save', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.press(result.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.getByText('1 field needs attention before this can be saved.')).toBeTruthy();
    expect(result.getByTestId('account-save').props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('a name that another account already has (any case) is refused', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.changeText(result.getByTestId('account-name'), 'gopay');
    await fireEvent(result.getByTestId('account-name'), 'blur');
    expect(result.getByText('You already have an account with this name.')).toBeTruthy();
  });

  test('the date cannot be after today: the sheet greys those days out', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByTestId('account-date-button'));
    const sheet = within(result.getByTestId('tx-date-sheet'));
    expect(sheet.getByTestId('tx-date-day-2026-10-29').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(sheet.getByTestId('tx-date-day-2026-10-01'));
    expect(result.getByText('As of 1 Oct 2026')).toBeTruthy();
  });
});

describe('saving', () => {
  test('a valid account is submitted with what was typed', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.changeText(result.getByTestId('account-name'), 'BCA Tabungan');
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '1200000');
    await fireEvent.press(result.getByTestId('account-icon-bca'));
    await fireEvent.press(result.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: TODAY, icon: 'bca' });
  });

  test('Save is off while it saves, so a second tap cannot save twice', async () => {
    const harness = await renderForm();
    let finish: (r: { ok: true }) => void = () => {};
    harness.onSubmit.mockImplementation(() => new Promise(resolve => { finish = resolve as typeof finish; }));
    const result = await harness.view;
    await fireEvent.changeText(result.getByTestId('account-name'), 'Jago Pocket');
    await fireEvent.press(result.getByRole('button', { name: 'Create account' }));
    expect(result.getByTestId('account-save').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(result.getByTestId('account-save'));
    expect(harness.onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true }));
  });

  test('a save the database refuses shows why and keeps the form', async () => {
    const harness = await renderForm();
    harness.onSubmit.mockResolvedValueOnce({ ok: false, message: "Couldn't save. Nothing was changed." });
    const result = await harness.view;
    await fireEvent.changeText(result.getByTestId('account-name'), 'Jago Pocket');
    await fireEvent.press(result.getByRole('button', { name: 'Create account' }));
    expect(result.getByText("Couldn't save. Nothing was changed.")).toBeTruthy();
    expect(result.getByTestId('account-name').props.value).toBe('Jago Pocket');
  });
});

describe('editing an account', () => {
  const EXISTING: AccountFormValues = { name: 'BCA Tabungan', type: 'bank', openingBalance: 1200000, openingDate: '2026-01-01', icon: 'bca' };
  const editing: AccountValidationContext = { today: TODAY, otherNames: ['Cash wallet'], editing: { movement: 5642500, firstRecordOn: '2026-06-25' } };

  test('is filled, titled "Edit account", with "Save changes"', async () => {
    const result = await (await renderForm({ mode: 'edit', initial: EXISTING, context: editing })).view;
    expect(result.getByRole('header', { name: 'Edit account' })).toBeTruthy();
    expect(result.getByTestId('account-name').props.value).toBe('BCA Tabungan');
    expect(result.getByTestId('tx-amount-input').props.value).toBe('1.200.000');
    expect(result.getByText('As of 1 Jan 2026')).toBeTruthy();
    expect(result.getByTestId('account-icon-bca').props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  test("the opening date cannot move past the account's first record", async () => {
    const result = await (await renderForm({ mode: 'edit', initial: EXISTING, context: editing })).view;
    await fireEvent.press(result.getByTestId('account-date-button'));
    const sheet = within(result.getByTestId('tx-date-sheet'));
    for (let i = 0; i < 6; i++) await fireEvent.press(sheet.getByTestId('tx-date-next')); // January to July
    await fireEvent.press(sheet.getByTestId('tx-date-day-2026-07-01'));
    expect(result.getByText('This account has records from 25 Jun 2026. Pick that day or an earlier one.')).toBeTruthy();
    expect(flat(result.getByTestId('account-date-button'))).toMatchObject({ borderColor: MonoColors.negative, borderWidth: 1.5 });
  });

  test('a balance that would leave the account below zero is refused with how far', async () => {
    const withOut: AccountValidationContext = { ...editing, editing: { movement: -1000, firstRecordOn: null } };
    const result = await (await renderForm({ mode: 'edit', initial: EXISTING, context: withOut })).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '100');
    await fireEvent(result.getByTestId('tx-amount-input'), 'blur');
    expect(result.getByText('With this opening balance the account would be Rp900 below zero. Enter a higher amount.')).toBeTruthy();
  });

  test('the name may stay as it is (it is not a duplicate of itself)', async () => {
    const { view, onSubmit } = await renderForm({ mode: 'edit', initial: EXISTING, context: editing });
    const result = await view;
    await fireEvent.press(result.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith(EXISTING);
  });
});

test('hidden-amounts mode masks the figures inside an error sentence', async () => {
  await act(async () => useHideAmounts.getState().setHidden(true));
  const withOut: AccountValidationContext = { today: TODAY, otherNames: [], editing: { movement: -1000, firstRecordOn: null } };
  const result = await (await renderForm({ mode: 'edit', initial: { ...FRESH, name: 'A', openingBalance: 5000 }, context: withOut })).view;
  await fireEvent.changeText(result.getByTestId('tx-amount-input'), '100');
  await fireEvent(result.getByTestId('tx-amount-input'), 'blur');
  expect(result.queryByText(/Rp900/)).toBeNull();
  expect(result.getByText(/Rp••••••••/)).toBeTruthy();
  await act(async () => useHideAmounts.getState().setHidden(false));
});
