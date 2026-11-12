// Hasil scan (Receipt-Review): the draft a scan produced, to check and save.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import type { FormAccount, FormCategory, TxFormValues } from '@/core/tx/validate';
import { findSimilarExpense } from '@/data/repo/transactions';
import type { TxFormData } from '@/domain/txForm';
import type { ParsedReceipt } from '@/features/receipt/parse';
import { ReceiptReview } from '@/features/receipt/ReceiptReview';
import { useReceiptStore } from '@/features/receipt/store';

const mockSubmit = jest.fn();
jest.mock('@/features/transactions/form/useTxForm', () => ({ useAddSubmit: () => mockSubmit }));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/transactions', () => ({ findSimilarExpense: jest.fn() }));

const similar = findSimilarExpense as jest.Mock;
const TODAY = '2026-10-28';
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const BCA: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, openingDate: '2026-01-01' };
const CASH: FormAccount = { id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, openingDate: '2026-01-01' };
const VALAS: FormAccount = { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, openingDate: '2026-01-01' };
const NAMES = ['Food & drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Leisure', 'Housing', 'Education', 'Gifts', 'Other'];
const CATEGORIES: FormCategory[] = [...NAMES.map((name, i) => ({ id: i + 1, name, kind: 'expense' as const })), { id: 11, name: 'Salary', kind: 'income' as const }];
const SHOPPING = 3;
const DATA: TxFormData = { accounts: [BCA, CASH, VALAS], categories: CATEGORIES, record: null };

const PARSED: ParsedReceipt = {
  merchant: 'Toko Sumber Rejeki',
  date: '2026-10-28',
  dateFromReceipt: true,
  totals: [
    { amount: 48000, score: 113 },
    { amount: 50000, score: 100 },
    { amount: 2000, score: 98 },
  ],
  foreignCurrency: false,
};

const onBack = jest.fn();
const onOpenAiSetup = jest.fn();
const tidy = jest.fn();
const LINES = ['TOKO SUMBER REJEKI', '28/10/2026', 'TOTAL 48.000'];

async function renderReview(over: { parsed?: ParsedReceipt; lastAccountId?: number | null; imageUri?: string | null; aiConfigured?: boolean } = {}) {
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <ReceiptReview parsed={over.parsed ?? PARSED} imageUri={over.imageUri === undefined ? 'file:///cache/Camera/r.jpg' : over.imageUri} data={DATA} lastAccountId={over.lastAccountId === undefined ? 1 : over.lastAccountId} today={TODAY} onBack={onBack} lines={LINES} aiConfigured={over.aiConfigured ?? true} tidy={tidy} onOpenAiSetup={onOpenAiSetup} />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  // The duplicate check resolves on the next tick (react-query notifies from a timer).
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return view;
}

const submitted = (): TxFormValues => mockSubmit.mock.calls[0][0];

beforeEach(async () => {
  jest.clearAllMocks();
  similar.mockResolvedValue(null);
  tidy.mockResolvedValue({ ok: true, shop: 'Toko Sumber Rejeki', category: 'Food & drink', account: null });
  mockSubmit.mockResolvedValue({ ok: true });
  useReceiptStore.getState().setResult(PARSED);
  await act(async () => useHideAmounts.getState().setHidden(false));
});

describe('the draft card', () => {
  test('shows what the board shows: privacy line, DRAF tag, shop, date, total chips, category and account', async () => {
    const result = await renderReview();
    expect(result.getByRole('header', { name: 'Hasil scan' })).toBeTruthy();
    expect(result.getByText('Dibaca di perangkat')).toBeTruthy();
    expect(result.getByText('Gambar tidak disimpan dan tidak dikirim. Periksa dulu sebelum menyimpan.')).toBeTruthy();
    expect(result.getByText('DRAF · PENGELUARAN')).toBeTruthy();
    expect(result.getByText('Belum tersimpan')).toBeTruthy();
    expect(result.getByTestId('review-name').props.value).toBe('Toko Sumber Rejeki');
    expect(result.getByTestId('review-date-line').props.children).toMatch(/· dari struk$/);
    expect(result.getByText('Total, pilih yang benar')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Rp48.000' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('button', { name: 'Rp50.000' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByRole('button', { name: 'Rp2.000' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Ketik sendiri' })).toBeTruthy();
    expect(result.getByText('Shopping')).toBeTruthy(); // guessed from "Toko"
    expect(result.getByText('BCA Tabungan')).toBeTruthy(); // the account used last
    expect(result.getByText('Saldo setelah Rp6.794.500')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Simpan pengeluaran' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Batal' })).toBeTruthy();
  });

  test('a date that is not from the receipt says "hari ini"', async () => {
    const result = await renderReview({ parsed: { ...PARSED, dateFromReceipt: false } });
    expect(result.getByTestId('review-date-line').props.children).toMatch(/· hari ini$/);
  });

  test('a shop with no category rule leaves the category as a prompt', async () => {
    const result = await renderReview({ parsed: { ...PARSED, merchant: 'Zzz Corner' } });
    expect(result.getByText('Pilih kategori')).toBeTruthy();
  });

  test('with no account used before, the first rupiah account is the default', async () => {
    const result = await renderReview({ lastAccountId: null });
    expect(result.getByText('BCA Tabungan')).toBeTruthy();
  });

  test('hidden-amounts mode masks the chips, the balance line and the notice', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    similar.mockResolvedValue({ id: 9, occurred_on: '2026-10-27', description: 'Sumber Rejeki', amount: 48000 });
    const result = await renderReview();
    await waitFor(() => expect(result.getByTestId('review-similar')).toBeTruthy());
    expect(result.queryByText(/48\.000/)).toBeNull();
    expect(result.queryByText(/6\.794\.500/)).toBeNull();
    expect(result.getByText('Saldo setelah Rp••••••••')).toBeTruthy();
  });
});

describe('the thumbnail', () => {
  test('the photo that was scanned is shown small, as on the board', async () => {
    const result = await renderReview();
    const thumb = result.getByTestId('review-thumb');
    expect(thumb.props.source).toEqual({ uri: 'file:///cache/Camera/r.jpg' });
    expect(Object.assign({}, ...[thumb.props.style].flat(Infinity).filter(Boolean))).toMatchObject({ width: 56, height: 72, borderRadius: 6 });
  });

  test('with no picture (the file is gone) the receipt icon stands in', async () => {
    const result = await renderReview({ imageUri: null });
    expect(result.queryByTestId('review-thumb')).toBeNull();
  });
});

describe('the total', () => {
  test('picking another chip changes the amount that is saved and the balance after', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Rp50.000' }));
    expect(result.getByRole('button', { name: 'Rp50.000' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('button', { name: 'Rp48.000' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByText('Saldo setelah Rp6.792.500')).toBeTruthy();

    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted().amount).toBe(50000);
  });

  test('"Ketik sendiri" lets the person type the total, and no chip is selected then', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Ketik sendiri' }));
    await fireEvent.changeText(result.getByTestId('review-total-input'), '51.700');
    expect(result.getByRole('button', { name: 'Rp48.000' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByText('Saldo setelah Rp6.790.800')).toBeTruthy();

    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted().amount).toBe(51700);
  });

  test('a typed total of zero cannot be saved: the amount error shows', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Ketik sendiri' }));
    await fireEvent.changeText(result.getByTestId('review-total-input'), '');
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.getByTestId('review-amount-error')).toBeTruthy();
  });
});

describe('saving', () => {
  test('Simpan sends an expense to the same save path as the manual form, then clears the draft', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted()).toEqual({
      type: 'expense',
      amount: 48000,
      categoryId: SHOPPING,
      accountId: 1,
      toAccountId: null,
      date: '2026-10-28',
      description: 'Toko Sumber Rejeki',
      note: '',
    });
    await waitFor(() => expect(useReceiptStore.getState().result).toBeNull());
  });

  test('the shop name can be corrected before saving', async () => {
    const result = await renderReview();
    await fireEvent.changeText(result.getByTestId('review-name'), 'Toko Sumber Rejeki Jaya');
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted().description).toBe('Toko Sumber Rejeki Jaya');
  });

  test('with no category, Simpan shows what is missing instead of saving; choosing one clears it', async () => {
    const result = await renderReview({ parsed: { ...PARSED, merchant: 'Zzz Corner' } });
    expect(result.queryByTestId('review-category-error')).toBeNull(); // not before Simpan is tapped
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.getByTestId('review-category-error')).toBeTruthy();

    await fireEvent.press(result.getByTestId('review-category'));
    await fireEvent.press(result.getByTestId('tx-category-option-2')); // Transport
    expect(result.queryByTestId('review-category-error')).toBeNull();
    expect(result.getByText('Transport')).toBeTruthy();

    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted().categoryId).toBe(2);
  });

  test('another account can be chosen; a Valas account cannot', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByTestId('review-account'));
    expect(result.getByTestId('tx-account-option-4').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(result.getByTestId('tx-account-option-2'));
    expect(result.getByText('Cash wallet')).toBeTruthy();
    expect(result.getByText('Saldo setelah Rp402.000')).toBeTruthy();
  });

  test('a total above the balance shows the short-balance error at once and blocks Simpan', async () => {
    const result = await renderReview({ lastAccountId: 2 });
    await fireEvent.press(result.getByRole('button', { name: 'Ketik sendiri' }));
    await fireEvent.changeText(result.getByTestId('review-total-input'), '500000');
    expect(result.getByTestId('review-account-error')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Simpan pengeluaran' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test('a refusal from the save path is shown and the draft stays', async () => {
    mockSubmit.mockResolvedValue({ ok: false, message: 'Tidak bisa menyimpan. Tidak ada yang diubah.' });
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(result.getByTestId('review-server-error')).toBeTruthy());
    expect(useReceiptStore.getState().result).not.toBeNull();
  });

  test('Batal and the back arrow leave without saving', async () => {
    const result = await renderReview();
    await fireEvent.press(result.getByRole('button', { name: 'Batal' }));
    await fireEvent.press(result.getByRole('button', { name: 'Kembali' }));
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('the duplicate notice', () => {
  test('a similar expense gives an info box that does not stop saving', async () => {
    similar.mockResolvedValue({ id: 9, occurred_on: '2026-10-27', description: 'Sumber Rejeki', amount: 48000 });
    const result = await renderReview();
    await waitFor(() => expect(result.getByTestId('review-similar')).toBeTruthy());
    expect(result.getByText(/^Mirip dengan transaksi .*: Rp48\.000, Sumber Rejeki\. Tetap boleh disimpan\.$/)).toBeTruthy();
    expect(similar).toHaveBeenCalledWith({ fake: 'db' }, { accountId: 1, amount: 48000, date: '2026-10-28', from: '2026-10-27', to: '2026-10-29' });

    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
  });

  test('no similar expense, no box', async () => {
    const result = await renderReview();
    await waitFor(() => expect(similar).toHaveBeenCalled());
    expect(result.queryByTestId('review-similar')).toBeNull();
  });
});

describe('Rapikan dengan AI', () => {
  const FOOD = 1;
  const openConsent = async (result: Awaited<ReturnType<typeof renderReview>>) => fireEvent.press(result.getByTestId('review-ai'));

  test('the button and its caption are on the screen', async () => {
    const result = await renderReview();
    expect(result.getByRole('button', { name: 'Rapikan dengan AI' })).toBeTruthy();
    expect(result.getByText('Hanya teks hasil bacaan yang dikirim ke Gemini, bukan gambar.')).toBeTruthy();
  });

  test('it asks first, every time: the dialog says what is and is not sent, and nothing is sent yet', async () => {
    const result = await renderReview();
    await openConsent(result);
    expect(result.getByText('Kirim teks struk ke Google?')).toBeTruthy();
    expect(result.getByText(/teks hasil bacaan/)).toBeTruthy();
    expect(result.getByText(/Tidak dikirim: gambar struk, saldo, riwayat transaksi\. Kamu akan ditanya setiap kali\./)).toBeTruthy();
    expect(tidy).not.toHaveBeenCalled();
  });

  test('"Jangan kirim" closes the dialog and sends nothing', async () => {
    const result = await renderReview();
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Jangan kirim' }));
    expect(result.queryByText('Kirim teks struk ke Google?')).toBeNull();
    expect(tidy).not.toHaveBeenCalled();
  });

  test('"Kirim" sends the lines with the lists, then the proposal fills the draft and is marked', async () => {
    const result = await renderReview({ parsed: { ...PARSED, merchant: 'TOKO SUMBER REJEKI' } });
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(tidy).toHaveBeenCalledTimes(1));
    expect(tidy.mock.calls[0][0]).toEqual(LINES);
    expect(tidy.mock.calls[0][1]).toMatchObject({ today: TODAY, accounts: DATA.accounts, categories: DATA.categories });

    await waitFor(() => expect(result.getByText('Food & drink ✓')).toBeTruthy());
    expect(result.getByTestId('review-date-line').props.children).toMatch(/^Disesuaikan AI · .* · dari struk$/);
    // the proposal is a draft like any other: nothing was saved, and Simpan is still the person's
    expect(mockSubmit).not.toHaveBeenCalled();
    await fireEvent.press(result.getByRole('button', { name: 'Simpan pengeluaran' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(submitted()).toMatchObject({ categoryId: FOOD, amount: 48000 });
  });

  test('a category the person picked afterwards loses the AI mark', async () => {
    const result = await renderReview();
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(result.getByText('Food & drink ✓')).toBeTruthy());
    await fireEvent.press(result.getByTestId('review-category'));
    await fireEvent.press(result.getByTestId('tx-category-option-2'));
    expect(result.getByText('Transport')).toBeTruthy();
    expect(result.queryByText(/✓/)).toBeNull();
  });

  test('a category the person already chose is not overwritten', async () => {
    const result = await renderReview({ parsed: { ...PARSED, merchant: 'Zzz Corner' } });
    await fireEvent.press(result.getByTestId('review-category'));
    await fireEvent.press(result.getByTestId('tx-category-option-4')); // Bills
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(tidy).toHaveBeenCalled());
    await act(async () => undefined);
    expect(result.getByText('Bills')).toBeTruthy();
    expect(result.queryByText(/✓/)).toBeNull();
  });

  test('when the AI has nothing to change, the screen says so', async () => {
    tidy.mockResolvedValue({ ok: true, shop: null, category: null, account: null });
    const result = await renderReview();
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(result.getByTestId('review-ai-nothing')).toBeTruthy());
    expect(result.getByText('AI tidak menemukan yang perlu dirapikan.')).toBeTruthy();
  });

  test('a failure is worded by the app and the draft stays as it was', async () => {
    tidy.mockResolvedValue({ ok: false, code: 'no_internet' });
    const result = await renderReview();
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(result.getByTestId('review-ai-error')).toBeTruthy());
    expect(result.getByText(/Tidak ada internet\./)).toBeTruthy();
    expect(result.getByTestId('review-name').props.value).toBe('Toko Sumber Rejeki');
    expect(result.queryByText(/✓/)).toBeNull();
  });

  test('while it works the button says so and cannot be pressed again', async () => {
    let finish: (v: unknown) => void = () => undefined;
    tidy.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const result = await renderReview();
    await openConsent(result);
    await fireEvent.press(result.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(result.getByRole('button', { name: 'Merapikan…' }).props.accessibilityState).toMatchObject({ disabled: true }));
    await act(async () => finish({ ok: false, code: 'timeout' }));
    await waitFor(() => expect(result.getByRole('button', { name: 'Rapikan dengan AI' })).toBeTruthy());
  });

  test('when the AI is not set up the button leads to its setup instead of asking', async () => {
    const result = await renderReview({ aiConfigured: false });
    await openConsent(result);
    expect(onOpenAiSetup).toHaveBeenCalledTimes(1);
    expect(result.queryByText('Kirim teks struk ke Google?')).toBeNull();
    expect(tidy).not.toHaveBeenCalled();
  });
});
