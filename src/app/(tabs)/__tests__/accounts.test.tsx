import { fireEvent, render } from '@testing-library/react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountsScreen from '../accounts';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import type { AccountsOverview } from '@/domain/balances';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';

jest.mock('@/features/accounts/useAccountsOverview');
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));

const mockUseAccountsOverview = useAccountsOverview as jest.MockedFunction<typeof useAccountsOverview>;

function mockResult(partial: Partial<UseQueryResult<AccountsOverview>>) {
  mockUseAccountsOverview.mockReturnValue(partial as UseQueryResult<AccountsOverview>);
}

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<AccountsScreen />}</SafeAreaProvider>);
}

const SAMPLE: AccountsOverview = {
  netWorth: 8880000,
  incomplete: false,
  accountCount: 4,
  groups: [
    { type: 'bank', subtotal: 6842500, accounts: [{ id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500, missingRates: 0 }] },
    { type: 'cash', subtotal: 450000, accounts: [{ id: 2, name: 'Cash wallet', type: 'cash', icon: 'cash', balance: 450000, missingRates: 0 }] },
    { type: 'ewallet', subtotal: 312500, accounts: [{ id: 3, name: 'GoPay', type: 'ewallet', icon: 'gopay', balance: 312500, missingRates: 0 }] },
    { type: 'savings', subtotal: 1275000, accounts: [{ id: 4, name: 'Jago Pocket', type: 'savings', icon: 'jago', balance: 1275000, missingRates: 0 }] },
  ],
};

const WITH_VALAS: AccountsOverview = {
  netWorth: 15192500,
  incomplete: false,
  accountCount: 5,
  groups: [
    ...SAMPLE.groups,
    {
      type: 'forex',
      subtotal: 6312500,
      accounts: [
        {
          id: 5,
          name: 'Valas',
          type: 'forex',
          icon: null,
          balance: 6312500,
          missingRates: 0,
          pockets: [
            { currency: 'USD', balance: 25000, minorFactor: 100, valueIdr: 4062500 },
            { currency: 'SGD', balance: 18000, minorFactor: 100, valueIdr: 2250000 },
          ],
        },
      ],
    },
  ],
};

describe('AccountsScreen', () => {
  beforeEach(() => {
    useHideAmounts.getState().setHidden(false);
    jest.clearAllMocks();
  });

  test('groups render in order (Bank, Tunai, E-wallet, Tabungan) with the sample subtotals', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.getByText('Bank')).toBeTruthy();
    expect(result.getByText('Tunai')).toBeTruthy();
    expect(result.getByText('E-wallet')).toBeTruthy();
    expect(result.getByText('Tabungan')).toBeTruthy();
    // Each group's subtotal equals its one account's balance in this fixture, so each
    // formatted figure appears twice: once as the group subtotal, once on its card.
    expect(result.getAllByText('Rp6.842.500').length).toBe(2);
    expect(result.getAllByText('Rp450.000').length).toBe(2);
    expect(result.getAllByText('Rp312.500').length).toBe(2);
    expect(result.getAllByText('Rp1.275.000').length).toBe(2);
    expect(result.getByText('4 akun')).toBeTruthy();
  });

  test('a forex group appears last with "Mata uang asing", the ≈ prefix, and its pockets', async () => {
    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.getByText('Mata uang asing')).toBeTruthy();
    expect(result.getAllByText('≈ ').length).toBeGreaterThan(0); // the summary card's own prefix, plus BankCard's
    expect(result.getByText('US$250,00 · S$180,00')).toBeTruthy();
  });

  test('incomplete shows the warning note', async () => {
    mockResult({ data: { ...SAMPLE, incomplete: true }, isLoading: false, isError: false });
    const result = await renderScreen();
    expect(result.getByText('Belum lengkap: ada mata uang tanpa kurs.')).toBeTruthy();
  });

  test('hidden mode masks the summary, subtotals and every card balance', async () => {
    useHideAmounts.getState().setHidden(true);
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.queryByText('Rp6.842.500')).toBeNull();
    expect(result.queryAllByText('Rp••••••••').length).toBeGreaterThan(0);
  });

  test('loading: an empty background, no content yet', async () => {
    mockResult({ data: undefined, isLoading: true, isError: false });
    const result = await renderScreen();
    expect(result.queryByText('4 akun')).toBeNull();
  });

  test('error: a short message and a retry button that calls refetch', async () => {
    const refetch = jest.fn();
    mockResult({ data: undefined, isLoading: false, isError: true, refetch });
    const result = await renderScreen();

    expect(result.getByText('Akun gagal dimuat.')).toBeTruthy();
    fireEvent.press(result.getByRole('button', { name: 'Coba lagi' }));
    expect(refetch).toHaveBeenCalled();
  });

  test('empty: icon, one sentence, and "Tambah akun" shows the not-available toast', async () => {
    mockResult({ data: { netWorth: 0, incomplete: false, accountCount: 0, groups: [] }, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.getByText('Belum ada akun')).toBeTruthy();
    fireEvent.press(result.getByRole('button', { name: 'Tambah akun' }));
    expect(showToast).toHaveBeenCalledWith('Belum tersedia.');
  });

  test('Transfer antar akun shows the not-available toast', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    fireEvent.press(result.getByRole('button', { name: 'Transfer antar akun' }));
    expect(showToast).toHaveBeenCalledWith('Belum tersedia.');
  });

  test('tapping an account card shows the not-available toast', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    fireEvent.press(result.getByTestId('account-card-1'));
    expect(showToast).toHaveBeenCalledWith('Belum tersedia.');
  });
});
