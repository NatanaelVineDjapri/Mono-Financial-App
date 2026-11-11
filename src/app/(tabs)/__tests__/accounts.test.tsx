import { fireEvent, render } from '@testing-library/react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountsScreen from '../accounts';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import type { AccountsOverview } from '@/domain/balances';
import { useAccountsOverview } from '@/features/accounts/useAccountsOverview';
import { useLatestFxUpdate } from '@/features/fx/useLatestFxUpdate';

jest.mock('@/features/accounts/useAccountsOverview');
jest.mock('@/features/fx/useLatestFxUpdate');
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockUseAccountsOverview = useAccountsOverview as jest.MockedFunction<typeof useAccountsOverview>;
const mockUseLatestFxUpdate = useLatestFxUpdate as jest.MockedFunction<typeof useLatestFxUpdate>;

function mockResult(partial: Partial<UseQueryResult<AccountsOverview>>) {
  mockUseAccountsOverview.mockReturnValue(partial as UseQueryResult<AccountsOverview>);
}

function mockFxUpdate(fetchedAt: string | null) {
  mockUseLatestFxUpdate.mockReturnValue({ data: fetchedAt } as never);
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
    mockFxUpdate(null);
  });

  test('accounts render in order (Bank, Cash, E-wallet, Savings) as a card stack, last one open by default', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();

    const order = [1, 2, 3, 4].map(id => result.getByTestId(`card-stack-card-${id}`));
    expect(order).toHaveLength(4);
    // Exactly the last card (Jago Pocket) is open by default — its label says "Open
    // account"; every other card says "Bring card forward" (Fase 4.2c step 3).
    expect(order[3].props.accessibilityLabel).toContain('Open account.');
    for (const strip of order.slice(0, 3)) {
      expect(strip.props.accessibilityLabel).toContain('Bring card forward.');
    }
  });

  // Fase 4.2c step 3: the stack's own standalone note below it is gone — the total
  // card's note is the only place it lives, and it's never empty.
  test('with no Valas and no data gap, the total card falls back to the everyday transfer note', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    expect(result.getByText('Every account added together. Moving money between accounts never changes this total.')).toBeTruthy();
  });

  test('a forex account appears last, but is not open by default (the last non-forex account is)', async () => {
    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const result = await renderScreen();

    // Jago Pocket (id 4), the last non-forex account, opens instead of Valas (id 5).
    expect(result.getByTestId('card-stack-card-4').props.accessibilityLabel).toContain('Open account.');
    expect(result.getByTestId('card-stack-card-5').props.accessibilityLabel).toContain('Bring card forward.');
  });

  test('bringing the Valas card forward shows its ≈ total, pockets and no tag pill', async () => {
    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const result = await renderScreen();

    await fireEvent.press(result.getByTestId('card-stack-card-5'));
    expect(result.getByTestId('card-stack-card-5').props.accessibilityLabel).toContain('Open account.');
    expect(result.getByText('≈ ')).toBeTruthy();
    expect(result.getByText('US$250,00 · S$180,00')).toBeTruthy();
    // No tag pill (Fase 4.2c step 4: "hapus tag pill 'N MATA UANG'").
    expect(result.queryByText(/CURRENC/)).toBeNull();
  });

  test('the forex estimate note only shows while the Valas card is open; closing it brings back the everyday note', async () => {
    mockFxUpdate('2026-10-28T09:00:00+07:00');
    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const result = await renderScreen();

    // Valas isn't open by default — the plain everyday note shows, not the estimate.
    expect(result.getByText('Every account added together. Moving money between accounts never changes this total.')).toBeTruthy();
    expect(result.queryByText('Foreign currency uses your latest rates (28 Oct 2026, 09:00), so the total is an estimate.')).toBeNull();

    // Bring Valas forward — the estimate note takes over.
    await fireEvent.press(result.getByTestId('card-stack-card-5'));
    expect(result.getByText('Foreign currency uses your latest rates (28 Oct 2026, 09:00), so the total is an estimate.')).toBeTruthy();
    expect(result.queryByText('Every account added together. Moving money between accounts never changes this total.')).toBeNull();

    // Bring BCA forward instead — Valas collapses, and the note reverts.
    await fireEvent.press(result.getByTestId('card-stack-card-1'));
    expect(result.getByText('Every account added together. Moving money between accounts never changes this total.')).toBeTruthy();
    expect(result.queryByText('Foreign currency uses your latest rates (28 Oct 2026, 09:00), so the total is an estimate.')).toBeNull();
  });

  test('the Exchange rates row only appears with a forex account, and shows when it was last updated', async () => {
    mockFxUpdate('2026-10-28T09:00:00+07:00');
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const noForex = await renderScreen();
    expect(noForex.queryByText('Exchange rates')).toBeNull();

    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const withForex = await renderScreen();
    expect(withForex.getByText('Exchange rates')).toBeTruthy();
    expect(withForex.getByText('updated 28 Oct 2026, 09:00')).toBeTruthy();
  });

  test('incomplete shows the warning note on the total card', async () => {
    mockResult({ data: { ...SAMPLE, incomplete: true }, isLoading: false, isError: false });
    const result = await renderScreen();
    expect(result.getByText('Incomplete: some currencies are missing exchange rates.')).toBeTruthy();
  });

  test('a forex account with no warning shows the "estimate" note instead, once rates exist and Valas is open', async () => {
    mockFxUpdate('2026-10-28T09:00:00+07:00');
    mockResult({ data: WITH_VALAS, isLoading: false, isError: false });
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('card-stack-card-5'));
    expect(result.getByText('Foreign currency uses your latest rates (28 Oct 2026, 09:00), so the total is an estimate.')).toBeTruthy();
  });

  test('hidden mode masks the total card and every card balance', async () => {
    useHideAmounts.getState().setHidden(true);
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.queryByText('Rp8.880.000')).toBeNull();
    expect(result.queryAllByText('Rp••••••••').length).toBeGreaterThan(0);
    for (const id of [1, 2, 3, 4]) {
      expect(result.getByTestId(`card-stack-card-${id}`).props.accessibilityLabel).toContain('Rp••••••••');
    }
  });

  test('loading: an empty background, no content yet', async () => {
    mockResult({ data: undefined, isLoading: true, isError: false });
    const result = await renderScreen();
    expect(result.queryByTestId('accounts-card-stack')).toBeNull();
  });

  test('error: a short message and a retry button that calls refetch', async () => {
    const refetch = jest.fn();
    mockResult({ data: undefined, isLoading: false, isError: true, refetch });
    const result = await renderScreen();

    expect(result.getByText('Failed to load accounts.')).toBeTruthy();
    fireEvent.press(result.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  test('empty: icon, one sentence, and "Add account" opens the account form', async () => {
    mockResult({ data: { netWorth: 0, incomplete: false, accountCount: 0, groups: [] }, isLoading: false, isError: false });
    const result = await renderScreen();

    expect(result.getByText('No accounts yet')).toBeTruthy();
    for (const button of result.getAllByRole('button', { name: 'Add account' })) {
      mockPush.mockClear();
      await fireEvent.press(button);
      expect(mockPush).toHaveBeenCalledWith('/account/edit');
    }
    expect(showToast).not.toHaveBeenCalled();
  });

  test('tapping the already-open card navigates to /account/[id]', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    // Jago Pocket (id 4) is open by default.
    await fireEvent.press(result.getByTestId('card-stack-card-4'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: '4' } });
  });

  test('tapping a closed strip brings it forward instead of navigating', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('card-stack-card-1'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.getByTestId('card-stack-card-1').props.accessibilityLabel).toContain('Open account.');
  });

  test('Transfer opens the transaction form as a transfer; Add account opens the account form', async () => {
    mockResult({ data: SAMPLE, isLoading: false, isError: false });
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Transfer' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tx/add', params: { type: 'transfer' } });
    mockPush.mockClear();
    await fireEvent.press(result.getByTestId('accounts-add-button'));
    expect(mockPush).toHaveBeenCalledWith('/account/edit');
    expect(showToast).not.toHaveBeenCalled();
  });
});
