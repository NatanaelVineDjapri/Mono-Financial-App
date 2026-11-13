// The Valas screens drawn from plain props: the transaction form on a pocket, the exchange form, the
// detail, the create form and the Rates screen. The app's text is Indonesian in tests (jest-setup).
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { FormAccount, FormCategory, FormPocket, TxFormValues } from '@/core/tx/validate';
import type { TxFormData } from '@/domain/txForm';
import { RatesView, type RatesViewProps } from '@/features/fx/RatesView';
import { TransactionForm, type SubmitResult, type TransactionFormProps } from '@/features/transactions/form/TransactionForm';

import { AddCurrencySheet, matchCurrencies } from '../AddCurrencySheet';
import { PocketsCard, ValasActivity, ValasHero } from '../ValasDetailView';
import { ValasForm, type ValasFormProps } from '../ValasForm';
import type { ValasActivityItem, ValasDetail } from '../valasDetail';

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };
const TODAY = '2026-10-28';
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>;

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, openingDate: '2026-01-01' };
const VALAS: FormAccount = { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, openingDate: '2026-01-01' };
const POCKETS: FormPocket[] = [
  { accountId: 4, currency: 'SGD', minorFactor: 100, balance: 18000, openingDate: '2026-01-01' },
  { accountId: 4, currency: 'USD', minorFactor: 100, balance: 25000, openingDate: '2026-01-01' },
];
const CATEGORIES: FormCategory[] = [
  { id: 1, name: 'Food & drink', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];
const DATA: TxFormData = { accounts: [BCA, VALAS], categories: CATEGORIES, pockets: POCKETS, rates: { USD: 162500000, SGD: 125000000 }, record: null };

function renderForm(props: Partial<TransactionFormProps> = {}, data: TxFormData = DATA) {
  const onSubmit = jest.fn<Promise<SubmitResult>, [TxFormValues]>(async () => ({ ok: true }));
  const onSetRates = jest.fn();
  const view = render(wrap(<TransactionForm mode="add" data={data} today={TODAY} initialAccountId={4} onSubmit={onSubmit} onCancel={jest.fn()} onSetRates={onSetRates} {...props} />));
  return { view, onSubmit, onSetRates };
}

beforeEach(async () => {
  await act(async () => useHideAmounts.getState().setHidden(false));
});

describe('the transaction form on the Valas account (Tx-Add-Valas)', () => {
  test('opens on the first pocket, with pocket chips and an amount card in that currency', async () => {
    const result = await (await renderForm()).view;
    expect(result.getByTestId('tx-pocket-chips')).toBeTruthy();
    expect(result.getByRole('button', { name: 'SGD' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByText('Jumlah dalam SGD')).toBeTruthy();
    expect(result.getByText('Saldo setelahnya: S$180,00')).toBeTruthy();
  });

  test('typing S$20 shows what it is worth today at the latest rate, and saves cents with the currency', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20');
    expect(result.getByTestId('tx-live-value').props.children).toBe('≈ Rp250.000 · Rp12.500 per S$1');
    expect(result.getByText('Saldo setelahnya: S$160,00')).toBeTruthy();
    await fireEvent.press(result.getByTestId('tx-category-1'));
    expect(result.getByTestId('tx-budget-note')).toBeTruthy();
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense', accountId: 4, currency: 'SGD', amount: 2000, categoryId: 1 }));
  });

  test('a decimal amount is read in cents, never as a float', async () => {
    const { view, onSubmit } = await renderForm();
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20,55');
    await fireEvent.press(result.getByTestId('tx-category-1'));
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 2055 }));
  });

  test('switching the chip changes the currency of the card and the live line', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.press(result.getByRole('button', { name: 'USD' }));
    expect(result.getByText('Jumlah dalam USD')).toBeTruthy();
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '10');
    expect(result.getByTestId('tx-live-value').props.children).toBe('≈ Rp162.500 · Rp16.250 per US$1');
  });

  test('more than the pocket holds is refused in that currency, at once', async () => {
    const result = await (await renderForm()).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '300');
    expect(result.getByText('Kantong SGD hanya punya S$180,00. Pengeluaran ini S$300,00. Kurang S$120,00.')).toBeTruthy();
  });

  test('a currency with no rate blocks the form and offers the Rates screen; no ≈ line is drawn', async () => {
    const { view, onSetRates, onSubmit } = await renderForm({}, { ...DATA, rates: { USD: 162500000 } });
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20');
    expect(result.getByText(/Belum ada kurs untuk SGD\./)).toBeTruthy();
    expect(result.queryByTestId('tx-live-value')).toBeNull();
    await fireEvent.press(result.getByRole('link', { name: 'Atur kurs' }));
    expect(onSetRates).toHaveBeenCalled();
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('hidden-amounts mode hides every Valas figure on the form', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await (await renderForm()).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '20');
    expect(result.getByTestId('tx-live-value').props.children).toBe('≈ Rp•••••••• · Rp12.500 per S$1'); // the rate is a market figure, not the person's money
    expect(result.getByText('Saldo setelahnya: Rp••••••••')).toBeTruthy();
    expect(result.queryByText(/S\$180,00/)).toBeNull();
    expect(result.queryByText(/250\.000/)).toBeNull();
  });

  test('the draft editor of the AI chat never offers the Valas account', async () => {
    const draft = { index: 0, total: 1, sourceMessage: 'kopi 25rb', initialValues: { type: 'expense', amount: 25000, categoryId: 1, accountId: 1, toAccountId: null, date: TODAY, description: '', note: '' } as TxFormValues, onSkip: jest.fn() };
    const result = await (await renderForm({ mode: 'draft', draft, initialAccountId: undefined })).view;
    await fireEvent.press(result.getByTestId('tx-account-button'));
    const option = within(result.getByTestId('tx-account-sheet')).getByTestId('tx-account-option-4');
    expect(option.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('the exchange form (Tx-Exchange)', () => {
  test('from the Valas detail it starts as a swap between two pockets, with both amounts and the rate card', async () => {
    const result = await (await renderForm({ initialType: 'transfer' })).view;
    expect(result.getByText('Kamu kirim')).toBeTruthy();
    expect(result.getByText('Kamu terima')).toBeTruthy();
    expect(result.getByText('Isi jumlah kirim dan terima untuk melihat kurs.')).toBeTruthy();
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '100');
    await fireEvent.changeText(result.getByTestId('tx-amount-to-input'), '130');
    expect(within(result.getByTestId('tx-exchange-yours')).getByText('1 SGD = 1,30 USD')).toBeTruthy();
  });

  test('the rate card shows your rate, the latest stored one and the difference; a sensible swap shows 0,00%', async () => {
    const result = await (await renderForm({ initialType: 'transfer', initialAccountId: 4 }, { ...DATA, pockets: POCKETS.slice().reverse() })).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '100'); // USD 100 ...
    await fireEvent.changeText(result.getByTestId('tx-amount-to-input'), '130'); // ... for SGD 130
    expect(within(result.getByTestId('tx-exchange-difference')).getByText('0,00% (Rp0)')).toBeTruthy();
  });

  test('saves both amounts and both currencies', async () => {
    const { view, onSubmit } = await renderForm({ initialType: 'transfer' });
    const result = await view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '100');
    await fireEvent.changeText(result.getByTestId('tx-amount-to-input'), '130');
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'transfer', accountId: 4, toAccountId: 4, currency: 'SGD', toCurrency: 'USD', amount: 10000, amountTo: 13000 }));
  });

  test('the amount received is required', async () => {
    const result = await (await renderForm({ initialType: 'transfer' })).view;
    await fireEvent.changeText(result.getByTestId('tx-amount-input'), '10');
    await fireEvent.press(result.getByTestId('tx-save'));
    expect(result.getByText('Isi jumlah yang kamu terima.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------- detail

const DETAIL: ValasDetail = {
  id: 4,
  name: 'Valas',
  openingDate: '2026-01-01',
  pockets: [
    { currency: 'USD', minorFactor: 100, balance: 25000, rateE4: 162500000, rateAt: '2026-10-28T09:00:00+07:00', valueIdr: 4062500, openingBalance: 25000, openingDate: '2026-01-01' },
    { currency: 'SGD', minorFactor: 100, balance: 18000, rateE4: 125000000, rateAt: '2026-10-28T09:00:00+07:00', valueIdr: 2250000, openingBalance: 20000, openingDate: '2026-01-01' },
  ],
  totalIdr: 6312500,
  missingRates: 0,
  latestRateAt: '2026-10-28T09:00:00+07:00',
  period: '2026-10',
};

describe('the Valas detail (Valas-Detail)', () => {
  test('shows ≈ Rp6.312.500, a row per pocket with its rate, its own amount and its value', async () => {
    const result = await render(
      wrap(
        <>
          <ValasHero detail={DETAIL} />
          <PocketsCard detail={DETAIL} onSetRate={jest.fn()} onAddCurrency={jest.fn()} />
        </>,
      ),
    );
    expect(within(result.getByTestId('valas-hero')).getByText('≈ ')).toBeTruthy();
    expect(result.getByTestId('valas-total').props.children).toBe('Rp6.312.500');
    expect(within(result.getByTestId('valas-pocket-USD')).getByText('US$250,00')).toBeTruthy();
    expect(within(result.getByTestId('valas-pocket-USD')).getByText('Rp16.250 per US$1')).toBeTruthy();
    expect(result.getByTestId('valas-value-SGD').props.children).toBe('Rp2.250.000');
    expect(result.getByTestId('valas-add-currency')).toBeTruthy();
  });

  test('a pocket without a rate shows its own amount, "Belum ada kurs" and a way to set it; the total says it is incomplete', async () => {
    const detail: ValasDetail = {
      ...DETAIL,
      pockets: [{ ...DETAIL.pockets[0], rateE4: null, rateAt: null, valueIdr: null }, DETAIL.pockets[1]],
      totalIdr: 2250000,
      missingRates: 1,
    };
    const onSetRate = jest.fn();
    const result = await render(
      wrap(
        <>
          <ValasHero detail={detail} />
          <PocketsCard detail={detail} onSetRate={onSetRate} onAddCurrency={jest.fn()} />
        </>,
      ),
    );
    expect(result.getByTestId('valas-incomplete')).toBeTruthy();
    expect(within(result.getByTestId('valas-pocket-USD')).getByText('US$250,00')).toBeTruthy();
    expect(result.queryByTestId('valas-value-USD')).toBeNull(); // no "≈ Rp0"
    await fireEvent.press(result.getByTestId('valas-set-rate-USD'));
    expect(onSetRate).toHaveBeenCalled();
  });

  test('no rate at all: no rupiah total is drawn', async () => {
    const detail: ValasDetail = { ...DETAIL, pockets: DETAIL.pockets.map(p => ({ ...p, rateE4: null, valueIdr: null })), totalIdr: 0, missingRates: 2, latestRateAt: null };
    const result = await render(wrap(<ValasHero detail={detail} />));
    expect(result.queryByTestId('valas-total')).toBeNull();
    expect(result.getByTestId('valas-total-norate')).toBeTruthy();
  });

  test('hidden-amounts mode hides the total, the native amounts and the values', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    const result = await render(
      wrap(
        <>
          <ValasHero detail={DETAIL} />
          <PocketsCard detail={DETAIL} onSetRate={jest.fn()} onAddCurrency={jest.fn()} />
        </>,
      ),
    );
    expect(result.getByTestId('valas-total').props.children).toBe('Rp••••••••');
    expect(result.queryByText(/6\.312\.500/)).toBeNull();
    expect(result.queryByText(/250,00/)).toBeNull();
    expect(result.queryByText(/4\.062\.500/)).toBeNull();
    expect(result.getByTestId('valas-native-USD').props.children).toBe('Rp••••••••');
  });

  test('the activity has a chip per currency and shows each row in its own currency with the value of the day', async () => {
    const items: ValasActivityItem[] = [{ id: 7, date: '2026-10-15', title: 'Dinner, Singapore', kind: 'expense', currency: 'SGD', minorFactor: 100, delta: -2000, valueIdr: 250000 }];
    const onFilter = jest.fn();
    const result = await render(wrap(<ValasActivity period="2026-10" currencies={['USD', 'SGD']} filter="all" onFilter={onFilter} items={items} onOpenTx={jest.fn()} onViewAll={jest.fn()} />));
    await fireEvent.press(result.getByTestId('valas-filter-SGD'));
    expect(onFilter).toHaveBeenCalledWith('SGD');
    expect(within(result.getByTestId('valas-activity-7-SGD')).getByText('−S$20,00')).toBeTruthy();
    expect(within(result.getByTestId('valas-activity-7-SGD')).getByText('Rp250.000')).toBeTruthy();
  });
});

// ---------------------------------------------------------------- create form

function renderValasForm(props: Partial<ValasFormProps> = {}) {
  const onSubmit = jest.fn(async () => ({ ok: true as const }));
  const view = render(wrap(<ValasForm mode="add" initial={{ name: 'Valas', rows: [], openingDate: TODAY }} today={TODAY} otherNames={['BCA Tabungan']} onCancel={jest.fn()} onSubmit={onSubmit} {...props} />));
  return { view, onSubmit };
}

describe('creating the Valas account (Valas-Edit)', () => {
  test('"Buat akun" is off until there is a currency, and there is no single balance field', async () => {
    const result = await renderValasForm().view;
    expect(result.getByTestId('valas-type-tile')).toBeTruthy();
    expect(result.getByTestId('valas-save').props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.queryByTestId('tx-amount-input')).toBeNull();
    expect(result.getByTestId('valas-no-currency')).toBeTruthy();
  });

  test('adds currencies from the sheet, types opening balances, removes one, and creates', async () => {
    const { view, onSubmit } = renderValasForm();
    const result = await view;
    await fireEvent.press(result.getByTestId('valas-add-currency-button'));
    await fireEvent.press(within(result.getByTestId('add-currency-sheet')).getByTestId('add-currency-USD'));
    await fireEvent.press(result.getByTestId('valas-add-currency-button'));
    await fireEvent.press(within(result.getByTestId('add-currency-sheet')).getByTestId('add-currency-JPY'));
    await fireEvent.changeText(result.getByTestId('valas-amount-USD'), '250,00');
    await fireEvent.changeText(result.getByTestId('valas-amount-JPY'), '15.000');
    expect(result.getByTestId('valas-save').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(result.getByTestId('valas-remove-JPY'));
    expect(result.queryByTestId('valas-amount-JPY')).toBeNull();
    await fireEvent.press(result.getByTestId('valas-save'));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Valas', rows: [{ currency: 'USD', text: '250,00' }], openingDate: TODAY });
  });

  test('an opening balance that is not a number is marked and not saved', async () => {
    const { view, onSubmit } = renderValasForm({ initial: { name: 'Valas', rows: [{ currency: 'USD', text: 'abc' }], openingDate: TODAY } });
    const result = await view;
    await fireEvent.press(result.getByTestId('valas-save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.getByTestId('valas-amount-error-USD')).toBeTruthy();
  });

  test('a name another account already has is refused', async () => {
    const { view, onSubmit } = renderValasForm({ initial: { name: 'bca tabungan', rows: [{ currency: 'USD', text: '' }], openingDate: TODAY } });
    const result = await view;
    await fireEvent.press(result.getByTestId('valas-save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.getByTestId('valas-name-error')).toBeTruthy();
  });

  test('editing: pockets with money cannot be archived; an empty one can', async () => {
    const onArchivePocket = jest.fn(async () => ({ ok: true as const }));
    const { view } = renderValasForm({
      mode: 'edit',
      initial: { name: 'Valas', rows: [], openingDate: TODAY },
      pockets: [
        { currency: 'USD', balance: 25000, minorFactor: 100 },
        { currency: 'SGD', balance: 0, minorFactor: 100 },
      ],
      onArchivePocket,
    });
    const result = await view;
    expect(result.getByTestId('valas-archive-USD').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(result.getByTestId('valas-archive-SGD'));
    expect(onArchivePocket).toHaveBeenCalledWith('SGD');
  });
});

describe('the Add-currency sheet', () => {
  test('lists the currencies, marks the ones already added and searches by code or name', async () => {
    const onPick = jest.fn();
    const result = await render(wrap(<AddCurrencySheet visible onClose={jest.fn()} added={['USD']} onPick={onPick} />));
    expect(result.getByTestId('add-currency-USD').props.accessibilityState).toMatchObject({ disabled: true });
    // an added currency is marked by a check and its spoken label (the row has no extra text)
    expect(result.getByTestId('add-currency-USD').props.accessibilityLabel).toBe('USD, Dolar AS, sudah ditambahkan');
    expect(result.getByTestId('add-currency-SGD').props.accessibilityLabel).toBe('SGD, Dolar Singapura');
    await fireEvent.press(result.getByTestId('add-currency-USD'));
    expect(onPick).not.toHaveBeenCalled();
    expect(result.getByText(/Kurs dibutuhkan untuk menampilkan nilai rupiah/)).toBeTruthy();
    await fireEvent.changeText(result.getByTestId('add-currency-search'), 'yen');
    expect(result.getByTestId('add-currency-JPY')).toBeTruthy();
    expect(result.queryByTestId('add-currency-SGD')).toBeNull();
    await fireEvent.press(result.getByTestId('add-currency-JPY'));
    expect(onPick).toHaveBeenCalledWith('JPY');
  });

  test('matchCurrencies', () => {
    expect(matchCurrencies('').length).toBeGreaterThan(140);
    expect(matchCurrencies('dolar')).toEqual(expect.arrayContaining(['AUD', 'HKD', 'SGD', 'USD', 'CAD', 'NZD']));
    expect(matchCurrencies('dinar')).toEqual(expect.arrayContaining(['KWD', 'BHD', 'JOD']));
    expect(matchCurrencies('kwd')).toEqual(['KWD']);
    expect(matchCurrencies('zzz')).toEqual([]);
  });
});

// ---------------------------------------------------------------- rates

const RATES_PROPS: RatesViewProps = {
  rows: [
    { currency: 'USD', rateE4: 162500000, fetchedAt: '2026-10-28T09:00:00+07:00', source: 'api' },
    { currency: 'SGD', rateE4: null, fetchedAt: null, source: null },
  ],
  autoUpdate: false,
  lastSuccessAt: '2026-10-28T09:00:00+07:00',
  updating: false,
  failure: null,
  onBack: jest.fn(),
  onToggleAuto: jest.fn(),
  onUpdateNow: jest.fn(),
  onEditRate: jest.fn(),
};

describe('Rates (/settings/rates)', () => {
  test('with the switch off it asks to turn it on', async () => {
    const onToggleAuto = jest.fn();
    const result = await render(wrap(<RatesView {...RATES_PROPS} onToggleAuto={onToggleAuto} />));
    expect(result.getByTestId('rates-auto-switch').props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(result.getByTestId('rates-auto-switch'));
    expect(onToggleAuto).toHaveBeenCalledWith(true);
  });

  test('each held currency has its rate, source and time; one without a rate says so and is never 0', async () => {
    const onEditRate = jest.fn();
    const result = await render(wrap(<RatesView {...RATES_PROPS} onEditRate={onEditRate} />));
    expect(result.getByTestId('rates-value-USD').props.children).toBe('Rp16.250 per US$1');
    expect(result.getByTestId('rates-value-SGD').props.children).toBe('Atur kurs');
    expect(within(result.getByTestId('rates-row-SGD')).getByText('Belum ada kurs')).toBeTruthy();
    expect(result.queryByText(/Rp0/)).toBeNull();
    await fireEvent.press(result.getByTestId('rates-row-SGD'));
    expect(onEditRate).toHaveBeenCalledWith('SGD');
  });

  test('"Perbarui kurs sekarang" updates; while updating the button is busy and does nothing', async () => {
    const onUpdateNow = jest.fn();
    const result = await render(wrap(<RatesView {...RATES_PROPS} onUpdateNow={onUpdateNow} />));
    await fireEvent.press(result.getByTestId('rates-update-now'));
    expect(onUpdateNow).toHaveBeenCalledTimes(1);

    const busy = await render(wrap(<RatesView {...RATES_PROPS} updating onUpdateNow={onUpdateNow} />));
    await fireEvent.press(busy.getByTestId('rates-update-now'));
    expect(onUpdateNow).toHaveBeenCalledTimes(1);
  });

  test('a failed update says nothing was lost, in three kinds', async () => {
    const offline = await render(wrap(<RatesView {...RATES_PROPS} failure={{ kind: 'offline' }} />));
    expect(within(offline.getByTestId('rates-failure')).getByText(/Tidak ada internet\. MONO tetap memakai kurs/)).toBeTruthy();
    const limited = await render(wrap(<RatesView {...RATES_PROPS} failure={{ kind: 'rate_limited', minutesLeft: 12 }} />));
    expect(within(limited.getByTestId('rates-failure')).getByText(/dalam 12 menit/)).toBeTruthy();
    const invalid = await render(wrap(<RatesView {...RATES_PROPS} failure={{ kind: 'invalid' }} />));
    expect(within(invalid.getByTestId('rates-failure')).getByText(/tidak bisa dipakai/)).toBeTruthy();
  });

  test('shows how rates are used, the privacy line and the attribution', async () => {
    const result = await render(wrap(<RatesView {...RATES_PROPS} />));
    expect(result.getByText(/Tiap transaksi menyimpan nilai rupiah pada hari dicatat/)).toBeTruthy();
    expect(result.getByText(/Catatan, saldo, dan nama akunmu tidak pernah ikut/)).toBeTruthy();
    expect(result.getByTestId('rates-attribution').props.children).toBe('Kurs oleh Exchange Rate API');
  });
});
